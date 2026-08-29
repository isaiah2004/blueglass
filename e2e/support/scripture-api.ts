/**
 * Reading the API directly, so the walkthrough can check the app against its own source.
 *
 * Purpose
 *   Pillar 3 is "every claim carries a citation, or it is not rendered". The chapters that
 *   only compare the screen against itself cannot see the failure that pillar exists to
 *   prevent: a reader showing text, a word tint or a badge anchor that the API never sent.
 *   A verse rendered from a stale cache under a KJV label, or a pill attached one word to
 *   the left of the word it names, both look completely plausible in a screenshot and in
 *   every assertion that reads only the DOM.
 *
 *   This module is the second opinion. It fetches from the same API the app fetches from,
 *   in Node rather than in the page, so a chapter can assert that what the reader sees is
 *   what the server said.
 *
 * Why in Node and not through the page
 *   Chapter 10 and chapter 14 stage an API outage *inside the browser* by routing every
 *   `/api/` request to a refusal. A cross-check issued from the page would be cut off by
 *   that same outage and would report the app as lying when it is merely offline. Issuing
 *   it from the test process keeps the two facts independent, which is the only way the
 *   comparison means anything.
 *
 * Why it resolves the base URL the way the app does
 *   `apps/mobile/src/api/client/api-config.ts` reads `EXPO_PUBLIC_API_URL` and falls back
 *   to `http://localhost:8010`. Duplicating that rule — rather than hard-coding the port —
 *   means a run pointed at another API compares the reader against *that* API, instead of
 *   silently comparing it against a different one and passing.
 *
 * Dependencies
 *   Node's global `fetch`. No Playwright, no page.
 */

/** The port `.env.example` publishes the API on, and what `api-config.ts` falls back to. */
const FALLBACK_API_BASE_URL = 'http://localhost:8010';

/** How long one cross-check read may take before it is the harness that is broken. */
const API_TIMEOUT_MS = 15_000;

/** One verse as `GET /chapters/{translation}/{book}/{chapter}` returns it. */
export interface ApiVerse {
  /** The verse number within the chapter. */
  readonly verse: number;
  /** The text, exactly as the translation prints it. */
  readonly text: string;
  /** The packed book/chapter/verse key, e.g. `65001001`. */
  readonly verse_key: number;
}

/** One chapter as the API returns it. */
export interface ApiChapter {
  /** The human reference, e.g. `Psalms 119`. */
  readonly reference: string;
  /** The translation code the server believes it answered in. */
  readonly translation: string;
  readonly verses: readonly ApiVerse[];
}

/** Where in its verse a badge claims to attach. */
export interface ApiBadgeAnchor {
  readonly verse_key: number;
  /** The exact substring the badge names, e.g. `Derbe`. */
  readonly text: string;
  readonly start_offset: number;
  readonly end_offset: number;
}

/** One badge as `GET /badges/chapters/{translation}/{book}/{chapter}` returns it. */
export interface ApiBadge {
  /** `kind~verseKey~discriminator`, the same id the pill carries in its test id. */
  readonly id: string;
  readonly kind: string;
  readonly anchor: ApiBadgeAnchor;
}

/** A chapter's badges as the API returns them. */
export interface ApiChapterBadges {
  readonly reference: string;
  readonly badges: readonly ApiBadge[];
}

/**
 * The API base the app under test is pointed at.
 *
 * @returns The origin, without a trailing slash.
 */
export function apiBaseUrl(): string {
  const configured = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  const base = configured === '' ? FALLBACK_API_BASE_URL : configured;
  return base.replace(/\/+$/, '');
}

/**
 * Read one JSON document from the API, failing with a sentence rather than a stack.
 *
 * @param path The path below the base URL, starting with a slash.
 * @returns The parsed body.
 * @throws {Error} If the API is unreachable or answers anything but 200.
 */
async function readJson<T>(path: string): Promise<T> {
  const url = `${apiBaseUrl()}${path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(API_TIMEOUT_MS) }).catch(
    (cause: unknown) => {
      throw new Error(
        `The walkthrough could not reach the API at ${url}. This is the harness's own ` +
          "cross-check read, not the app's: `docker compose up -d` first. Nothing about " +
          'the app under test has been proven or disproven by this failure.',
        { cause },
      );
    },
  );
  if (!response.ok) {
    throw new Error(
      `${url} answered ${String(response.status)}. The cross-check cannot run, so the ` +
        'chapter that depends on it must not conclude anything.',
    );
  }
  return (await response.json()) as T;
}

/**
 * Read one chapter in one translation.
 *
 * @param translation The translation code, e.g. `KJV`.
 * @param book The book slug, e.g. `psalms`.
 * @param chapter The chapter number.
 * @returns The chapter as the server holds it.
 * @throws {Error} If the API is unreachable or refuses.
 */
export async function fetchChapter(
  translation: string,
  book: string,
  chapter: number,
): Promise<ApiChapter> {
  return readJson<ApiChapter>(`/chapters/${translation}/${book}/${String(chapter)}`);
}

/**
 * Read one chapter's badges in one translation.
 *
 * @param translation The translation code.
 * @param book The book slug.
 * @param chapter The chapter number.
 * @returns The badges the server selected for that chapter.
 * @throws {Error} If the API is unreachable or refuses.
 */
export async function fetchChapterBadges(
  translation: string,
  book: string,
  chapter: number,
): Promise<ApiChapterBadges> {
  return readJson<ApiChapterBadges>(`/badges/chapters/${translation}/${book}/${String(chapter)}`);
}

/**
 * A chapter's verse text keyed by verse number, for comparing against the rendered rows.
 *
 * @param chapter A chapter read from the API.
 * @returns Verse number to text, whitespace collapsed the same way the DOM reports it.
 */
export function verseTextByNumber(chapter: ApiChapter): Map<number, string> {
  const byNumber = new Map<number, string>();
  for (const verse of chapter.verses) {
    byNumber.set(verse.verse, verse.text.replace(/\s+/g, ' ').trim());
  }
  return byNumber;
}

/**
 * A chapter's badge anchors keyed by badge id, for comparing against the rendered pills.
 *
 * @param badges A chapter's badges read from the API.
 * @returns Badge id to the exact word the badge claims.
 */
export function anchorTextByBadgeId(badges: ApiChapterBadges): Record<string, string> {
  const byId: Record<string, string> = {};
  for (const badge of badges.badges) byId[badge.id] = badge.anchor.text;
  return byId;
}
