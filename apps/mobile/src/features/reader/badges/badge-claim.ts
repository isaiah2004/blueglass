/**
 * Which badge teasers are somebody's reading rather than a fact, and how they must be marked.
 *
 * Purpose
 *   Decision `Q-015`: Hajime Murai's division of the text ships **attributed inline** as
 *   "Murai's reading", and must never be presented as settled fact. The server already sends
 *   the attribution — `interpretiveClaim` and `attributedTo` on the `[History]` payload — but
 *   it also folds the interpretive title into the badge's one-line `teaser`, which the reader
 *   prints in two places: beside the pill in the open sheet, and in the chapter-end summary.
 *   Printed bare, both read as the app asserting a pericope heading that is not in the text.
 *
 *   So the rule lives here, once, as a pure function. Every surface that prints a teaser asks
 *   this module whether that teaser owes an attribution, and no surface has to remember the
 *   decision on its own.
 *
 * Why the whole claim travels or none of it does
 *   `historical-badge.types.ts` states the same contract: `passageTitle`,
 *   `interpretiveClaim` and `attributedTo` are present together or absent together. A title
 *   whose scholar could not be resolved is not a weakly-attributed heading, it is an
 *   unattributed one — so this returns `undefined` and the teaser is left as the server's
 *   plain fallback ("AD 47 - the world around this passage"), which asserts nothing.
 *
 * What this is NOT
 *   It is not the sheet's Murai note. `features/sheets/textual/history/dating-notice.ts`
 *   owns the full paragraph that explains what a Murai pericope is, and it renders inside the
 *   sheet body. This is the short inline mark that sits beside the claim itself, which is
 *   what `Q-015` asks for and what a summary row has room for.
 *
 * Dependencies
 *   This folder's models. Pure — no React, no I/O, Node-testable.
 */

import type { ReaderBadge } from './badge-models';

/** An inline attribution: whose reading this is, and who they are. */
export interface InterpretiveClaim {
  /** The short mark shown beside the claim, e.g. `Murai's reading`. */
  readonly label: string;
  /** The scholar it belongs to, e.g. `Hajime Murai`. */
  readonly attributedTo: string;
}

/**
 * The inline attribution a badge's teaser owes, if it owes one.
 *
 * @param badge - Any reader badge.
 * @returns The claim to print beside the teaser, or `undefined` when the teaser states only
 *   sourced facts. Side effects: none.
 *
 * @example
 * interpretiveClaimOf(historyBadge)?.label; // "Murai's reading"
 */
export function interpretiveClaimOf(badge: ReaderBadge): InterpretiveClaim | undefined {
  if (badge.kind !== 'history') {
    return undefined;
  }

  const { passageTitle, interpretiveClaim, attributedTo } = badge.payload;
  if (passageTitle === undefined || interpretiveClaim === undefined || attributedTo === undefined) {
    return undefined;
  }

  return { label: interpretiveClaim, attributedTo };
}

/**
 * How a screen reader hears an attributed teaser.
 *
 * The visual mark is a separate node beside the text, which a screen reader would otherwise
 * read as a disconnected fragment after the claim it qualifies. Composing one sentence keeps
 * the attribution attached to the thing it attributes.
 *
 * @param teaser - The badge's one-line claim.
 * @param claim - The attribution, from {@link interpretiveClaimOf}.
 * @returns The sentence, or the teaser unchanged when there is nothing to attribute.
 *   Side effects: none.
 */
export function attributedTeaserLabel(
  teaser: string,
  claim: InterpretiveClaim | undefined,
): string {
  return claim === undefined ? teaser : `${teaser}. ${claim.label}, ${claim.attributedTo}.`;
}
