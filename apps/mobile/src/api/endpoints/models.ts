/**
 * What the API returns, in the client's own vocabulary.
 *
 * Purpose
 *   The wire is snake_case with `verse_key` integers and `osis_id` strings; the client
 *   is camelCase. Translating once, at the edge, means the rest of the app never reads
 *   `hit['verse_key']` and never has to remember which of the two conventions a given
 *   object follows. The wire names survive in the decoders beside each model, where the
 *   contract they enforce is the point.
 *
 * Why `verseKey` is a plain number here and not a `VerseKey`
 *   `@atlas/shared` has a validated `VerseKey` that resolves the book and range-checks
 *   the chapter against the KJV versification table. That validation is the right thing
 *   to run when the reader taps a verse — and the wrong thing to run over a whole
 *   chapter as it arrives, because one verse outside the table would fail the decode
 *   and blank the screen. Translations do differ in versification. So the API layer
 *   validates *shape* and the domain validates *meaning*: call `verseKeyFromNumber`
 *   where a resolved book is actually needed.
 *
 * Dependencies
 *   `@atlas/shared` for `Testament`. Nothing else — these are data, not behaviour.
 */

import type { Testament } from '@atlas/shared';

/** One translation offered by the switcher (`GET /translations`). */
export interface ApiTranslation {
  /** Stable code shown in the reader's version pill, e.g. `BSB`. */
  readonly code: string;
  readonly name: string;
  /** ISO 639-1 language code. */
  readonly language: string;
  /**
   * Whether the licence permits shipping this text to a device.
   *
   * Decision `Q-007` keeps enrichment server-side so share-alike never triggers; this
   * flag is the per-translation equivalent, and the offline cache must honour it.
   */
  readonly canRedistribute: boolean;
}

/** One book of the canon (`GET /books`). */
export interface ApiBook {
  /** 1–66, the first factor of every `verseKey`. */
  readonly bookNumber: number;
  readonly name: string;
  /** OSIS code as the API emits it, e.g. `1Cor`, `Ps`, `Song`. Case is significant. */
  readonly osis: string;
  readonly chapterCount: number;
  readonly testament: Testament;
}

/** One verse of a chapter. */
export interface ApiVerse {
  readonly verse: number;
  readonly text: string;
  /** e.g. `Prov.1.1`. The identity cross-references and badges are keyed by. */
  readonly osisId: string;
  /** `bookNumber × 1_000_000 + chapter × 1_000 + verse`, e.g. `43003016`. */
  readonly verseKey: number;
}

/** A chapter, ready to render (`GET /chapters/{translation}/{book}/{chapter}`). */
export interface ApiChapter {
  /** Human reference for the header, e.g. `Proverbs 1`. */
  readonly reference: string;
  readonly translation: string;
  readonly bookNumber: number;
  readonly chapter: number;
  readonly verses: readonly ApiVerse[];
}

/** One verse matching a search. */
export interface ApiSearchHit {
  /** Display reference, e.g. `Ruth 2:3`. */
  readonly reference: string;
  readonly bookNumber: number;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
  readonly osisId: string;
  readonly verseKey: number;
}

/** A search response (`GET /search`). */
export interface ApiSearchResults {
  readonly query: string;
  readonly translation: string;
  /** Echo of the scope: `all`, or the OSIS code of the book searched. */
  readonly scope: string;
  readonly count: number;
  readonly hits: readonly ApiSearchHit[];
}

/** Liveness (`GET /health`). Answers without touching the database. */
export interface ApiHealth {
  readonly status: string;
  readonly service: string;
  readonly version: string;
  readonly environment: string;
}

/** Who the server thinks the caller is (`GET /me`). */
export interface ApiIdentity {
  /** Opaque, stable subject, e.g. `device:atlas-…`. */
  readonly subject: string;
  /** `device` today; `account` once real auth lands (decision `A-01`). */
  readonly kind: string;
}
