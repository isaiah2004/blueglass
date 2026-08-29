/**
 * Request planning — turning a caller's loose request into a fully resolved one.
 *
 * Purpose
 *   `AiClient` should read as an orchestration of six steps. Everything it needs to *decide*
 *   before those steps — defaults, caps, routability, and how to settle a failed attempt —
 *   lives here as small pure functions.
 *
 * Key responsibilities
 *   - Fill in parameter defaults and clamp the output cap to the registry's policy value.
 *   - Refuse tasks whose model is not routable through a chat provider.
 *   - Decide whether a failed attempt was provably unbilled.
 *   - Shape a `ProviderCompletion` into the public `CompletionResult`.
 *
 * Dependencies
 *   Pure functions over the package's own types. No I/O.
 */

import { ProviderRequestError, TaskNotRoutableError } from './errors';
import type {
  AiTask,
  CompletionParams,
  CompletionResult,
  ModelSpec,
  ProviderCompletion,
} from './types';

/** Deterministic by default: temperature zero is what makes a response cacheable. */
const DEFAULT_TEMPERATURE = 0;

/**
 * Resolve a caller's partial parameters against the model's registry entry.
 *
 * The output cap is clamped to the registry's `maxOutputTokens` rather than passed through.
 * That figure is a *policy* limit as much as a capability one — it is the number the
 * reservation is sized from — so letting a caller raise it would let a caller raise the cost
 * of a single call without limit.
 *
 * @param model     Model that will serve the request.
 * @param requested Caller-supplied overrides, all optional.
 * @returns Fully populated parameters.
 */
export function resolveCompletionParams(
  model: ModelSpec,
  requested: Partial<CompletionParams> | undefined,
): CompletionParams {
  const requestedOutputTokens = requested?.maxOutputTokens ?? null;
  const outputTokens =
    requestedOutputTokens === null
      ? model.maxOutputTokens
      : Math.max(1, Math.min(requestedOutputTokens, model.maxOutputTokens));

  return {
    temperature: requested?.temperature ?? DEFAULT_TEMPERATURE,
    maxOutputTokens: outputTokens,
    seed: requested?.seed ?? null,
    responseSchema: requested?.responseSchema ?? null,
  };
}

/**
 * Refuse a task whose model cannot be reached through a chat provider.
 *
 * Today that is only `embed`: OpenRouter sells no embedding models, so embeddings are
 * self-hosted and will get their own adapter. Failing loudly here is better than silently
 * routing an embedding request to a chat endpoint.
 *
 * @param task  Logical task being requested.
 * @param model Its registry entry.
 * @throws {TaskNotRoutableError} When the model is self-hosted.
 */
export function assertTaskIsRoutable(task: AiTask, model: ModelSpec): void {
  if (model.host === 'self_hosted') {
    throw new TaskNotRoutableError(
      `Task "${task}" maps to the self-hosted model "${model.id}", which this client cannot ` +
        `route. Embeddings run beside pgvector in the docker compose stack; see ` +
        `docs/architecture/ai-model-strategy.md §2, job 5 (question Q-010).`,
    );
  }
}

/**
 * Whether a failed attempt can be proven not to have been billed.
 *
 * An HTTP error status means the provider rejected the request and returned no completion.
 * OpenRouter was measured returning a 429 `engine_overloaded` billed at $0, and the same
 * holds for 4xx and 5xx generally: no tokens were delivered, so nothing was charged. The
 * reservation for such an attempt is released in full.
 *
 * Everything else — a timeout, a socket reset, a DNS failure — is treated as *possibly*
 * billed, because the model may well have generated a complete answer that never reached us.
 * Those attempts commit their whole reservation. That asymmetry is deliberate: guessing
 * "free" when we do not know is the mistake that lets a flaky network drain a budget.
 *
 * @param failure Error thrown by an attempt.
 * @returns True only when an HTTP error status was actually received.
 */
export function isProvablyUnbilled(failure: unknown): boolean {
  return failure instanceof ProviderRequestError && failure.status !== null;
}

/**
 * Shape a provider completion into the value callers receive.
 *
 * @param completion Normalised provider response, fresh or replayed from cache.
 * @param cacheHit   Whether it came from disk.
 * @param costUsd    USD committed to the ledger. Always `0` for a cache hit.
 * @returns The public result.
 */
export function toCompletionResult(
  completion: ProviderCompletion,
  cacheHit: boolean,
  costUsd: number,
): CompletionResult {
  return {
    content: completion.content,
    modelId: completion.modelId,
    finishReason: completion.finishReason,
    usage: completion.usage,
    cacheHit,
    costUsd,
    raw: completion.raw,
  };
}
