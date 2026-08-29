/**
 * How a licence identifier is printed beside the notice it belongs to.
 *
 * Purpose
 *   `AI-05` requires the licence behind every rendered claim to be stated. It does not
 *   require it to be stated twice, and it certainly does not require it to be broken in
 *   half. Both happened: the attribution strip printed
 *
 *       Cross-references © OpenBible.info, CC BY 4.0
 *       CC-BY-4.0
 *
 *   — the same licence in two spellings on consecutive lines — and in the desktop rail the
 *   second one wrapped after its first hyphen, so `CC-` sat at the end of one line and
 *   `BY-4.0` began the next. The surface `AI-05` makes non-optional should be the tidiest
 *   text on the sheet.
 *
 * The two rules, and why they live in `@atlas/shared`
 *   Two strips render provenance — `features/reader/badges/BadgeAttribution` and
 *   `features/sheets/spatial/SpatialSourceStrip` — and they had already drifted into two
 *   implementations. A rule about how a `SourceAttribution` is *displayed* belongs beside
 *   the type, so both strips get the same answer and a third cannot invent a fourth.
 *
 * Dependencies
 *   None. Pure string rules; no React, no I/O.
 */

/**
 * A hyphen that a line break may not fall on: U+2011 NON-BREAKING HYPHEN.
 *
 * Visually identical to `-` in every face the app ships. Substituting it is what makes an
 * identifier an unbreakable token without a platform-specific style, which matters because
 * `T-01` makes the web a first-class target and only the web breaks on hyphens.
 */
const NON_BREAKING_HYPHEN = '\u2011';

/** Everything that is not a letter or a digit, for comparing two spellings of one licence. */
const NOT_ALPHANUMERIC = /[^a-z0-9]+/g;

/**
 * The licence identifier as it should be printed.
 *
 * @param license - The SPDX-style identifier, e.g. `CC-BY-4.0`.
 * @returns The same identifier with every hyphen made unbreakable, so it can never be
 *   split across two lines. Side effects: none.
 */
export function licenceToken(license: string): string {
  return license.replaceAll('-', NON_BREAKING_HYPHEN);
}

/**
 * Whether an attribution sentence already names its own licence.
 *
 * Compared with every non-alphanumeric character removed, because the sentence the
 * licensor wrote spells it `CC BY 4.0` and the database column spells it `CC-BY-4.0`.
 * Those are one obligation, and printing both is noise rather than diligence.
 *
 * @param attribution - The line the licence obliges us to print, verbatim.
 * @param license - The SPDX-style identifier for the same source.
 * @returns True when the sentence contains the identifier, however either is punctuated.
 *   A blank licence returns false, so a missing identifier is never treated as "already
 *   said". Side effects: none.
 */
export function attributionStatesLicence(attribution: string, license: string): boolean {
  const needle = license.toLowerCase().replace(NOT_ALPHANUMERIC, '');
  if (needle === '') return false;
  return attribution.toLowerCase().replace(NOT_ALPHANUMERIC, '').includes(needle);
}

/**
 * What a strip should print as the licence chip, if anything.
 *
 * @param attribution - The verbatim notice.
 * @param license - The SPDX-style identifier.
 * @returns The unbreakable identifier, or `null` when the notice already states it — in
 *   which case the strip prints the notice alone. Side effects: none.
 */
export function licenceChip(attribution: string, license: string): string | null {
  if (license.trim() === '') return null;
  return attributionStatesLicence(attribution, license) ? null : licenceToken(license);
}
