/**
 * Ranking and describing cross-references.
 *
 * Purpose
 *   OpenBible publishes 344,799 community-voted links, and the vote count is the only signal
 *   the dataset carries about how strong a link is. The `[Cross-Ref]` sheet's whole job is to
 *   present that ranking honestly: strongest first, with the strength visible, so a reader
 *   following a thread through scripture knows which link is a consensus and which is one
 *   person's idea.
 *
 * Key responsibilities
 *   - Turn a vote count into a rank, a label, and a bar width.
 *   - Say what the relation is, without claiming more than the data supports.
 *   - Mark the rows whose text is only part of the passage they name.
 *
 * The relation is `parallel`, and that is a deliberate absence
 *   `CrossReferenceRelation` allows quotation, allusion, fulfilment and parallel. OpenBible
 *   publishes a vote count and nothing else — it does not say WHY two verses are linked — so
 *   every M2 cross-reference is the neutral `parallel` (`builders/crossref.py`). The other
 *   three labels are supported here so that a dataset which does distinguish them can be
 *   rendered without touching this sheet, and are never invented.
 *
 * The vote ceiling
 *   40 votes, matching `_VOTE_CEILING` in the server's builder. The strongest link in Acts 16
 *   has 43, and above about 40 a higher count stops telling a reader anything new — so the
 *   bar saturates rather than making a 43 look meaningfully stronger than a 41.
 *
 * Dependencies
 *   `@atlas/shared` for the target and relation types. Pure — no React, Node-testable.
 */

import type { CrossReferenceRelation, CrossReferenceTarget } from '@atlas/shared';

import { spansMultipleVerses } from '../model/verse-target';

/** Votes at which a link counts as maximally strong. Mirrors the server's `_VOTE_CEILING`. */
export const VOTE_CEILING = 40;

/** At or above this, the link is a settled consensus. */
const STRONG_VOTES = 30;

/** At or above this, the link is well attested. */
const ATTESTED_VOTES = 15;

/** How each relation is titled. */
const RELATION_TITLE: Record<CrossReferenceRelation, string> = {
  parallel: 'Parallel passages',
  quotation: 'Quoted here',
  allusion: 'Alluded to here',
  fulfilment: 'Fulfilled here',
};

/**
 * How strongly attested a link is, as a fraction.
 *
 * @param votes - The community vote count.
 * @returns A number from 0 to 1, saturating at {@link VOTE_CEILING}. Side effects: none.
 */
export function strengthRatio(votes: number): number {
  if (votes <= 0) {
    return 0;
  }

  return Math.min(1, votes / VOTE_CEILING);
}

/**
 * How strongly attested a link is, in words.
 *
 * @param votes - The community vote count.
 * @returns A short phrase. Side effects: none.
 *
 * @example
 * strengthLabel(43); // 'Strong consensus'
 */
export function strengthLabel(votes: number): string {
  if (votes >= STRONG_VOTES) {
    return 'Strong consensus';
  }
  if (votes >= ATTESTED_VOTES) {
    return 'Well attested';
  }

  return 'Attested';
}

/**
 * The vote count as the sheet prints it.
 *
 * @param votes - The community vote count.
 * @returns The count with its noun, agreeing in number. Side effects: none.
 */
export function votesLabel(votes: number): string {
  return `${String(votes)} ${votes === 1 ? 'vote' : 'votes'}`;
}

/**
 * What the list of links is called.
 *
 * @param relation - Why the passages are linked.
 * @returns The section title. Side effects: none.
 */
export function relationTitle(relation: CrossReferenceRelation): string {
  return RELATION_TITLE[relation];
}

/**
 * The caption above the list.
 *
 * It names the source of the ranking, because "strongest first" is meaningless without
 * knowing who is doing the voting.
 *
 * @param relation - Why the passages are linked.
 * @param count - How many are shown.
 * @returns The caption. Side effects: none.
 */
export function relationCaption(relation: CrossReferenceRelation, count: number): string {
  const passages = `${String(count)} ${count === 1 ? 'passage' : 'passages'}`;
  if (relation === 'parallel') {
    return `${passages}, ranked by how many readers voted the link worth making. OpenBible records the link, not the reason for it.`;
  }

  return `${passages}, ranked by how many readers voted the link worth making.`;
}

/**
 * The note under a row whose text is only part of the passage it names.
 *
 * The API populates `text` from the FIRST verse of a span. A reader shown "Acts 2:38-39" and
 * one verse of text would otherwise reasonably believe they had read both.
 *
 * @param target - One linked passage.
 * @returns The note, or `undefined` for a single verse. Side effects: none.
 */
export function targetNote(target: CrossReferenceTarget): string | undefined {
  if (!spansMultipleVerses(target.range)) {
    return undefined;
  }

  return `First verse of ${target.displayReference}. Open it to read the rest.`;
}

/**
 * The links in the order the sheet shows them.
 *
 * The server already sorts them, and this sorts them again. That is not distrust: the sheet
 * is also rendered from a cache, from a deep link, and from a fixture, and a list whose
 * order depends on which of those it came from is a list whose ranking cannot be relied on.
 *
 * @param targets - The payload's targets.
 * @returns Most-voted first, ties broken by canonical order so the sort is total.
 *   Side effects: none — the input array is not mutated.
 */
export function rankedTargets(
  targets: readonly CrossReferenceTarget[],
): readonly CrossReferenceTarget[] {
  return [...targets].sort(
    (left, right) =>
      right.votes - left.votes ||
      left.range.start.value - right.range.start.value ||
      left.range.end.value - right.range.end.value,
  );
}
