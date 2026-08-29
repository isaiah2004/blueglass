/**
 * Which of a badge's citations are worth a chip of their own.
 *
 * Purpose
 *   `design-language.md` §8.3 wants a visible source chip beside every claim, and `AI-05`
 *   makes it non-optional. `BadgeDetail` already prints the full attribution strip below the
 *   claim, so a chip only earns its place when it says something that strip does not.
 *
 * The defect this rule removes
 *   Every citation the M2 builders emit is `source_citation(...)`, whose `label` **is** the
 *   dataset's attribution string — the very sentence the strip below prints verbatim. A Root
 *   badge therefore showed "STEP Bible — www.STEPBible.org (CC BY 4.0)" twice as two
 *   identical chips (TBESG and TAGNT are two files of one project under one attribution),
 *   and then the strip printed the whole set again: two facts, four chips, four lines, on a
 *   375 dp sheet. The reader learned nothing from any repetition and lost the room.
 *
 * The rule
 *   Fold chips by their text, then drop any chip the attribution strip is already going to
 *   print. What survives is evidence the strip cannot carry — a citation pointing at a
 *   specific verse, manuscript or lexicon entry rather than at a dataset. For every badge M2
 *   ships today that is nothing at all, and nothing is the honest answer: the sources are
 *   the evidence, and they are printed once.
 *
 * Dependencies
 *   This folder's `attribution-lines` and models. Pure — no React, Node-testable.
 */

import { attributionLines } from './attribution-lines';
import type { Citation, SourceAttribution } from './badge-models';

/**
 * The citations worth showing as chips.
 *
 * @param citations - Every citation on the badge, in the server's order.
 * @param sources - The sources the attribution strip prints below.
 * @returns One chip per distinct claim the strip does not already make, in first-seen
 *   order. Side effects: none — neither input is mutated.
 */
export function distinctEvidence(
  citations: readonly Citation[],
  sources: readonly SourceAttribution[],
): readonly Citation[] {
  const alreadyPrinted = new Set(attributionLines(sources).map((line) => line.attribution));
  const seen = new Set<string>();
  const chips: Citation[] = [];

  for (const citation of citations) {
    const label = citation.label.trim();
    if (label === '' || alreadyPrinted.has(label) || seen.has(label)) {
      continue;
    }
    seen.add(label);
    chips.push(citation);
  }

  return chips;
}
