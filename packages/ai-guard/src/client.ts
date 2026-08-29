/**
 * `AiClient` — the only supported route from Atlas Bible code to a language model.
 *
 * Purpose
 *   Compose the registry, the cache, the ledger, and a provider into one call that cannot
 *   overspend. Feature code calls `complete(...)` and gets a grounded answer or a typed
 *   refusal; it never sees an HTTP client, a model id, or a dollar figure it can influence.
 *
 * The pipeline, in order
 *   1. Resolve the logical task to a model through the price-checked registry.
 *   2. Look in the disk cache. A hit returns immediately, having touched neither the ledger
 *      nor the network, and costs exactly zero.
 *   3. Reserve the pessimistic worst-case cost against the ledger. This can refuse.
 *   4. Call the provider under a timeout.
 *   5. Commit the provider's real reported cost.
 *   6. Write the response to the cache so the next identical request is free.
 *
 * Retries and the ledger
 *   Each attempt gets its own reservation and settles it before the next attempt begins, so
 *   an attempt can never be charged twice. Retries are bounded by `maxAttempts` and spaced
 *   by exponential backoff with jitter. A refusal from the ledger — `BudgetExhaustedError`
 *   or `RateLimitExceededError` — is never retried and never caught: it propagates straight
 *   out to the caller, because it is a decision rather than a fault.
 *
 * Enforcement is architectural, not conventional
 *   `OpenRouterProvider` is the only module in the repository that calls `fetch` against a
 *   model endpoint, and this class is the only thing that constructs it. Feature code that
 *   wanted to bypass the guard would have to add a new HTTP call of its own, which is a
 *   reviewable diff rather than an accident.
 *
 * Usage
 *   ```ts
 *   const client = createAiClient();
 *   const answer = await client.complete({
 *     task: 'grounded_chat',
 *     messages: [{ role: 'user', content: 'Summarise Acts 16:11-15.' }],
 *   });
 *   ```
 */

import { ResponseCache, computeCacheKey, isCacheable } from './cache';
import { loadConfig, type AiGuardConfig } from './config';
import { RequestTimeoutError } from './errors';
import { SpendLedger, createSpendLedger, type Reservation } from './ledger';
import { createLogger, type StructuredLogger } from './logger';
import { OpenRouterProvider } from './openrouter-provider';
import { estimatePromptTokens, estimateWorstCaseCostUsd, resolveActualCostUsd } from './pricing';
import { resolveModel } from './registry';
import {
  assertTaskIsRoutable,
  isProvablyUnbilled,
  resolveCompletionParams,
  toCompletionResult,
} from './request-plan';
import { computeBackoffDelayMs, isRetryableFailure, sleep, type RetryPolicy } from './retry';
import type {
  AiTask,
  ChatProvider,
  CompletionRequest,
  CompletionResult,
  ProviderCompletion,
  ProviderRequest,
} from './types';

/** Everything `AiClient` needs, all injectable so tests can run with no network at all. */
export interface AiClientDependencies {
  readonly provider: ChatProvider;
  readonly ledger: SpendLedger;
  readonly cache: ResponseCache;
  readonly config: AiGuardConfig;
  readonly logger: StructuredLogger;
  /** Injected so retry tests do not actually wait. */
  readonly sleep: (durationMs: number) => Promise<void>;
  /** Injected so backoff jitter is deterministic under test. */
  readonly randomSource: () => number;
}

/** One attempt's outcome: the response, and what it cost. */
interface AttemptOutcome {
  readonly completion: ProviderCompletion;
  readonly costUsd: number;
}

/**
 * The guarded model client.
 *
 * Owns: the order of cache, ledger, provider, and cache-write, plus the retry loop.
 * Does not own: pricing, key derivation, persistence, or transport — each of those has its
 * own module and its own tests.
 */
export class AiClient {
  readonly #dependencies: AiClientDependencies;
  readonly #retryPolicy: RetryPolicy;

  constructor(dependencies: AiClientDependencies) {
    this.#dependencies = dependencies;
    this.#retryPolicy = {
      maxAttempts: dependencies.config.maxAttempts,
      baseDelayMs: 250,
      maxDelayMs: 8_000,
    };
  }

  /**
   * Complete one request, through the cache and the budget guard.
   *
   * @param request Logical task, messages, and optional parameters.
   * @returns The completion, flagged with whether it was a cache hit and what it cost.
   * @throws {BudgetExhaustedError} If the spend ceiling has been reached.
   * @throws {RateLimitExceededError} If this process has made too many calls.
   * @throws {TaskNotRoutableError} If the task maps to a self-hosted model.
   * @throws {ProviderRequestError | RequestTimeoutError} If every attempt failed.
   */
  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const model = resolveModel(request.task);
    assertTaskIsRoutable(request.task, model);

    const params = resolveCompletionParams(model, request.params);
    const providerRequest: ProviderRequest = { model, messages: request.messages, params };
    const cacheKey = computeCacheKey({ model, messages: request.messages, params });
    const cacheable = isCacheable(params);

    if (cacheable && request.bypassCache !== true) {
      const cached = this.#dependencies.cache.read(request.task, cacheKey);
      if (cached !== null) {
        this.#dependencies.logger.debug('AI cache hit', {
          task: request.task,
          cache_key: cacheKey,
        });
        // Returns before the ledger is consulted. A cache hit is free by construction.
        return toCompletionResult(cached, true, 0);
      }
    }

    const outcome = await this.#executeWithRetries(request.task, providerRequest);
    if (cacheable) {
      this.#dependencies.cache.write(request.task, cacheKey, outcome.completion);
    }
    return toCompletionResult(outcome.completion, false, outcome.costUsd);
  }

  /**
   * Run attempts until one succeeds, the attempts run out, or the failure is not retryable.
   *
   * @param task            Logical task, for the ledger and the logs.
   * @param providerRequest Fully resolved request.
   * @returns The successful attempt's outcome.
   * @throws The final failure, unchanged.
   */
  async #executeWithRetries(
    task: AiTask,
    providerRequest: ProviderRequest,
  ): Promise<AttemptOutcome> {
    let completedAttempts = 0;
    for (;;) {
      completedAttempts += 1;
      try {
        return await this.#runOneAttempt(task, providerRequest);
      } catch (failure) {
        const canRetry =
          completedAttempts < this.#retryPolicy.maxAttempts && isRetryableFailure(failure);
        if (!canRetry) {
          throw failure;
        }
        const delayMs = computeBackoffDelayMs(
          completedAttempts,
          this.#retryPolicy,
          this.#dependencies.randomSource,
        );
        this.#dependencies.logger.warn('AI provider attempt failed; retrying', {
          task,
          model_id: providerRequest.model.id,
          attempt: completedAttempts,
          delay_ms: delayMs,
        });
        await this.#dependencies.sleep(delayMs);
      }
    }
  }

  /**
   * One reservation, one provider call, one settlement.
   *
   * The reservation is taken before the request goes out and is settled on every path out of
   * this method, so no attempt can leave the ledger holding money it will never account for
   * — except when the process dies, which leaves it pessimistically held, by design.
   *
   * @param task            Logical task.
   * @param providerRequest Fully resolved request.
   * @returns The completion and its committed cost.
   */
  async #runOneAttempt(task: AiTask, providerRequest: ProviderRequest): Promise<AttemptOutcome> {
    const { model, params } = providerRequest;
    const promptTokens = estimatePromptTokens(providerRequest.messages);
    const worstCaseUsd = estimateWorstCaseCostUsd(
      model,
      promptTokens,
      params.maxOutputTokens ?? model.maxOutputTokens,
    );

    // Not wrapped in try/catch on purpose: a refusal here must reach the caller untouched.
    const reservation = this.#dependencies.ledger.reserve(task, worstCaseUsd);

    // The catch deliberately covers the provider call ONLY. If it also covered the commit
    // below, a failing commit would send us into `#settleFailedAttempt`, which would settle
    // an already-settled reservation and throw `InvalidReservationError` — masking the real
    // failure. A commit that throws propagates untouched and leaves the reservation open,
    // which is the pessimistic outcome and the correct one.
    let completion: ProviderCompletion;
    try {
      completion = await this.#callProviderWithTimeout(providerRequest);
    } catch (failure) {
      this.#settleFailedAttempt(reservation, failure);
      throw failure;
    }

    const costUsd = resolveActualCostUsd(model, completion.usage, reservation.reservedUsd);
    this.#dependencies.ledger.commit(reservation, costUsd);
    return { completion, costUsd };
  }

  /**
   * Settle the reservation for an attempt that threw.
   *
   * Released in full when the provider returned an HTTP error, which is proof no tokens were
   * delivered. Committed in full otherwise, because a timeout or a dropped socket may hide a
   * completion that was generated and billed.
   */
  #settleFailedAttempt(reservation: Reservation, failure: unknown): void {
    if (isProvablyUnbilled(failure)) {
      this.#dependencies.ledger.release(reservation);
      return;
    }
    this.#dependencies.ledger.commit(reservation, reservation.reservedUsd);
  }

  /**
   * Call the provider, aborting it once the configured timeout elapses.
   *
   * @param providerRequest Fully resolved request.
   * @returns The provider's normalised completion.
   * @throws {RequestTimeoutError} If the timeout fired.
   */
  async #callProviderWithTimeout(providerRequest: ProviderRequest): Promise<ProviderCompletion> {
    const timeoutMs = this.#dependencies.config.requestTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    try {
      return await this.#dependencies.provider.createCompletion(providerRequest, controller.signal);
    } catch (failure) {
      if (controller.signal.aborted) {
        throw new RequestTimeoutError(timeoutMs, { cause: failure });
      }
      throw failure;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Build an `AiClient` with production defaults, overriding any dependency.
 *
 * @param overrides Dependencies to replace. Tests normally override `provider`, `ledger`,
 *   `cache`, and `config`; production code passes nothing.
 * @returns A ready client.
 *
 * @example
 * ```ts
 * const client = createAiClient({ provider: fakeProvider, config: testConfig });
 * ```
 */
export function createAiClient(overrides: Partial<AiClientDependencies> = {}): AiClient {
  const config = overrides.config ?? loadConfig();
  const logger = overrides.logger ?? createLogger('ai-guard');
  return new AiClient({
    config,
    logger,
    provider: overrides.provider ?? new OpenRouterProvider(),
    ledger: overrides.ledger ?? createSpendLedger(config, logger),
    cache: overrides.cache ?? new ResponseCache({ cacheDir: config.cacheDir, logger }),
    sleep: overrides.sleep ?? sleep,
    randomSource: overrides.randomSource ?? Math.random,
  });
}
