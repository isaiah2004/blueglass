/**
 * Cost arithmetic — the single pricing authority for `@atlas/ai-guard`.
 *
 * Purpose
 *   Convert tokens into dollars. The ledger reserves against `estimateWorstCaseCostUsd`
 *   before a call and settles against `resolveActualCostUsd` after it, so both directions
 *   of the money flow come from this one module.
 *
 * Key responsibilities
 *   - Estimate prompt size before the provider has counted it.
 *   - Produce a deliberately *pessimistic* pre-call cost, so a reservation can only ever be
 *     too large. An optimistic reservation is the one bug that could let a loop overspend.
 *   - Turn a provider `usage` block into the dollar figure that gets committed.
 *
 * The bias rule
 *   Every estimate in this file rounds against the caller. Over-reserving stops work early
 *   and costs nothing but inconvenience; under-reserving spends money that was never
 *   authorised. The asymmetry is intentional and should not be "optimised".
 *
 * Dependencies
 *   Pure functions over `ModelSpec` and `TokenUsage`. No I/O, no clock, no randomness.
 */

import type { ModelSpec, TokenUsage } from './types';

/**
 * Characters per token used when estimating a prompt before the provider counts it.
 *
 * English text runs about 4 characters per token; KJV English measured at roughly 1.24
 * tokens per word in the model-strategy benchmark. Three is deliberately low so the derived
 * token count comes out high.
 */
const PESSIMISTIC_CHARS_PER_TOKEN = 3;

/**
 * Flat token allowance added per message for role markers, chat-template scaffolding, and
 * the provider's own framing, none of which appear in `content`.
 */
const PER_MESSAGE_OVERHEAD_TOKENS = 8;

/**
 * Multiplier applied to the output allowance for models that always emit billed reasoning
 * tokens. Measured: 93 reasoning tokens inside a 432-token completion even at `effort: low`
 * (model strategy §3), i.e. about 1.27x. Rounded up to 1.5 in keeping with the bias rule.
 */
const MANDATORY_REASONING_MULTIPLIER = 1.5;

const TOKENS_PER_MILLION = 1_000_000;

/**
 * Estimate the prompt token count for a set of messages.
 *
 * Used only to size a reservation; the provider's own `prompt_tokens` replaces it at commit
 * time. Over-estimation is intended — see the bias rule in the module docstring.
 *
 * @param messages Messages that will be sent.
 * @returns A pessimistic token count, always at least `1`.
 */
export function estimatePromptTokens(messages: readonly { readonly content: string }[]): number {
  let tokens = 0;
  for (const message of messages) {
    tokens += Math.ceil(message.content.length / PESSIMISTIC_CHARS_PER_TOKEN);
    tokens += PER_MESSAGE_OVERHEAD_TOKENS;
  }
  return Math.max(1, tokens);
}

/**
 * Worst-case USD for one call, used as the amount to reserve before dialling out.
 *
 * Assumes the model emits its full output allowance, plus the reasoning tax when reasoning
 * cannot be switched off. Self-hosted models are priced at zero because they are.
 *
 * @param model            Model that will serve the call.
 * @param promptTokens     Estimated or known prompt tokens.
 * @param maxOutputTokens  Completion cap for this call; defaults to the model's own cap.
 * @returns Non-negative USD.
 *
 * @example
 * ```ts
 * // mistral-small-3.2-24b, 300 prompt tokens, 600-token cap
 * estimateWorstCaseCostUsd(model, 300, 600); // -> 0.0001425
 * ```
 */
export function estimateWorstCaseCostUsd(
  model: ModelSpec,
  promptTokens: number,
  maxOutputTokens: number = model.maxOutputTokens,
): number {
  const billedOutputTokens =
    model.reasoning === 'mandatory'
      ? maxOutputTokens * MANDATORY_REASONING_MULTIPLIER
      : maxOutputTokens;
  const inputCost = (promptTokens * model.inputPerMTok) / TOKENS_PER_MILLION;
  const outputCost = (billedOutputTokens * model.outputPerMTok) / TOKENS_PER_MILLION;
  const total = inputCost + outputCost;
  return Number.isFinite(total) && total > 0 ? total : 0;
}

/**
 * Cost from token counts, for providers that do not report a dollar figure.
 *
 * @param model Model that served the call.
 * @param usage Reported token counts.
 * @returns USD, or `null` when the token counts are unusable.
 */
function costFromTokenCounts(model: ModelSpec, usage: TokenUsage): number | null {
  const { promptTokens, completionTokens } = usage;
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) {
    return null;
  }
  if (promptTokens < 0 || completionTokens < 0) {
    return null;
  }
  return (
    (promptTokens * model.inputPerMTok + completionTokens * model.outputPerMTok) /
    TOKENS_PER_MILLION
  );
}

/**
 * Decide what to actually charge the ledger for a completed call.
 *
 * Order of preference, and why:
 *   1. `usage.reportedCostUsd` — the provider's own figure. CLAUDE.md mandates metering on
 *      this rather than on `GET /api/v1/credits`, which settles asynchronously (measured lag
 *      up to a minute) and can therefore be raced through the ceiling by a fast loop.
 *   2. Token arithmetic against the registry price, when the provider omitted the cost.
 *   3. The full reservation, when neither is usable. Refusing to release money we cannot
 *      account for is the fail-closed choice.
 *
 * @param model      Model that served the call.
 * @param usage      Usage block from the provider.
 * @param reservedUsd The amount reserved for this call, used as the last-resort figure.
 * @returns Non-negative USD to commit.
 */
export function resolveActualCostUsd(
  model: ModelSpec,
  usage: TokenUsage,
  reservedUsd: number,
): number {
  const reported = usage.reportedCostUsd;
  if (reported !== null && Number.isFinite(reported) && reported >= 0) {
    return reported;
  }
  const computed = costFromTokenCounts(model, usage);
  if (computed !== null) {
    return computed;
  }
  return Math.max(0, reservedUsd);
}
