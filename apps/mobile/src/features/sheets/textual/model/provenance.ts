/**
 * Whether a badge may be rendered at all, and what its attribution strip prints.
 *
 * Purpose
 *   Decision `AI-05`: every badge payload names its source and licence, the UI displays
 *   that attribution, and **a badge with no provenance must not render**. That is a rule
 *   about content, not about layout, so it lives here as a pure predicate the sheets call
 *   before they draw anything — rather than as an `if` buried in three components that
 *   would each have to remember it.
 *
 * Key responsibilities
 *   - Decide whether a source entry is printable, and whether a badge as a whole is.
 *   - Deduplicate the strip: four Root sources routinely share one attribution line
 *     (STEPBible publishes TBESG, TAGNT and our alignment note under the same wording),
 *     and printing it four times reads as a bug.
 *   - Produce the one-line summary the accessibility label uses.
 *
 * Why the licence identifier is printed verbatim
 *   `license` is an SPDX-style string — `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC0-1.0`. Prettifying
 *   it into `CC BY 4.0` means writing a transform that has to be right for every identifier
 *   the ingest may ever emit, and being wrong about a licence name is exactly the class of
 *   error `AI-05` exists to prevent. The identifier is unambiguous as it stands.
 *
 * Dependencies
 *   `@atlas/shared` for `SourceAttribution`. Pure — no React, no I/O, Node-testable.
 */

import type { SourceAttribution } from '@atlas/shared';

/**
 * What a sheet says instead of its content when the payload arrives unattributed.
 *
 * It is deliberately not a blank surface: the reader tapped a pill and is owed an answer,
 * and "we will not show you an unsourced claim" is a better answer than nothing happening.
 */
export const UNATTRIBUTED_COPY =
  'This card carries no source attribution, so its content is not shown. Every claim in Atlas Bible names the dataset it came from.';

/**
 * Whether one source entry can be printed as attribution.
 *
 * Both halves are required: the attribution line is what the licence obliges us to print,
 * and the licence identifier is what tells a reader — and `Q-007`'s redistribution rule —
 * what the terms are. An entry missing either is not attribution, it is a name.
 *
 * @param source - One provenance entry from the badge envelope.
 * @returns True when the entry names both an attribution line and a licence.
 *   Side effects: none.
 */
export function isPrintableSource(source: SourceAttribution): boolean {
  return source.attribution.trim() !== '' && source.license.trim() !== '';
}

/**
 * The sources a strip should print, in order, with repeats removed.
 *
 * Deduplication is on the attribution line rather than on `key`, because the line is what
 * the reader sees: two datasets published by the same body under the same wording produce
 * one visible row, and printing it twice would look like a rendering fault rather than
 * like thorough sourcing.
 *
 * @param sources - Every provenance entry the badge carries.
 * @returns The printable entries, first occurrence of each attribution line kept.
 *   Side effects: none.
 *
 * @example
 * printableSources(badge.sources).map((source) => source.attribution);
 */
export function printableSources(
  sources: readonly SourceAttribution[],
): readonly SourceAttribution[] {
  const seen = new Set<string>();
  const kept: SourceAttribution[] = [];

  for (const source of sources) {
    if (!isPrintableSource(source)) {
      continue;
    }
    const line = source.attribution.trim();
    if (seen.has(line)) {
      continue;
    }
    seen.add(line);
    kept.push(source);
  }

  return kept;
}

/**
 * Whether a badge may render its payload.
 *
 * @param sources - The badge envelope's `sources`.
 * @returns True when at least one printable attribution survives. Side effects: none.
 */
export function hasProvenance(sources: readonly SourceAttribution[]): boolean {
  return printableSources(sources).length > 0;
}

/**
 * One line naming every dataset behind a sheet, for an accessibility label.
 *
 * Screen readers should not have to walk a strip of chips to learn where a claim came
 * from, so the strip carries this as its own label.
 *
 * @param sources - The badge envelope's `sources`.
 * @returns A sentence, or an empty string when nothing is printable. Side effects: none.
 *
 * @example
 * provenanceSummary(sources); // 'Sources: OpenBible.info Cross References (CC-BY-4.0).'
 */
export function provenanceSummary(sources: readonly SourceAttribution[]): string {
  const printable = printableSources(sources);
  if (printable.length === 0) {
    return '';
  }
  const named = printable.map((source) => `${source.name} (${source.license})`);

  return `Sources: ${named.join('; ')}.`;
}

/**
 * Whether any source behind a sheet is copyleft.
 *
 * `Q-007` keeps share-alike from ever triggering by never redistributing the database, so
 * this is not a warning to the reader — it is the signal a QA pass and a future bundling
 * decision need, surfaced as data rather than rediscovered by reading licence strings.
 *
 * @param sources - The badge envelope's `sources`.
 * @returns True when at least one printable source is share-alike. Side effects: none.
 */
export function hasShareAlikeSource(sources: readonly SourceAttribution[]): boolean {
  return printableSources(sources).some((source) => source.shareAlike);
}
