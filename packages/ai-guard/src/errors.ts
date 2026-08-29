/**
 * Typed errors for `@atlas/ai-guard`.
 *
 * Purpose
 *   Rule 6.1.3 forbids `throw new Error('not found')`. Every failure mode the guard can
 *   produce gets its own class and a stable machine-readable `code`, so callers can branch
 *   on the reason without string-matching a message.
 *
 * Key responsibilities
 *   - Give every guard failure a specific type and a stable code.
 *   - Carry enough structured context to be actionable in a log line (rule 7.2.2).
 *   - Preserve the original error via `cause` whenever one is wrapped (rule 6.2.2).
 *
 * The important one
 *   `BudgetExhaustedError` is thrown *instead of* calling the provider. It is deliberately
 *   never caught inside this package — no retry path, no fallback path, and no code path of
 *   any kind converts it back into a provider call.
 */

/** Stable, machine-readable failure codes. Never renumber or reuse a retired code. */
export type AiGuardErrorCode =
  | 'BUDGET_EXHAUSTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MODEL_PRICE_CEILING'
  | 'REGISTRY_CONFIG_INVALID'
  | 'CONFIG_INVALID'
  | 'LEDGER_UNAVAILABLE'
  | 'INVALID_RESERVATION'
  | 'PROVIDER_REQUEST_FAILED'
  | 'REQUEST_TIMEOUT'
  | 'TASK_NOT_ROUTABLE';

/**
 * Base class for everything this package throws.
 *
 * Responsibilities: carry a stable `code` and set `name` from the concrete subclass so a
 * serialised log entry identifies the failure precisely. It does not own retry policy —
 * `retry.ts` decides what is retryable.
 */
export class AiGuardError extends Error {
  readonly code: AiGuardErrorCode;

  constructor(code: AiGuardErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * The hard spend ceiling has been reached. The provider was NOT called.
 *
 * There is no override flag, no environment escape hatch, and no `force` parameter anywhere
 * in the public API that turns this back into a call. The only remedy is human action:
 * raise `ATLAS_AI_CEILING_USD` (capped at `ABSOLUTE_MAX_CEILING_USD`) or delete the ledger
 * file deliberately.
 */
export class BudgetExhaustedError extends AiGuardError {
  readonly ceilingUsd: number;
  readonly exposureUsd: number;
  readonly requestedUsd: number;

  constructor(details: { ceilingUsd: number; exposureUsd: number; requestedUsd: number }) {
    super(
      'BUDGET_EXHAUSTED',
      `AI spend ceiling reached: committed+reserved $${details.exposureUsd.toFixed(6)} ` +
        `plus requested $${details.requestedUsd.toFixed(6)} would exceed the ` +
        `$${details.ceilingUsd.toFixed(4)} ceiling. Refusing to call the provider.`,
    );
    this.ceilingUsd = details.ceilingUsd;
    this.exposureUsd = details.exposureUsd;
    this.requestedUsd = details.requestedUsd;
  }
}

/**
 * The per-process call cap fired. Second line of defence against a tight loop, so that a
 * runaway caller is stopped by call count long before it is stopped by dollars.
 */
export class RateLimitExceededError extends AiGuardError {
  readonly limitKind: 'process_total' | 'sliding_window';
  readonly limit: number;
  readonly observed: number;

  constructor(details: {
    limitKind: 'process_total' | 'sliding_window';
    limit: number;
    observed: number;
  }) {
    super(
      'RATE_LIMIT_EXCEEDED',
      `AI call rate cap (${details.limitKind}) exceeded: ${details.observed} calls against ` +
        `a limit of ${details.limit}. Refusing to call the provider.`,
    );
    this.limitKind = details.limitKind;
    this.limit = details.limit;
    this.observed = details.observed;
  }
}

/** A catalogue entry is priced above the per-million-token ceiling. Thrown at construction. */
export class ModelPriceCeilingError extends AiGuardError {
  readonly modelId: string;
  readonly pricePerMTok: number;
  readonly ceilingPerMTok: number;

  constructor(details: {
    modelId: string;
    priceKind: 'input' | 'output';
    pricePerMTok: number;
    ceilingPerMTok: number;
  }) {
    super(
      'MODEL_PRICE_CEILING',
      `Model "${details.modelId}" is too expensive to register: ${details.priceKind} price ` +
        `$${details.pricePerMTok}/M exceeds the $${details.ceilingPerMTok}/M ceiling. ` +
        `Atlas Bible uses cheap open-weight models only (CLAUDE.md, "Non-negotiable AI constraint").`,
    );
    this.modelId = details.modelId;
    this.pricePerMTok = details.pricePerMTok;
    this.ceilingPerMTok = details.ceilingPerMTok;
  }
}

/** A catalogue entry is internally inconsistent (negative price, output cap over context, ...). */
export class RegistryConfigError extends AiGuardError {
  constructor(message: string) {
    super('REGISTRY_CONFIG_INVALID', message);
  }
}

/** An environment variable is unparseable or out of its permitted range. */
export class ConfigInvalidError extends AiGuardError {
  constructor(message: string, options?: ErrorOptions) {
    super('CONFIG_INVALID', message, options);
  }
}

/**
 * The ledger could not be read, locked, or written.
 *
 * The guard fails closed on this: an unreadable ledger must never be interpreted as
 * "nothing spent yet", because that would reset the ceiling on every corruption.
 */
export class LedgerUnavailableError extends AiGuardError {
  constructor(message: string, options?: ErrorOptions) {
    super('LEDGER_UNAVAILABLE', message, options);
  }
}

/**
 * A reservation was settled twice, or settled after it had already been released.
 *
 * This exists specifically to make double-charging loud rather than silent: the second
 * `commit` for a given reservation id throws instead of adding cost a second time.
 */
export class InvalidReservationError extends AiGuardError {
  readonly reservationId: string;

  constructor(reservationId: string, message: string) {
    super('INVALID_RESERVATION', message);
    this.reservationId = reservationId;
  }
}

/** The provider returned a non-success status or an unusable body. */
export class ProviderRequestError extends AiGuardError {
  readonly status: number | null;

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super('PROVIDER_REQUEST_FAILED', message, options);
    this.status = status;
  }
}

/** The provider did not answer within the configured timeout. */
export class RequestTimeoutError extends AiGuardError {
  readonly timeoutMs: number;

  constructor(timeoutMs: number, options?: ErrorOptions) {
    super(
      'REQUEST_TIMEOUT',
      `AI provider request exceeded ${timeoutMs}ms and was aborted.`,
      options,
    );
    this.timeoutMs = timeoutMs;
  }
}

/** The task maps to a self-hosted model that this client cannot route (today: `embed`). */
export class TaskNotRoutableError extends AiGuardError {
  constructor(message: string) {
    super('TASK_NOT_ROUTABLE', message);
  }
}
