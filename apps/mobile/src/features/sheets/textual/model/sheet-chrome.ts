/**
 * How much chrome a textual sheet draws around its own body.
 *
 * Purpose
 *   These three sheets have two homes with two different amounts of surrounding furniture.
 *   Opened on their own — `/spike/textual-sheets`, a deep link, the Discover tab — they are
 *   standalone and must draw their own heading and their own `AI-05` source strip. Opened
 *   from an inline badge they are the *body* of `features/reader/badges/BadgeDetail`, which
 *   has already drawn the pill, the reference, the teaser and the attribution strip.
 *
 *   Drawing them again prints the sources twice under one badge. That reads as a bug, and it
 *   dilutes the one thing `AI-05` is about: a reader who sees the same licence sentence four
 *   times stops reading any of them.
 *
 * What `body` does NOT drop
 *   Anything that carries a claim. The Murai note, the dating rationale, the lemma, the
 *   timeline and the linked passages are the sheet; only the frame around them is optional.
 *   In particular the provenance **gate** still applies — `TextualSheet` refuses an
 *   unattributed payload in both modes, because a host that prints attribution has by
 *   definition attribution to print, and if it does not then refusing is the whole point.
 *
 * Why it mirrors the spatial folder's own type rather than importing it
 *   `features/sheets/spatial/model/spatial-payload.types.ts` declares the identical union.
 *   Neither folder imports the other (rule 5.3.3) — they are siblings, not layers — so the
 *   two-value union is stated twice rather than creating a dependency between two features
 *   that otherwise share nothing.
 *
 * Dependencies
 *   None. A pure type.
 */

/** `full` — standalone: heading and source strip drawn here. `body` — inside a host that
 * already draws both. */
export type SheetChrome = 'full' | 'body';
