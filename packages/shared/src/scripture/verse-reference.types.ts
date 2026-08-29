/**
 * Verse reference types.
 *
 * Purpose
 *   The canonical shape of "a place in scripture" for the whole system. Every surface —
 *   the reader route, a badge sheet, a saved note, an AI citation — points at scripture
 *   through this one type, so there is a single definition of what a reference is.
 *
 * Key responsibilities
 *   - Name the parts of a reference (book, chapter, optional verse or verse range).
 *   - Stay pure data: no formatting, no validation, no I/O.
 *
 * Dependencies
 *   None. This module is the bottom of the dependency graph by design.
 *
 * Note for later agents
 *   This is the placeholder domain surface the scaffold ships with. The full canonical
 *   book table (all 66 books plus server aliases) is a separate task — see
 *   `docs/architecture/flutter-port-map.md` §9, `src/domain/books.ts`.
 */

/**
 * A book of the Bible, identified the way the API identifies it.
 *
 * `id` is the stable slug used in routes and API paths (`john`, `1-corinthians`).
 * `name` is the display name shown to a reader (`John`, `1 Corinthians`).
 */
export interface BibleBook {
  /** Stable, URL-safe identifier. Lowercase, hyphenated. */
  readonly id: string;
  /** Human-readable book name, as printed in the translation. */
  readonly name: string;
  /** 1-based canonical position, Genesis = 1 … Revelation = 66. */
  readonly canonicalNumber: number;
  /** Number of chapters the book contains. Always >= 1. */
  readonly chapterCount: number;
}

/**
 * A pointer to a passage of scripture.
 *
 * Four forms are representable, and each renders differently:
 *   - whole chapter        `{ book, chapter: 3 }`                        → "John 3"
 *   - single verse         `{ book, chapter: 3, verse: 16 }`             → "John 3:16"
 *   - verse range          `{ book, chapter: 3, verse: 16, endVerse: 18 }` → "John 3:16-18"
 *   - degenerate range     `{ ..., verse: 16, endVerse: 16 }`            → "John 3:16"
 */
export interface VerseReference {
  /** The book being referenced. */
  readonly book: BibleBook;
  /** 1-based chapter number within the book. */
  readonly chapter: number;
  /** 1-based first verse. Omitted when the reference is a whole chapter. */
  readonly verse?: number;
  /** 1-based last verse of an inclusive range. Omitted for a single verse. */
  readonly endVerse?: number;
}

/**
 * Which Bible translation a piece of text came from.
 *
 * MVP ships public-domain / open-licence translations only (see `docs/product/prd.md`),
 * because the AI pipeline processes the text.
 */
export interface Translation {
  /** Short uppercase code shown in the reader's version pill, e.g. `BSB`. */
  readonly code: string;
  /** Full title, e.g. `Berean Standard Bible`. */
  readonly name: string;
}
