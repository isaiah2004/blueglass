/**
 * Public API of `@atlas/ai-guard`.
 *
 * Purpose
 *   The single import surface for reaching a language model from Atlas Bible code. Nothing
 *   outside this package may reach into `src/**` directly (rule 5.3.3), and nothing outside
 *   this package may call a model endpoint at all.
 *
 * Key responsibilities
 *   - Export the guarded client and its factory.
 *   - Export the registry lookup, so callers can inspect which model a task uses without
 *     being able to change it.
 *   - Export every error type, so callers can branch on a refusal.
 *
 * Where this package may be imported
 *   Node only — the backend, pre-compute scripts, and CLI tooling. It reads and writes the
 *   filesystem for its ledger and cache, so importing it from the Expo client would break
 *   the Metro bundle. The client talks to our own API, which talks to this.
 *
 * Deliberately not exported
 *   `internal-fs`, `file-lock`, `ledger-store`, `rate-limiter`, `request-plan`, and `models`
 *   are implementation details. `OpenRouterProvider` is exported only so that a future
 *   adapter can be tested against the same interface; feature code has no reason to name it.
 *
 * Usage
 *   ```ts
 *   import { createAiClient, BudgetExhaustedError } from '@atlas/ai-guard';
 *
 *   const client = createAiClient();
 *   try {
 *     const answer = await client.complete({
 *       task: 'extract_structured',
 *       messages: [{ role: 'user', content: passage }],
 *     });
 *   } catch (failure) {
 *     if (failure instanceof BudgetExhaustedError) {
 *       // The ceiling has been reached. There is no override; this is final.
 *     }
 *     throw failure;
 *   }
 *   ```
 */

export { AiClient, createAiClient, type AiClientDependencies } from './client';

export {
  loadConfig,
  ABSOLUTE_MAX_ATTEMPTS,
  ABSOLUTE_MAX_CALLS_PER_PROCESS,
  ABSOLUTE_MAX_CEILING_USD,
  ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK,
  type AiGuardConfig,
  type EnvironmentSource,
} from './config';

export { AI_TASKS, MODEL_REGISTRY, defineRegistry, resolveModel } from './registry';

export {
  SpendLedger,
  createSpendLedger,
  type LedgerSnapshot,
  type Reservation,
  type SpendLedgerOptions,
} from './ledger';

export { CACHE_SCHEMA_VERSION, ResponseCache, computeCacheKey, isCacheable } from './cache';

export { estimatePromptTokens, estimateWorstCaseCostUsd, resolveActualCostUsd } from './pricing';

export { OpenRouterProvider, type OpenRouterProviderOptions } from './openrouter-provider';

export { NULL_LOGGER, createLogger, type LogLevel, type StructuredLogger } from './logger';

export {
  AiGuardError,
  BudgetExhaustedError,
  ConfigInvalidError,
  InvalidReservationError,
  LedgerUnavailableError,
  ModelPriceCeilingError,
  ProviderRequestError,
  RateLimitExceededError,
  RegistryConfigError,
  RequestTimeoutError,
  TaskNotRoutableError,
  type AiGuardErrorCode,
} from './errors';

export type {
  AiTask,
  ChatMessage,
  ChatProvider,
  CompletionParams,
  CompletionRequest,
  CompletionResult,
  ModelHost,
  ModelSpec,
  ProviderCompletion,
  ProviderRequest,
  ReasoningMode,
  TokenUsage,
} from './types';
