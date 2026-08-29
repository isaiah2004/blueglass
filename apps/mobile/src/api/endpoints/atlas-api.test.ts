/**
 * Contract tests for the six endpoints.
 *
 * The fixtures are the wire shapes the server's Pydantic models publish
 * (`apps/api/app/modules/<module>/presentation/`). If a field is renamed there and not here,
 * these fail with the field's own name — which is the whole point of decoding rather
 * than casting.
 *
 * What these prove
 *   - Each method builds the route the server actually serves.
 *   - Each response is translated from snake_case wire into the client's camelCase
 *     model, `ref` included.
 *   - A body missing a field fails as `malformed`, naming the path.
 */

import { describe, expect, it } from 'vitest';

import type { ApiError } from '../client';
import { createHttpClient } from '../client';
import { createRecordingFetch, type CannedReply } from '../client/http-test-doubles';
import { createAtlasApi, type AtlasApi } from './atlas-api';

/** Verbatim `GET /translations`, trimmed to two rows. */
const TRANSLATIONS_BODY = {
  translations: [
    { code: 'BSB', name: 'Berean Standard Bible', language: 'en', can_redistribute: true },
    { code: 'KJV', name: 'King James Version', language: 'en', can_redistribute: true },
  ],
};

/** Verbatim `GET /books`, trimmed to two rows. */
const BOOKS_BODY = {
  books: [
    { book_number: 1, name: 'Genesis', osis: 'Gen', chapter_count: 50, testament: 'ot' },
    { book_number: 43, name: 'John', osis: 'John', chapter_count: 21, testament: 'nt' },
  ],
};

/** Verbatim `GET /chapters/BSB/John/3`, trimmed to one verse. */
const CHAPTER_BODY = {
  reference: 'John 3',
  translation: 'BSB',
  book_number: 43,
  chapter: 3,
  verses: [{ verse: 16, text: 'For God so loved the world', osis_id: 'John.3.16', verse_key: 43_003_016 }],
};

/** Verbatim `GET /search?q=beloved`, trimmed to one hit. */
const SEARCH_BODY = {
  query: 'beloved',
  translation: 'BSB',
  scope: 'all',
  count: 1,
  results: [
    {
      ref: 'Song 2:16',
      book_number: 22,
      chapter: 2,
      verse: 16,
      text: 'My beloved is mine and I am his',
      osis_id: 'Song.2.16',
      verse_key: 22_002_016,
    },
  ],
};

/** Build an API bound to a scripted transport, with retries off so calls are countable. */
function apiOver(replies: readonly CannedReply[]): {
  api: AtlasApi;
  calls: { url: string; init: RequestInit }[];
} {
  const { fetchImpl, calls } = createRecordingFetch(replies);
  const client = createHttpClient({
    baseUrl: 'http://api.test',
    fetchImpl,
    policy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
  });
  return { api: createAtlasApi(client), calls };
}

describe('AtlasApi', () => {
  it('reads liveness from GET /health', async () => {
    const { api, calls } = apiOver([
      { status: 200, body: { status: 'ok', service: 'atlas-api', version: '0.4.0', environment: 'local' } },
    ]);

    const result = await api.getHealth();

    expect(calls[0]?.url).toBe('http://api.test/health');
    expect(result).toEqual({
      ok: true,
      value: { status: 'ok', service: 'atlas-api', version: '0.4.0', environment: 'local' },
    });
  });

  it('reads the switcher options from GET /translations', async () => {
    const { api, calls } = apiOver([{ status: 200, body: TRANSLATIONS_BODY }]);

    const result = await api.getTranslations();

    expect(calls[0]?.url).toBe('http://api.test/translations');
    expect(result).toEqual({
      ok: true,
      value: [
        { code: 'BSB', name: 'Berean Standard Bible', language: 'en', canRedistribute: true },
        { code: 'KJV', name: 'King James Version', language: 'en', canRedistribute: true },
      ],
    });
  });

  it('reads the canon from GET /books, narrowing the testament', async () => {
    const { api } = apiOver([{ status: 200, body: BOOKS_BODY }]);

    const result = await api.getBooks();

    expect(result).toEqual({
      ok: true,
      value: [
        { bookNumber: 1, name: 'Genesis', osis: 'Gen', chapterCount: 50, testament: 'ot' },
        { bookNumber: 43, name: 'John', osis: 'John', chapterCount: 21, testament: 'nt' },
      ],
    });
  });

  it('reads a chapter, with the translation in the path', async () => {
    const { api, calls } = apiOver([{ status: 200, body: CHAPTER_BODY }]);

    const result = await api.getChapter({ translation: 'BSB', book: 'John', chapter: 3 });

    expect(calls[0]?.url).toBe('http://api.test/chapters/BSB/John/3');
    expect(result).toEqual({
      ok: true,
      value: {
        reference: 'John 3',
        translation: 'BSB',
        bookNumber: 43,
        chapter: 3,
        verses: [
          {
            verse: 16,
            text: 'For God so loved the world',
            osisId: 'John.3.16',
            verseKey: 43_003_016,
          },
        ],
      },
    });
  });

  it('accepts a book number as well as a name, because the server resolves both', async () => {
    const { api, calls } = apiOver([{ status: 200, body: CHAPTER_BODY }]);

    await api.getChapter({ translation: 'BSB', book: 43, chapter: 3 });

    expect(calls[0]?.url).toBe('http://api.test/chapters/BSB/43/3');
  });

  it('encodes a book name containing a space', async () => {
    const { api, calls } = apiOver([{ status: 200, body: CHAPTER_BODY }]);

    await api.getChapter({ translation: 'BSB', book: 'Song of Solomon', chapter: 2 });

    expect(calls[0]?.url).toBe('http://api.test/chapters/BSB/Song%20of%20Solomon/2');
  });

  it('searches, omitting the parameters the caller left out', async () => {
    const { api, calls } = apiOver([{ status: 200, body: SEARCH_BODY }]);

    const result = await api.search({ query: 'beloved', limit: 50 });

    expect(calls[0]?.url).toBe('http://api.test/search?q=beloved&limit=50');
    expect(result).toEqual({
      ok: true,
      value: {
        query: 'beloved',
        translation: 'BSB',
        scope: 'all',
        count: 1,
        hits: [
          {
            reference: 'Song 2:16',
            bookNumber: 22,
            chapter: 2,
            verse: 16,
            text: 'My beloved is mine and I am his',
            osisId: 'Song.2.16',
            verseKey: 22_002_016,
          },
        ],
      },
    });
  });

  it('reads the resolved identity from GET /me', async () => {
    const { api, calls } = apiOver([
      { status: 200, body: { subject: 'device:atlas-abc', kind: 'device' } },
    ]);

    const result = await api.getIdentity();

    expect(calls[0]?.url).toBe('http://api.test/me');
    expect(result).toEqual({ ok: true, value: { subject: 'device:atlas-abc', kind: 'device' } });
  });

  it('reports a drifted contract as malformed, naming the field', async () => {
    const broken = { ...CHAPTER_BODY, verses: [{ verse: 16, text: 'x', osis_id: 'John.3.16' }] };
    const { api } = apiOver([{ status: 200, body: broken }]);

    const result = await api.getChapter({ translation: 'BSB', book: 'John', chapter: 3 });

    expect(result.ok).toBe(false);
    expect((result as { error: ApiError }).error).toMatchObject({
      kind: 'malformed',
      path: 'verses[0].verse_key',
    });
  });

  it('surfaces the server code for a chapter that does not exist', async () => {
    const { api } = apiOver([
      {
        status: 404,
        body: { error: { code: 'chapter_not_found', message: 'No verses.', request_id: 'r1' } },
      },
    ]);

    const result = await api.getChapter({ translation: 'BSB', book: 'Obad', chapter: 2 });

    expect((result as { error: ApiError }).error).toMatchObject({
      kind: 'http',
      status: 404,
      code: 'chapter_not_found',
    });
  });
});
