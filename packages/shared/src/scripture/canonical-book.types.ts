/**
 * The shape of one row of the 66-book canonical table.
 *
 * Purpose
 *   `flutter-port-map.md` §8 risk 10 records a live data-corruption bug in the Flutter
 *   prototype: two functions map only three books between name and number, so adding a
 *   note anywhere else persists `book_number: 0`. The fix is one canonical table that
 *   every surface resolves through. This module types that table's rows.
 *
 * Key responsibilities
 *   - Name the canon metadata a row carries beyond what formatting needs.
 *   - Keep `CanonicalBook` structurally assignable to `BibleBook`, so any table row can
 *     be passed straight to `formatVerseReference` without an adapter.
 *
 * Dependencies
 *   `./verse-reference.types` only. Pure types; erased at build time.
 *
 * Note on the two book types
 *   `BibleBook` is the minimal identity a *reference* needs (rule 1.4, interface
 *   segregation): a note or a citation should not have to carry alias lists around.
 *   `CanonicalBook` is a row of the canon — a `BibleBook` plus the metadata only the
 *   lookup table and the reference picker need.
 */

import type { BibleBook } from './verse-reference.types';

/**
 * Which half of the canon a book belongs to.
 *
 * Values match the Flutter prototype and the API verbatim (`'ot' | 'nt'`), so a row can
 * round-trip through either without a translation table.
 */
export type Testament = 'ot' | 'nt';

/**
 * A 1-based position in the Protestant canon: Genesis = 1 … Revelation = 66.
 *
 * Kept as `number` rather than a 66-member literal union: the union produces unusable
 * error messages and forces a cast at every API boundary, where the value arrives as a
 * plain integer anyway. Range is enforced at the boundary by `bookFromAny`.
 */
export type BookNumber = number;

/**
 * One book of the Protestant canon, with everything needed to resolve, route to, and
 * display it.
 *
 * Ordering, names, and chapter counts are KJV versification, transcribed from
 * `A:\Work\spark\spark-app\app\lib\data\books.dart` (which matches the API's
 * `server/app/scripture/books.py`). Neither source may be edited; both are read-only.
 */
export interface CanonicalBook extends BibleBook {
  /**
   * OSIS code as the API emits it, e.g. `1Cor`, `Ps`, `Song`. Case is significant here
   * because it is echoed in `osis_id` strings such as `Prov.1.1`.
   */
  readonly osis: string;
  /** Old or New Testament. */
  readonly testament: Testament;
  /**
   * Every normalised token that resolves to this book — canonical name, OSIS code, and
   * curated abbreviations. Already lowercased and stripped of spaces and punctuation by
   * `normaliseBookToken`, so a lookup never re-normalises the table.
   */
  readonly aliases: readonly string[];
}
