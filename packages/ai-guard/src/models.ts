/**
 * The model catalogue — the single place in the codebase that names a model.
 *
 * Purpose
 *   Map each logical `AiTask` to a concrete model, its measured price, and its capabilities.
 *   Swapping a model is a **one-line change**: edit the `id` on the relevant entry. Nothing
 *   else in the repository contains a model id, so nothing else has to change with it.
 *
 * Key responsibilities
 *   - Hold the primary model for every task.
 *   - Hold each primary's fallback as a full spec, so a fallback is price-checked too.
 *   - Record where every number came from, so a future maintainer can re-measure rather
 *     than re-guess.
 *
 * Provenance
 *   Every price, context window, and capability flag below is transcribed from
 *   `docs/architecture/ai-model-strategy.md` (scout `model-scout`, 2026-08-28), which
 *   measured them against the live `GET /api/v1/models` list and six real paid calls.
 *   They are a snapshot: providers change prices. That document asks for a CI check that
 *   re-fetches the model list and fails the build when a registered price has risen.
 *
 * This file is data, not logic
 *   Validation — including the price ceiling that makes an expensive model unregisterable —
 *   lives in `registry.ts`. Import `resolveModel` from there; do not read this file directly.
 */

import type { AiTask, ModelSpec } from './types';

/**
 * Fallback for `grounded_chat`. Half the output price of the primary and a 1M window.
 *
 * Reasoning defaults to `high` on this model, which silently doubles cost, so the provider
 * adapter must send `reasoning: { enabled: false }`. That is why `reasoning` is `optional`
 * rather than `none` — the flag is a live instruction, not a description.
 */
const DEEPSEEK_V4_FLASH: ModelSpec = {
  id: 'deepseek/deepseek-v4-flash',
  host: 'openrouter',
  inputPerMTok: 0.0868,
  outputPerMTok: 0.1736,
  contextWindow: 1_048_576,
  maxOutputTokens: 1_200,
  supportsStructuredOutput: true,
  supportsTools: true,
  reasoning: 'optional',
  providerOrder: null,
  fallback: null,
};

/** Fallback for `extract_structured`. Ranked 2nd on the extraction benchmark (79 km error). */
const QWEN3_30B_A3B_INSTRUCT: ModelSpec = {
  id: 'qwen/qwen3-30b-a3b-instruct-2507',
  host: 'openrouter',
  inputPerMTok: 0.0481,
  outputPerMTok: 0.193,
  contextWindow: 262_144,
  // The provider caps `max_completion_tokens` at 32 000 on this model; 600 is the measured
  // requirement for the enrichment schema, so the cap is never in play.
  maxOutputTokens: 600,
  supportsStructuredOutput: true,
  supportsTools: true,
  reasoning: 'none',
  providerOrder: null,
  fallback: null,
};

/** Fallback for `editorial`. Strongest prose stylist per dollar in the cheap tier. */
const GEMMA_4_31B_IT: ModelSpec = {
  id: 'google/gemma-4-31b-it',
  host: 'openrouter',
  inputPerMTok: 0.09,
  outputPerMTok: 0.34,
  contextWindow: 262_144,
  maxOutputTokens: 2_000,
  supportsStructuredOutput: true,
  supportsTools: true,
  reasoning: 'none',
  providerOrder: null,
  fallback: null,
};

/** Fallback for `classify_cheap`. Better instruction-following if Nemo's tagging proves noisy. */
const LLAMA_31_8B_INSTRUCT: ModelSpec = {
  id: 'meta-llama/llama-3.1-8b-instruct',
  host: 'openrouter',
  inputPerMTok: 0.05,
  outputPerMTok: 0.08,
  contextWindow: 131_072,
  maxOutputTokens: 500,
  supportsStructuredOutput: true,
  supportsTools: true,
  reasoning: 'none',
  providerOrder: null,
  fallback: null,
};

/**
 * Primary/fallback pairs per logical task.
 *
 * `editorial` is the strategy document's `editorial_longform` under the task name this
 * package's public API uses. Same model, same price, shorter name.
 */
export const TASK_MODELS: Readonly<Record<AiTask, ModelSpec>> = {
  // Largest open-weight instruct model in the cheap tier (235B MoE, 22B active). Chosen for
  // refusal discipline: pillar 3 requires the model decline when retrieved context does not
  // support an answer. Non-reasoning, so there is no hidden token tax.
  grounded_chat: {
    id: 'qwen/qwen3-235b-a22b-2507',
    host: 'openrouter',
    inputPerMTok: 0.0875,
    outputPerMTok: 0.35,
    contextWindow: 262_144,
    maxOutputTokens: 1_200,
    supportsStructuredOutput: true,
    supportsTools: true,
    reasoning: 'none',
    providerOrder: null,
    fallback: DEEPSEEK_V4_FLASH,
  },

  // Won the measured extraction benchmark: 41 km mean coordinate error against 79 and 131.
  // `openai/gpt-oss-120b` is deliberately absent — it hallucinated a location not present in
  // the passage, which disqualifies it under pillar 3 regardless of price.
  extract_structured: {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    host: 'openrouter',
    inputPerMTok: 0.075,
    outputPerMTok: 0.2,
    contextWindow: 131_072,
    // Measured: 200 truncates mid-object every time, 262 is typical, 600 is headroom. This
    // was the most expensive-to-discover finding in the benchmark; do not lower it.
    maxOutputTokens: 600,
    supportsStructuredOutput: true,
    supportsTools: true,
    reasoning: 'none',
    // Provider assignment is non-deterministic and swung latency 5.9x between routes, so
    // this latency-sensitive path is pinned.
    providerOrder: ['DeepInfra'],
    fallback: QWEN3_30B_A3B_INSTRUCT,
  },

  // Chapter summaries and dual-host podcast scripts. Prose quality was NOT benchmarked —
  // this row is estimated from model class and must be re-tested before the podcast
  // pipeline ships (model strategy §2, job 3).
  editorial: {
    id: 'qwen/qwen3-235b-a22b-2507',
    host: 'openrouter',
    inputPerMTok: 0.0875,
    outputPerMTok: 0.35,
    contextWindow: 262_144,
    maxOutputTokens: 2_000,
    supportsStructuredOutput: true,
    supportsTools: true,
    reasoning: 'none',
    fallback: GEMMA_4_31B_IT,
    providerOrder: null,
  },

  // The cheapest model on OpenRouter that still supports structured outputs *and* tools.
  classify_cheap: {
    id: 'mistralai/mistral-nemo',
    host: 'openrouter',
    inputPerMTok: 0.019,
    outputPerMTok: 0.03,
    contextWindow: 131_072,
    maxOutputTokens: 500,
    supportsStructuredOutput: true,
    supportsTools: true,
    reasoning: 'none',
    providerOrder: null,
    fallback: LLAMA_31_8B_INSTRUCT,
  },

  // OpenRouter sells zero embedding models — verified across all 388, it is structural
  // rather than an oversight (question `Q-010`). Embeddings are self-hosted beside pgvector
  // in the existing docker compose stack, at $0.00 per embedding forever. BGE-M3 is
  // multilingual across Greek and Hebrew, which the word-roots feature requires.
  //
  // `AiClient` refuses this task with `TaskNotRoutableError` until a self-hosted embedding
  // provider exists. It is registered anyway so the price, dimensions, and window live in
  // the same audited place as everything else.
  embed: {
    id: 'BAAI/bge-m3',
    host: 'self_hosted',
    inputPerMTok: 0,
    outputPerMTok: 0,
    contextWindow: 8_192,
    // An embedding returns a vector, not tokens. Held at the minimum so the pessimistic
    // reservation for this entry is $0 by arithmetic and not by special-casing.
    maxOutputTokens: 1,
    supportsStructuredOutput: false,
    supportsTools: false,
    reasoning: 'none',
    providerOrder: null,
    fallback: null,
  },
};
