/**
 * Core type vocabulary for `@atlas/ai-guard`.
 *
 * Purpose
 *   One place that defines every shape crossing the guard's boundaries, so the registry,
 *   the ledger, the cache, and the client all agree without importing each other.
 *
 * Key responsibilities
 *   - Name the logical AI tasks. Feature code references a task, never a model id.
 *   - Describe a model's price and capabilities (`ModelSpec`).
 *   - Describe the request/response contract the provider adapter must satisfy.
 *
 * Design note — the primary cost defence lives in this file
 *   `CompletionRequest.task` is a closed union of five string literals. There is no field
 *   anywhere in the public API that accepts a raw model id. Selecting an expensive frontier
 *   model from feature code is therefore a *compile* error: the parameter does not exist.
 *   The price ceiling in `registry.ts` closes the remaining hole — a maintainer editing the
 *   catalogue itself.
 *
 * Convention
 *   Optional data is modelled as `T | null`, never `T | undefined`, because the workspace
 *   compiles with `exactOptionalPropertyTypes` and an absent-vs-explicitly-undefined
 *   distinction buys nothing here but costs a great deal of ceremony at every call site.
 */

/**
 * The logical jobs the product performs with a language model.
 *
 * Adding a member forces a matching entry in `models.ts` (the record is exhaustive), which
 * in turn forces that entry through the price ceiling. There is no way to add a task
 * without pricing it.
 */
export type AiTask =
  'grounded_chat' | 'extract_structured' | 'editorial' | 'classify_cheap' | 'embed';

/**
 * Where a model is served from.
 *
 * `self_hosted` models cost nothing per call and are not routable through OpenRouter.
 * `embed` is the only one today: OpenRouter sells zero embedding models (verified across
 * all 388 in `docs/architecture/ai-model-strategy.md` §2), so embeddings are self-hosted.
 */
export type ModelHost = 'openrouter' | 'self_hosted';

/**
 * Whether a model bills hidden reasoning tokens as output.
 *
 * `mandatory` models cannot be told to stop reasoning, so every call carries a token tax
 * that the cost estimate must account for. Measured at 93 billed reasoning tokens even at
 * `effort: low` — see the model strategy document §3.
 */
export type ReasoningMode = 'none' | 'optional' | 'mandatory';

/**
 * Everything the guard needs to know about one model.
 *
 * Prices are US dollars per one million tokens, as published by the provider. They are a
 * measured snapshot, not a recollection; the source and date are recorded in `models.ts`.
 */
export interface ModelSpec {
  /** Provider-side model id, e.g. `mistralai/mistral-small-3.2-24b-instruct`. */
  readonly id: string;
  readonly host: ModelHost;
  /** USD per 1M prompt tokens. */
  readonly inputPerMTok: number;
  /** USD per 1M completion tokens, reasoning tokens included. */
  readonly outputPerMTok: number;
  readonly contextWindow: number;
  /** Default completion cap. Also the pessimistic output figure used when reserving. */
  readonly maxOutputTokens: number;
  readonly supportsStructuredOutput: boolean;
  readonly supportsTools: boolean;
  readonly reasoning: ReasoningMode;
  /** Pin providers to stabilise latency. `null` lets the router choose. */
  readonly providerOrder: readonly string[] | null;
  /**
   * Model used when the primary returns 429 or 5xx.
   *
   * Deliberately a full `ModelSpec` and not a bare id: a fallback is validated against the
   * price ceiling exactly like a primary, so a cheap model cannot smuggle in an expensive
   * understudy.
   */
  readonly fallback: ModelSpec | null;
}

/** One message in a chat completion request. */
export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Sampling parameters. Every field participates in the cache key, so changing any of them
 * produces a different key and cannot return a stale response.
 */
export interface CompletionParams {
  /** `0` is the default and the only value cached without a seed. */
  readonly temperature: number;
  /** Overrides the model's `maxOutputTokens`. Never allowed to exceed it. */
  readonly maxOutputTokens: number | null;
  /** Provider seed. Present means the request is reproducible, so it is cacheable. */
  readonly seed: number | null;
  /** Strict JSON schema for structured output; `null` when unused. Shape is provider-defined. */
  readonly responseSchema: unknown;
}

/** What feature code hands to `AiClient.complete`. */
export interface CompletionRequest {
  readonly task: AiTask;
  readonly messages: readonly ChatMessage[];
  readonly params?: Partial<CompletionParams>;
  /**
   * Skip the cache read for this one call. This is NOT a budget bypass — the call still
   * reserves and commits against the ledger like any other.
   */
  readonly bypassCache?: boolean;
}

/** Token counts and cost as reported by the provider for a single request. */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  /**
   * The provider's own USD figure for this request (OpenRouter `usage.cost`).
   *
   * `null` when the provider omitted it, in which case the ledger falls back to
   * token arithmetic and then, failing that, to the full reservation. Metering on this
   * field rather than `GET /api/v1/credits` is mandated by CLAUDE.md: the credits
   * endpoint settles asynchronously and a guard polling it can be raced.
   */
  readonly reportedCostUsd: number | null;
}

/** A provider's answer, normalised. */
export interface ProviderCompletion {
  readonly modelId: string;
  readonly content: string;
  readonly finishReason: string;
  readonly usage: TokenUsage;
  /** Full response envelope, kept so replayed cache entries stay analysable. */
  readonly raw: unknown;
}

/** A fully resolved request, ready to send. Built by the client, never by feature code. */
export interface ProviderRequest {
  readonly model: ModelSpec;
  readonly messages: readonly ChatMessage[];
  readonly params: CompletionParams;
}

/**
 * The seam every provider implementation fills.
 *
 * Tests inject a fake here. Nothing else in the package performs network I/O, so a test
 * suite that injects a fake provider is guaranteed to make zero paid calls.
 */
export interface ChatProvider {
  readonly name: string;
  createCompletion(request: ProviderRequest, signal: AbortSignal): Promise<ProviderCompletion>;
}

/** What `AiClient.complete` returns. */
export interface CompletionResult {
  readonly content: string;
  readonly modelId: string;
  readonly finishReason: string;
  readonly usage: TokenUsage;
  /** True when the answer came from disk. Cache hits always cost exactly `0`. */
  readonly cacheHit: boolean;
  /** USD actually committed to the ledger for this call. `0` on a cache hit. */
  readonly costUsd: number;
  readonly raw: unknown;
}
