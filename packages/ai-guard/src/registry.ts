/**
 * Model registry — validation, and the price ceiling that makes a frontier model
 * unregisterable.
 *
 * Purpose
 *   Take the raw catalogue in `models.ts` and admit it only if every entry, and every
 *   fallback of every entry, is cheap enough and internally coherent. `resolveModel` is the
 *   only supported way to turn a logical task into a model.
 *
 * Key responsibilities
 *   - Reject any model whose input or output price exceeds the configured ceiling.
 *   - Reject structurally invalid entries (negative prices, an output cap larger than the
 *     context window, a cyclic fallback chain).
 *   - Expose the validated registry and a task-to-model lookup.
 *
 * How "no frontier model, ever" is actually enforced — two independent layers
 *   1. **Compile time.** No public function in this package accepts a model id. The only
 *      selector is `AiTask`, a closed five-member union. Feature code cannot name a model,
 *      so it cannot name an expensive one. Passing `'gpt-5'` anywhere is a type error.
 *   2. **Import time.** `MODEL_REGISTRY` is built when this module is first imported. A
 *      catalogue entry priced above the ceiling throws `ModelPriceCeilingError` right then,
 *      before any caller has a chance to run. Editing `models.ts` to add an expensive model
 *      does not produce an expensive call; it produces a crash on startup.
 *   3. **Absolute maximum.** The ceiling passed to `defineRegistry` is itself checked against
 *      `ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK`. Neither an environment variable nor a direct call
 *      to `defineRegistry` can widen it; only editing `config.ts` can, which is a reviewable
 *      diff.
 *
 * Usage
 *   ```ts
 *   import { resolveModel } from './registry';
 *   const model = resolveModel('extract_structured');   // -> ModelSpec
 *   ```
 */

import { ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK, loadConfig } from './config';
import { ModelPriceCeilingError, RegistryConfigError } from './errors';
import { TASK_MODELS } from './models';
import type { AiTask, ModelSpec } from './types';

/** Every logical task, derived from the catalogue so it can never drift out of sync. */
export const AI_TASKS: readonly AiTask[] = Object.freeze(
  // Safe: `TASK_MODELS` is typed `Record<AiTask, ModelSpec>`, so its runtime keys are
  // exactly the members of `AiTask`. Deriving the list rather than restating it means a
  // newly added task appears here automatically.
  Object.keys(TASK_MODELS) as AiTask[],
);

/**
 * Check one model spec, and its whole fallback chain, against the price ceiling and the
 * structural rules.
 *
 * @param spec        Model to check.
 * @param ceilingPerMTok Maximum permitted USD per million tokens, for input and output alike.
 * @param label       Human-readable position of this spec, used in error messages.
 * @param visitedIds  Ids already seen on this fallback chain; guards against cycles.
 * @throws {ModelPriceCeilingError} If either price exceeds the ceiling.
 * @throws {RegistryConfigError}    If the spec is structurally invalid or cyclic.
 */
function assertSpecIsRegisterable(
  spec: ModelSpec,
  ceilingPerMTok: number,
  label: string,
  visitedIds: ReadonlySet<string>,
): void {
  if (spec.id.trim() === '') {
    throw new RegistryConfigError(`${label}: model id must not be empty.`);
  }
  if (visitedIds.has(spec.id)) {
    throw new RegistryConfigError(
      `${label}: fallback chain revisits "${spec.id}", which would loop forever.`,
    );
  }
  assertPricesAreSane(spec, label);
  assertPriceIsUnderCeiling(spec, 'input', spec.inputPerMTok, ceilingPerMTok);
  assertPriceIsUnderCeiling(spec, 'output', spec.outputPerMTok, ceilingPerMTok);
  assertWindowsAreSane(spec, label);

  if (spec.fallback !== null) {
    assertSpecIsRegisterable(
      spec.fallback,
      ceilingPerMTok,
      `${label} -> fallback`,
      new Set([...visitedIds, spec.id]),
    );
  }
}

/** Reject non-finite or negative prices before they can be compared to anything. */
function assertPricesAreSane(spec: ModelSpec, label: string): void {
  for (const [kind, price] of [
    ['input', spec.inputPerMTok],
    ['output', spec.outputPerMTok],
  ] as const) {
    if (!Number.isFinite(price) || price < 0) {
      throw new RegistryConfigError(
        `${label}: "${spec.id}" has an invalid ${kind} price (${price}). ` +
          `Prices must be finite and non-negative USD per million tokens.`,
      );
    }
  }
}

/** The money guard proper: one price, one ceiling, one loud failure. */
function assertPriceIsUnderCeiling(
  spec: ModelSpec,
  priceKind: 'input' | 'output',
  pricePerMTok: number,
  ceilingPerMTok: number,
): void {
  if (pricePerMTok > ceilingPerMTok) {
    throw new ModelPriceCeilingError({
      modelId: spec.id,
      priceKind,
      pricePerMTok,
      ceilingPerMTok,
    });
  }
}

/** Context and completion caps must be positive, and the cap must fit in the window. */
function assertWindowsAreSane(spec: ModelSpec, label: string): void {
  if (!Number.isInteger(spec.contextWindow) || spec.contextWindow <= 0) {
    throw new RegistryConfigError(
      `${label}: "${spec.id}" has a non-positive context window (${spec.contextWindow}).`,
    );
  }
  if (!Number.isInteger(spec.maxOutputTokens) || spec.maxOutputTokens <= 0) {
    throw new RegistryConfigError(
      `${label}: "${spec.id}" has a non-positive maxOutputTokens (${spec.maxOutputTokens}).`,
    );
  }
  if (spec.maxOutputTokens > spec.contextWindow) {
    throw new RegistryConfigError(
      `${label}: "${spec.id}" allows ${spec.maxOutputTokens} output tokens but its context ` +
        `window is only ${spec.contextWindow}.`,
    );
  }
}

/**
 * Validate a task-to-model catalogue and freeze it.
 *
 * Exported so tests can prove the ceiling rejects an expensive model without mutating the
 * real catalogue. Production code uses `MODEL_REGISTRY`.
 *
 * @param catalogue      Candidate entries, one per task.
 * @param ceilingPerMTok Maximum permitted USD per million tokens.
 * @returns The same catalogue, frozen, once every entry has passed.
 * @throws {ModelPriceCeilingError} If any model or fallback is priced above the ceiling.
 * @throws {RegistryConfigError}    If any entry is structurally invalid, or if `ceilingPerMTok`
 *   itself exceeds `ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK`.
 */
export function defineRegistry(
  catalogue: Readonly<Record<AiTask, ModelSpec>>,
  ceilingPerMTok: number,
): Readonly<Record<AiTask, ModelSpec>> {
  if (!Number.isFinite(ceilingPerMTok) || ceilingPerMTok < 0) {
    throw new RegistryConfigError(
      `Model price ceiling must be a finite, non-negative number; received ${ceilingPerMTok}.`,
    );
  }
  // `defineRegistry` is a public export, so without this a caller could simply ask for a
  // ceiling of $999/M and validate whatever they liked. The absolute maximum holds here too.
  if (ceilingPerMTok > ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK) {
    throw new RegistryConfigError(
      `A model price ceiling of $${ceilingPerMTok}/M exceeds the absolute maximum of ` +
        `$${ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK}/M. Atlas Bible uses cheap open-weight models ` +
        `only; that limit is hard-coded in packages/ai-guard/src/config.ts.`,
    );
  }
  for (const task of Object.keys(catalogue) as AiTask[]) {
    assertSpecIsRegisterable(catalogue[task], ceilingPerMTok, `task "${task}"`, new Set<string>());
  }
  return Object.freeze({ ...catalogue });
}

/**
 * The validated registry.
 *
 * Built at import time, deliberately: an over-priced catalogue entry crashes the process
 * before a single call can be made.
 */
export const MODEL_REGISTRY: Readonly<Record<AiTask, ModelSpec>> = defineRegistry(
  TASK_MODELS,
  loadConfig().modelPriceCeilingPerMTok,
);

/**
 * Look up the model for a logical task.
 *
 * @param task One of the five logical jobs.
 * @returns The validated `ModelSpec`. Never `undefined` — the registry is exhaustive.
 *
 * @example
 * ```ts
 * const model = resolveModel('classify_cheap');
 * // model.id === 'mistralai/mistral-nemo'
 * ```
 */
export function resolveModel(task: AiTask): ModelSpec {
  return MODEL_REGISTRY[task];
}
