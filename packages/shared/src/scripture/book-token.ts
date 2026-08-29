/**
 * Book-token normalisation.
 *
 * Purpose
 *   Readers, deep links, AI output, and the API all spell the same book differently:
 *   `1 John`, `1John`, `1 JOHN`, `1-john`, `1jn`. Every one of them must reach book 62.
 *   This module reduces any of those to the single lookup key the alias index is built
 *   on, so the table is written once and matched consistently.
 *
 * Key responsibilities
 *   - Collapse a token to lowercase alphanumerics only.
 *   - Recognise a token that is purely a book *number* rather than a name.
 *
 * Dependencies
 *   None. Pure string work; no locale lookups, so the result is identical on every
 *   device and in every test run.
 *
 * Compatibility
 *   The normalisation matches the API's `_norm` in `server/app/scripture/books.py`
 *   exactly — lowercase, then keep only alphanumeric characters. A token the client
 *   resolves is therefore a token the server resolves.
 */

/** Matches a token made entirely of ASCII digits, e.g. the `43` in `/read/43/3`. */
const DIGITS_ONLY = /^\d+$/;

/** Matches any character that is not an ASCII letter or digit. */
const NON_ALPHANUMERIC = /[^a-z0-9]/g;

/**
 * Reduce a book token to its lookup key.
 *
 * Lowercases, then removes every character that is not a letter or a digit — spaces,
 * periods, hyphens, and apostrophes all disappear. `"1 John"`, `"1John"`, and
 * `"1-JOHN."` all normalise to `"1john"`.
 *
 * Non-ASCII letters are dropped rather than transliterated. The canon table is English
 * (KJV names and OSIS codes), so a token containing them was never going to match, and
 * dropping them keeps this function free of an Intl dependency.
 *
 * @param token - Raw text typed, routed, or parsed from a reference.
 * @returns The normalised lookup key. May be empty if the input held no alphanumerics.
 *
 * Side effects: none.
 */
export function normaliseBookToken(token: string): string {
  return token.toLowerCase().replace(NON_ALPHANUMERIC, '');
}

/**
 * Decide whether a token is a bare book number rather than a name.
 *
 * `"43"` is John arriving from an API path or a stored route param. `"1john"` is not —
 * it contains letters — and neither is `"1"` combined with anything else.
 *
 * @param normalisedToken - Output of {@link normaliseBookToken}.
 * @returns `true` when the token is one or more digits and nothing else.
 *
 * Side effects: none.
 */
export function isBookNumberToken(normalisedToken: string): boolean {
  return DIGITS_ONLY.test(normalisedToken);
}
