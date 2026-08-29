/**
 * The 66-book canonical table — the single source of truth for book identity.
 *
 * Purpose
 *   `flutter-port-map.md` §8 risk 10: the Flutter prototype maps only three books
 *   between name and number, so a note added in John persists `book_number: 0`. This
 *   table is the fix. Nothing in the app may hand-roll a book mapping; everything
 *   resolves through here.
 *
 * Provenance
 *   Numbers, names, chapter counts, and testaments transcribed from
 *   `A:\Work\spark\spark-app\app\lib\data\books.dart` lines 16-83. OSIS codes from
 *   `A:\Work\spark\spark-app\server\app\scripture\books.py`. Both are read-only source
 *   material and they agree on every row. Versification is KJV.
 *
 * Key responsibilities
 *   - Hold the canon as data, in canonical order, with no lookup logic.
 *   - Derive each row's route slug and alias set once, at module load.
 *
 * Dependencies
 *   `./book-token`, `./canonical-book.types`. Pure data; no I/O, no clock.
 *
 * Usage
 *   Import `bookFromAny` from `./book-lookup` instead of scanning this array by hand.
 */

import { normaliseBookToken } from './book-token';
import type { BookNumber, CanonicalBook, Testament } from './canonical-book.types';

/** How many books the Protestant canon contains. Genesis = 1 … Revelation = 66. */
export const CANONICAL_BOOK_COUNT = 66;

/** One row of source data, before slugs and aliases are derived. */
type BookRow = readonly [
  bookNumber: BookNumber,
  name: string,
  osis: string,
  chapterCount: number,
  testament: Testament,
];

/** The canon in order, exactly as the Flutter prototype and the API record it. */
const BOOK_ROWS: readonly BookRow[] = [
  [1, 'Genesis', 'Gen', 50, 'ot'],
  [2, 'Exodus', 'Exod', 40, 'ot'],
  [3, 'Leviticus', 'Lev', 27, 'ot'],
  [4, 'Numbers', 'Num', 36, 'ot'],
  [5, 'Deuteronomy', 'Deut', 34, 'ot'],
  [6, 'Joshua', 'Josh', 24, 'ot'],
  [7, 'Judges', 'Judg', 21, 'ot'],
  [8, 'Ruth', 'Ruth', 4, 'ot'],
  [9, '1 Samuel', '1Sam', 31, 'ot'],
  [10, '2 Samuel', '2Sam', 24, 'ot'],
  [11, '1 Kings', '1Kgs', 22, 'ot'],
  [12, '2 Kings', '2Kgs', 25, 'ot'],
  [13, '1 Chronicles', '1Chr', 29, 'ot'],
  [14, '2 Chronicles', '2Chr', 36, 'ot'],
  [15, 'Ezra', 'Ezra', 10, 'ot'],
  [16, 'Nehemiah', 'Neh', 13, 'ot'],
  [17, 'Esther', 'Esth', 10, 'ot'],
  [18, 'Job', 'Job', 42, 'ot'],
  [19, 'Psalms', 'Ps', 150, 'ot'],
  [20, 'Proverbs', 'Prov', 31, 'ot'],
  [21, 'Ecclesiastes', 'Eccl', 12, 'ot'],
  [22, 'Song of Solomon', 'Song', 8, 'ot'],
  [23, 'Isaiah', 'Isa', 66, 'ot'],
  [24, 'Jeremiah', 'Jer', 52, 'ot'],
  [25, 'Lamentations', 'Lam', 5, 'ot'],
  [26, 'Ezekiel', 'Ezek', 48, 'ot'],
  [27, 'Daniel', 'Dan', 12, 'ot'],
  [28, 'Hosea', 'Hos', 14, 'ot'],
  [29, 'Joel', 'Joel', 3, 'ot'],
  [30, 'Amos', 'Amos', 9, 'ot'],
  [31, 'Obadiah', 'Obad', 1, 'ot'],
  [32, 'Jonah', 'Jonah', 4, 'ot'],
  [33, 'Micah', 'Mic', 7, 'ot'],
  [34, 'Nahum', 'Nah', 3, 'ot'],
  [35, 'Habakkuk', 'Hab', 3, 'ot'],
  [36, 'Zephaniah', 'Zeph', 3, 'ot'],
  [37, 'Haggai', 'Hag', 2, 'ot'],
  [38, 'Zechariah', 'Zech', 14, 'ot'],
  [39, 'Malachi', 'Mal', 4, 'ot'],
  [40, 'Matthew', 'Matt', 28, 'nt'],
  [41, 'Mark', 'Mark', 16, 'nt'],
  [42, 'Luke', 'Luke', 24, 'nt'],
  [43, 'John', 'John', 21, 'nt'],
  [44, 'Acts', 'Acts', 28, 'nt'],
  [45, 'Romans', 'Rom', 16, 'nt'],
  [46, '1 Corinthians', '1Cor', 16, 'nt'],
  [47, '2 Corinthians', '2Cor', 13, 'nt'],
  [48, 'Galatians', 'Gal', 6, 'nt'],
  [49, 'Ephesians', 'Eph', 6, 'nt'],
  [50, 'Philippians', 'Phil', 4, 'nt'],
  [51, 'Colossians', 'Col', 4, 'nt'],
  [52, '1 Thessalonians', '1Thess', 5, 'nt'],
  [53, '2 Thessalonians', '2Thess', 3, 'nt'],
  [54, '1 Timothy', '1Tim', 6, 'nt'],
  [55, '2 Timothy', '2Tim', 4, 'nt'],
  [56, 'Titus', 'Titus', 3, 'nt'],
  [57, 'Philemon', 'Phlm', 1, 'nt'],
  [58, 'Hebrews', 'Heb', 13, 'nt'],
  [59, 'James', 'Jas', 5, 'nt'],
  [60, '1 Peter', '1Pet', 5, 'nt'],
  [61, '2 Peter', '2Pet', 3, 'nt'],
  [62, '1 John', '1John', 5, 'nt'],
  [63, '2 John', '2John', 1, 'nt'],
  [64, '3 John', '3John', 1, 'nt'],
  [65, 'Jude', 'Jude', 1, 'nt'],
  [66, 'Revelation', 'Rev', 22, 'nt'],
];

/**
 * Abbreviations that are neither the canonical name nor the OSIS code.
 *
 * Superset of the API's `_ALIAS_EXTRA` (`server/app/scripture/books.py`), so any token
 * the client accepts the server also accepts. The additions are the numbered-book short
 * forms readers actually type (`1jn`) and the standard single-letter Gospel forms
 * (`mt`, `mk`, `lk`, `jn`), which the server's list omits.
 *
 * Every entry is already normalised. `books.data.test.ts` proves none collides.
 */
const EXTRA_ALIASES: Readonly<Record<BookNumber, readonly string[]>> = {
  9: ['1sa'],
  10: ['2sa'],
  11: ['1ki'],
  12: ['2ki'],
  13: ['1ch'],
  14: ['2ch'],
  19: ['psalm', 'psa', 'pss', 'psm'],
  22: ['songofsongs', 'canticles', 'sos', 'sng', 'cant'],
  40: ['mt', 'mat'],
  41: ['mk', 'mrk', 'mar'],
  42: ['lk', 'luk'],
  43: ['jn', 'jhn'],
  46: ['1co'],
  47: ['2co'],
  50: ['php', 'phi'],
  52: ['1th', '1thes'],
  53: ['2th', '2thes'],
  54: ['1ti', '1tm'],
  55: ['2ti', '2tm'],
  57: ['phm'],
  59: ['jms'],
  60: ['1pe', '1pt'],
  61: ['2pe', '2pt'],
  62: ['1jn', '1jhn'],
  63: ['2jn', '2jhn'],
  64: ['3jn', '3jhn'],
  66: ['apoc', 'revelationofjohn', 'rv'],
};

/**
 * Derive the URL-safe slug used in routes such as `/read/1-corinthians/13`.
 *
 * @param name - The canonical display name, e.g. `1 Corinthians`.
 * @returns The lowercase hyphenated slug, e.g. `1-corinthians`. Side effects: none.
 */
function toBookSlug(name: string): string {
  return name.toLowerCase().split(' ').join('-');
}

/**
 * Expand one source row into a table entry.
 *
 * @param row - The tuple as written in {@link BOOK_ROWS}.
 * @returns A frozen canonical book. Side effects: none.
 */
function toCanonicalBook(row: BookRow): CanonicalBook {
  const [bookNumber, name, osis, chapterCount, testament] = row;
  const aliases = new Set<string>([
    normaliseBookToken(name),
    normaliseBookToken(osis),
    ...(EXTRA_ALIASES[bookNumber] ?? []),
  ]);

  return Object.freeze({
    id: toBookSlug(name),
    name,
    canonicalNumber: bookNumber,
    chapterCount,
    osis,
    testament,
    aliases: Object.freeze([...aliases]),
  });
}

/**
 * The canon, in order, index 0 = Genesis.
 *
 * Frozen at module load: this table is shared by the reader, the picker, the note
 * writer, and the citation renderer, and a mutation in one would corrupt all of them.
 */
export const CANONICAL_BOOKS: readonly CanonicalBook[] = Object.freeze(
  BOOK_ROWS.map(toCanonicalBook),
);
