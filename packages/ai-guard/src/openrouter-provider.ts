/**
 * OpenRouter adapter — the only code in the repository that performs an AI network call.
 *
 * Purpose
 *   Translate a `ProviderRequest` into an OpenRouter chat-completion request and normalise
 *   the answer back into a `ProviderCompletion`. It implements `ChatProvider` and nothing
 *   else; it holds no budget logic, no cache logic, and no retry logic.
 *
 * Key responsibilities
 *   - Build the request body, including the provider pins and reasoning suppression that
 *     the model strategy document requires.
 *   - Ask for `usage: { include: true }` on every call, because the ledger meters on the
 *     per-request `usage.cost` field.
 *   - Map a non-2xx response or an unusable body to `ProviderRequestError`.
 *
 * Secrets
 *   The API key is read from the `OPENROUTER_API_KEY` environment variable at call time and
 *   is never logged, never included in an error message, and never written to the cache.
 *   Nothing in this file interpolates it into a string other than the Authorization header.
 *
 * Why `reasoning` is switched off explicitly
 *   Reasoning tokens bill as output. `deepseek-v4-flash` defaults to high reasoning effort,
 *   which silently doubles the cost of a call the ledger reserved for a cheaper model. Any
 *   model whose reasoning is `optional` therefore has it disabled on the wire.
 *
 * Dependencies
 *   Global `fetch` (Node 20+). No SDK, so there is no transitive dependency that could
 *   start making calls of its own.
 */

import { ProviderRequestError } from './errors';
import type { ChatProvider, ProviderCompletion, ProviderRequest, TokenUsage } from './types';

/** OpenRouter's chat-completions endpoint. */
const OPENROUTER_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Environment variable holding the API key. Named, never printed. */
const API_KEY_VARIABLE = 'OPENROUTER_API_KEY';

/** Options for the adapter. */
export interface OpenRouterProviderOptions {
  /** Overrides the endpoint. Exists for a local proxy or a contract test, not for tests. */
  readonly baseUrl?: string;
  /** Sent as `X-Title`, which is how OpenRouter labels spend in its dashboard. */
  readonly appTitle?: string;
}

/** Read a numeric field from an unknown object, or return `null`. */
function readNumber(source: Record<string, unknown>, key: string): number | null {
  const raw = source[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

/** Read a nested object field from an unknown object, or return `null`. */
function readObject(source: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const raw = source[key];
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null;
}

/**
 * Pull the usage block out of a response body.
 *
 * @param body Parsed response object.
 * @returns Token counts, with `reportedCostUsd` null when OpenRouter omitted `cost`.
 */
function extractUsage(body: Record<string, unknown>): TokenUsage {
  const usage = readObject(body, 'usage');
  if (usage === null) {
    return { promptTokens: 0, completionTokens: 0, reportedCostUsd: null };
  }
  return {
    promptTokens: readNumber(usage, 'prompt_tokens') ?? 0,
    completionTokens: readNumber(usage, 'completion_tokens') ?? 0,
    reportedCostUsd: readNumber(usage, 'cost'),
  };
}

/**
 * Pull the assistant message out of the first choice.
 *
 * Keys are read by name, never positionally: providers were observed returning object keys
 * in differing orders, so positional parsing is unsafe.
 *
 * @param body Parsed response object.
 * @returns Content and finish reason.
 * @throws {ProviderRequestError} If the body has no usable choice.
 */
function extractMessage(body: Record<string, unknown>): { content: string; finishReason: string } {
  const choices = body['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ProviderRequestError('OpenRouter response contained no choices.', null);
  }
  const firstChoice = choices[0] as unknown;
  if (typeof firstChoice !== 'object' || firstChoice === null) {
    throw new ProviderRequestError('OpenRouter response choice was not an object.', null);
  }
  const choice = firstChoice as Record<string, unknown>;
  const message = readObject(choice, 'message');
  const content = message === null ? null : message['content'];
  if (typeof content !== 'string') {
    throw new ProviderRequestError('OpenRouter response had no textual content.', null);
  }
  const finishReason = choice['finish_reason'];
  return { content, finishReason: typeof finishReason === 'string' ? finishReason : 'unknown' };
}

/** Assemble the JSON request body for one completion. */
function buildRequestBody(request: ProviderRequest): Record<string, unknown> {
  const { model, params } = request;
  return {
    model: model.id,
    messages: request.messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: params.temperature,
    max_tokens: params.maxOutputTokens ?? model.maxOutputTokens,
    // The ledger meters on this. Without it OpenRouter omits `usage.cost` and the guard
    // falls back to token arithmetic, which is less accurate than the provider's own figure.
    usage: { include: true },
    ...(params.seed === null ? {} : { seed: params.seed }),
    ...(params.responseSchema === null || params.responseSchema === undefined
      ? {}
      : { response_format: params.responseSchema }),
    ...(model.providerOrder === null ? {} : { provider: { order: [...model.providerOrder] } }),
    // Reasoning bills as output; suppress it wherever the model allows it to be suppressed.
    ...(model.reasoning === 'optional' ? { reasoning: { enabled: false } } : {}),
  };
}

/**
 * `ChatProvider` implementation for OpenRouter.
 *
 * Owns: HTTP transport and response normalisation. Does not own: budget, cache, retries, or
 * timeouts — `AiClient` supplies the abort signal and decides what to do with a failure.
 */
export class OpenRouterProvider implements ChatProvider {
  readonly name = 'openrouter';
  readonly #baseUrl: string;
  readonly #appTitle: string;

  constructor(options: OpenRouterProviderOptions = {}) {
    this.#baseUrl = options.baseUrl ?? OPENROUTER_COMPLETIONS_URL;
    this.#appTitle = options.appTitle ?? 'Atlas Bible';
  }

  /**
   * Send one chat completion request.
   *
   * @param request Fully resolved request from `AiClient`.
   * @param signal  Abort signal carrying the caller's timeout.
   * @returns The normalised completion.
   * @throws {ProviderRequestError} On a missing key, a non-2xx status, or an unusable body.
   */
  async createCompletion(
    request: ProviderRequest,
    signal: AbortSignal,
  ): Promise<ProviderCompletion> {
    const apiKey = process.env[API_KEY_VARIABLE];
    if (apiKey === undefined || apiKey.trim() === '') {
      throw new ProviderRequestError(
        `${API_KEY_VARIABLE} is not set, so no AI call can be made.`,
        null,
      );
    }

    const response = await this.#send(request, apiKey, signal);
    if (!response.ok) {
      throw new ProviderRequestError(
        `OpenRouter returned HTTP ${response.status} for model "${request.model.id}".`,
        response.status,
      );
    }

    const body = await this.#parseBody(response);
    const { content, finishReason } = extractMessage(body);
    const modelId = typeof body['model'] === 'string' ? body['model'] : request.model.id;
    return { modelId, content, finishReason, usage: extractUsage(body), raw: body };
  }

  /** Perform the HTTP request, mapping transport failures to a typed error. */
  async #send(request: ProviderRequest, apiKey: string, signal: AbortSignal): Promise<Response> {
    try {
      return await fetch(this.#baseUrl, {
        method: 'POST',
        headers: {
          // The only place the key appears. It is never logged or serialised elsewhere.
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': this.#appTitle,
        },
        body: JSON.stringify(buildRequestBody(request)),
        signal,
      });
    } catch (transportError) {
      throw new ProviderRequestError(
        `OpenRouter request failed before a response was received.`,
        null,
        { cause: transportError },
      );
    }
  }

  /** Parse a successful response body, mapping malformed JSON to a typed error. */
  async #parseBody(response: Response): Promise<Record<string, unknown>> {
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (parseError) {
      throw new ProviderRequestError('OpenRouter response was not valid JSON.', response.status, {
        cause: parseError,
      });
    }
    if (typeof parsed !== 'object' || parsed === null) {
      throw new ProviderRequestError('OpenRouter response was not a JSON object.', response.status);
    }
    return parsed as Record<string, unknown>;
  }
}
