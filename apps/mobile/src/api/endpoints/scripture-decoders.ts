/**
 * Decoders for the scripture endpoints: wire shape in, client model out.
 *
 * Purpose
 *   One file holds every wire field name the scripture API uses, so the contract with
 *   `apps/api/app/modules/scripture/presentation/schemas.py` can be read against it side
 *   by side. A field renamed there fails here with the field's own name in the message,
 *   rather than as an `undefined` in the reader.
 *
 * Reading order
 *   Each block is: the wire interface (snake_case, exactly as sent), the decoder that
 *   proves a body matches it, and the mapper into the camelCase model. The mapper is
 *   the only place the two vocabularies touch.
 *
 * Dependencies
 *   The decoder combinators and the client models. No HTTP.
 */

import { succeed } from '@atlas/shared';

import { decodeArray, decodeBoolean, decodeNumber, decodeObject, decodeString } from '../client';
import type { Decoder } from '../client';
import type {
  ApiBook,
  ApiChapter,
  ApiSearchHit,
  ApiSearchResults,
  ApiTranslation,
  ApiVerse,
} from './models';

// --- Translations ------------------------------------------------------------------

interface TranslationWire {
  code: string;
  name: string;
  language: string;
  can_redistribute: boolean;
}

const decodeTranslationWire = decodeObject<TranslationWire>({
  code: decodeString,
  name: decodeString,
  language: decodeString,
  can_redistribute: decodeBoolean,
});

const decodeTranslationListWire = decodeObject<{ translations: readonly TranslationWire[] }>({
  translations: decodeArray(decodeTranslationWire),
});

/** `GET /translations` → the switcher's options, in the order the server ranked them. */
export const decodeTranslations: Decoder<readonly ApiTranslation[]> = (raw, path) => {
  const body = decodeTranslationListWire(raw, path);
  if (!body.ok) return body;
  return succeed(
    body.value.translations.map((wire) => ({
      code: wire.code,
      name: wire.name,
      language: wire.language,
      canRedistribute: wire.can_redistribute,
    })),
  );
};

// --- Books -------------------------------------------------------------------------

interface BookWire {
  book_number: number;
  name: string;
  osis: string;
  chapter_count: number;
  testament: string;
}

const decodeBookWire = decodeObject<BookWire>({
  book_number: decodeNumber,
  name: decodeString,
  osis: decodeString,
  chapter_count: decodeNumber,
  testament: decodeString,
});

const decodeBookListWire = decodeObject<{ books: readonly BookWire[] }>({
  books: decodeArray(decodeBookWire),
});

/**
 * `GET /books` → the canon.
 *
 * `testament` is narrowed rather than trusted: the server sends `ot` or `nt`, and a
 * third value would otherwise flow into a `switch` that has no branch for it. An
 * unrecognised value is mapped to `ot` — the canon's order already tells the reader
 * which half a book is in, so guessing here is invisible, whereas failing the decode
 * would empty the book picker.
 */
export const decodeBooks: Decoder<readonly ApiBook[]> = (raw, path) => {
  const body = decodeBookListWire(raw, path);
  if (!body.ok) return body;
  return succeed(
    body.value.books.map((wire) => ({
      bookNumber: wire.book_number,
      name: wire.name,
      osis: wire.osis,
      chapterCount: wire.chapter_count,
      testament: wire.testament === 'nt' ? ('nt' as const) : ('ot' as const),
    })),
  );
};

// --- Chapter -----------------------------------------------------------------------

interface VerseWire {
  verse: number;
  text: string;
  osis_id: string;
  verse_key: number;
}

interface ChapterWire {
  reference: string;
  translation: string;
  book_number: number;
  chapter: number;
  verses: readonly VerseWire[];
}

const decodeVerseWire = decodeObject<VerseWire>({
  verse: decodeNumber,
  text: decodeString,
  osis_id: decodeString,
  verse_key: decodeNumber,
});

const decodeChapterWire = decodeObject<ChapterWire>({
  reference: decodeString,
  translation: decodeString,
  book_number: decodeNumber,
  chapter: decodeNumber,
  verses: decodeArray(decodeVerseWire),
});

/** Map one verse. Extracted so the chapter mapper stays a single expression. */
function toVerse(wire: VerseWire): ApiVerse {
  return { verse: wire.verse, text: wire.text, osisId: wire.osis_id, verseKey: wire.verse_key };
}

/** `GET /chapters/{translation}/{book}/{chapter}` → the reading canvas's payload. */
export const decodeChapter: Decoder<ApiChapter> = (raw, path) => {
  const body = decodeChapterWire(raw, path);
  if (!body.ok) return body;
  return succeed({
    reference: body.value.reference,
    translation: body.value.translation,
    bookNumber: body.value.book_number,
    chapter: body.value.chapter,
    verses: body.value.verses.map(toVerse),
  });
};

// --- Search ------------------------------------------------------------------------

interface SearchHitWire {
  ref: string;
  book_number: number;
  chapter: number;
  verse: number;
  text: string;
  osis_id: string;
  verse_key: number;
}

interface SearchWire {
  query: string;
  translation: string;
  scope: string;
  count: number;
  results: readonly SearchHitWire[];
}

const decodeSearchHitWire = decodeObject<SearchHitWire>({
  ref: decodeString,
  book_number: decodeNumber,
  chapter: decodeNumber,
  verse: decodeNumber,
  text: decodeString,
  osis_id: decodeString,
  verse_key: decodeNumber,
});

const decodeSearchWire = decodeObject<SearchWire>({
  query: decodeString,
  translation: decodeString,
  scope: decodeString,
  count: decodeNumber,
  results: decodeArray(decodeSearchHitWire),
});

/** Map one hit. `ref` becomes `reference`: the client never abbreviates a field name. */
function toSearchHit(wire: SearchHitWire): ApiSearchHit {
  return {
    reference: wire.ref,
    bookNumber: wire.book_number,
    chapter: wire.chapter,
    verse: wire.verse,
    text: wire.text,
    osisId: wire.osis_id,
    verseKey: wire.verse_key,
  };
}

/** `GET /search` → the results the search popover renders over the reader. */
export const decodeSearchResults: Decoder<ApiSearchResults> = (raw, path) => {
  const body = decodeSearchWire(raw, path);
  if (!body.ok) return body;
  return succeed({
    query: body.value.query,
    translation: body.value.translation,
    scope: body.value.scope,
    count: body.value.count,
    hits: body.value.results.map(toSearchHit),
  });
};
