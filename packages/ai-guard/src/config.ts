/**
 * Configuration for `@atlas/ai-guard`, and the absolute limits configuration cannot escape.
 *
 * Purpose
 *   Turn environment variables into a validated, frozen `AiGuardConfig`. Every knob that
 *   affects money has a hard-coded absolute maximum in this file that an environment
 *   variable can only move *downward*.
 *
 * Key responsibilities
 *   - Parse and validate every `ATLAS_AI_*` variable, failing loudly on nonsense.
 *   - Enforce the absolute limits below, so a stray `export ATLAS_AI_CEILING_USD=500`
 *     is a startup error rather than a $500 bill.
 *   - Default tighter under CI than locally, because CI is where the runaway loops live.
 *
 * Why the ceiling is itself ceilinged
 *   A budget ceiling that any caller can raise is not a ceiling. Raising the guard's limit
 *   above `ABSOLUTE_MAX_CEILING_USD` requires editing this file, which means a diff, which
 *   means a human sees it. That is the whole point.
 *
 * Usage
 *   ```ts
 *   const config = loadConfig();            // reads process.env
 *   const testConfig = loadConfig({ ATLAS_AI_CEILING_USD: '0.10' });
 *   ```
 */

import { ConfigInvalidError } from './errors';

/**
 * The most the spend ledger may ever be configured to permit, in USD.
 *
 * Set against the project's stated AI budget. `docs/architecture/ai-model-strategy.md` §1
 * measured $4.57 actually remaining on the key while CLAUDE.md and the brief both say "~$2";
 * question `AI-01` settles which is real. Until it is settled this package assumes the
 * smaller figure, because assuming the larger one is the mistake that cannot be undone.
 */
export const ABSOLUTE_MAX_CEILING_USD = 2.0;

/** No model priced above this per million tokens may be registered, ever. */
export const ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK = 1.0;

/** Retries multiply cost. Five attempts is already generous for an idempotent call. */
export const ABSOLUTE_MAX_ATTEMPTS = 5;

/** A per-process lifetime call cap above this stops being a defence. */
export const ABSOLUTE_MAX_CALLS_PER_PROCESS = 5_000;

/** Fully validated guard configuration. */
export interface AiGuardConfig {
  /** Ledger file. Default is repo-local and gitignored, so `rm` is a complete reset. */
  readonly ledgerPath: string;
  readonly cacheDir: string;
  /** Cumulative USD the ledger will ever permit across every process that shares the file. */
  readonly ceilingUsd: number;
  readonly modelPriceCeilingPerMTok: number;
  readonly requestTimeoutMs: number;
  readonly maxAttempts: number;
  readonly maxCallsPerProcess: number;
  readonly maxCallsPerWindow: number;
  readonly rateWindowMs: number;
}

/** Environment shape this module reads. Narrower than `process.env` so tests stay honest. */
export type EnvironmentSource = Readonly<Record<string, string | undefined>>;

interface NumericBounds {
  readonly min: number;
  readonly max: number;
}

/**
 * Read one numeric environment variable, or fall back to a default.
 *
 * @param env       Environment to read from.
 * @param name      Variable name, e.g. `ATLAS_AI_CEILING_USD`.
 * @param fallback  Value used when the variable is absent or empty.
 * @param bounds    Inclusive permitted range. Out-of-range is an error, never a clamp —
 *                  silently clamping would let a typo look like it worked.
 * @returns The parsed number.
 * @throws {ConfigInvalidError} If the value is not a finite number or falls outside bounds.
 */
function readNumericSetting(
  env: EnvironmentSource,
  name: string,
  fallback: number,
  bounds: NumericBounds,
): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new ConfigInvalidError(`${name} must be a finite number; received "${raw}".`);
  }
  if (parsed < bounds.min || parsed > bounds.max) {
    throw new ConfigInvalidError(
      `${name}=${parsed} is outside the permitted range ${bounds.min}..${bounds.max}. ` +
        `Upper limits are hard-coded in packages/ai-guard/src/config.ts and are not ` +
        `raisable from the environment.`,
    );
  }
  return parsed;
}

/** Read a string setting, falling back when absent or blank. */
function readTextSetting(env: EnvironmentSource, name: string, fallback: string): string {
  const raw = env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw;
}

/** True when running under a CI runner, which gets tighter defaults than a developer laptop. */
function isContinuousIntegration(env: EnvironmentSource): boolean {
  const flag = env['CI'];
  return flag !== undefined && flag !== '' && flag !== '0' && flag.toLowerCase() !== 'false';
}

/**
 * Build the guard configuration from an environment.
 *
 * @param env Environment to read. Defaults to `process.env`.
 * @returns A frozen, validated configuration.
 * @throws {ConfigInvalidError} On any unparseable or out-of-range value.
 */
export function loadConfig(env: EnvironmentSource = process.env): AiGuardConfig {
  const underCi = isContinuousIntegration(env);
  const dataDir = readTextSetting(env, 'ATLAS_AI_DATA_DIR', '.cache/ai');

  return Object.freeze({
    ledgerPath: readTextSetting(env, 'ATLAS_AI_LEDGER_PATH', `${dataDir}/ledger.spend.json`),
    cacheDir: readTextSetting(env, 'ATLAS_AI_CACHE_DIR', `${dataDir}/responses`),
    // CI defaults to a twentieth of the local allowance: even a total guard failure inside
    // an unattended loop cannot reach a meaningful share of the budget.
    ceilingUsd: readNumericSetting(env, 'ATLAS_AI_CEILING_USD', underCi ? 0.05 : 0.5, {
      min: 0,
      max: ABSOLUTE_MAX_CEILING_USD,
    }),
    modelPriceCeilingPerMTok: readNumericSetting(
      env,
      'ATLAS_AI_PRICE_CEILING_PER_MTOK',
      ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK,
      { min: 0, max: ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK },
    ),
    requestTimeoutMs: readNumericSetting(env, 'ATLAS_AI_REQUEST_TIMEOUT_MS', 30_000, {
      min: 1_000,
      max: 120_000,
    }),
    maxAttempts: readNumericSetting(env, 'ATLAS_AI_MAX_ATTEMPTS', 3, {
      min: 1,
      max: ABSOLUTE_MAX_ATTEMPTS,
    }),
    maxCallsPerProcess: readNumericSetting(
      env,
      'ATLAS_AI_MAX_CALLS_PER_PROCESS',
      underCi ? 100 : 500,
      { min: 1, max: ABSOLUTE_MAX_CALLS_PER_PROCESS },
    ),
    maxCallsPerWindow: readNumericSetting(env, 'ATLAS_AI_MAX_CALLS_PER_WINDOW', 30, {
      min: 1,
      max: 600,
    }),
    rateWindowMs: readNumericSetting(env, 'ATLAS_AI_RATE_WINDOW_MS', 60_000, {
      min: 1_000,
      max: 3_600_000,
    }),
  });
}

/**
 * Reject a spend ceiling above the absolute maximum, wherever it came from.
 *
 * `loadConfig` already refuses an over-large `ATLAS_AI_CEILING_USD`, but `SpendLedger` is a
 * public export whose options are a plain object. Without this check, feature code could
 * sidestep the entire guard with `new SpendLedger({ ceilingUsd: 1000, ... })`. Calling it
 * from the ledger's constructor as well means the absolute maximum holds no matter which
 * door the guard was built through.
 *
 * @param ceilingUsd Requested ceiling.
 * @throws {ConfigInvalidError} If it is not a finite, non-negative number at or below
 *   `ABSOLUTE_MAX_CEILING_USD`.
 */
export function assertSpendCeilingIsPermitted(ceilingUsd: number): void {
  if (!Number.isFinite(ceilingUsd) || ceilingUsd < 0) {
    throw new ConfigInvalidError(
      `A spend ceiling must be a finite, non-negative number; received ${ceilingUsd}.`,
    );
  }
  if (ceilingUsd > ABSOLUTE_MAX_CEILING_USD) {
    throw new ConfigInvalidError(
      `A spend ceiling of $${ceilingUsd} exceeds the absolute maximum of ` +
        `$${ABSOLUTE_MAX_CEILING_USD}. That limit is hard-coded in ` +
        `packages/ai-guard/src/config.ts and cannot be raised from configuration.`,
    );
  }
}
