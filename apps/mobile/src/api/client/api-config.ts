/**
 * Where the API is, and how long the client will wait for it.
 *
 * Purpose
 *   One place that answers "what base URL?" and "what timeout?", so no module hard-codes
 *   a host and no request escapes without a budget (rule 6.4.1).
 *
 * How the base URL is chosen
 *   `EXPO_PUBLIC_API_URL`, else `http://localhost:8010` — the port `.env.example`
 *   assigns to the API container. The variable must be written out literally as
 *   `process.env.EXPO_PUBLIC_API_URL`: Metro replaces that exact expression at build
 *   time, and a dynamic lookup would silently read `undefined` on device.
 *
 *   **The Android emulator needs the variable set**, to `http://10.0.2.2:8010`.
 *   `localhost` inside the emulator is the emulator. The Flutter prototype branched on
 *   `Platform.isAndroid` for this (`config.dart:26-37`); doing the same here would mean
 *   importing `react-native` into the module every test loads, and would still be wrong
 *   for a physical device on the LAN. `.env.example` documents both cases.
 *
 * Why the default timeout is ten seconds
 *   `O-02` delegated the budgets. A chapter read is one indexed query returning at most
 *   a few hundred rows; on a healthy stack it answers in milliseconds. Ten seconds is
 *   therefore not a performance target but a liveness one — long enough that a slow
 *   mobile handshake is not mistaken for a dead server, short enough that the reader
 *   sees Retry rather than a spinner they will not sit through. Search gets longer,
 *   because a trigram fallback across 124,372 verses genuinely takes time.
 *
 * Dependencies
 *   None.
 */

/** The fallback base URL: the API container's host port from `.env.example`. */
export const FALLBACK_API_BASE_URL = 'http://localhost:8010';

/** Budget for an ordinary read. */
export const DEFAULT_API_TIMEOUT_MS = 10_000;

/** Budget for search, which may fall back to a trigram scan server-side. */
export const SEARCH_API_TIMEOUT_MS = 15_000;

/** Budget for the health probe. Short on purpose: it exists to fail fast. */
export const HEALTH_API_TIMEOUT_MS = 3_000;

/**
 * Strip trailing slashes so joining a path never produces `//`.
 *
 * @param baseUrl - A base URL, with or without a trailing slash.
 * @returns The URL without any trailing slash. Side effects: none.
 */
export function normaliseBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

/**
 * Resolve the base URL to call.
 *
 * @param configured - An explicit override. Blank and whitespace-only values are
 *                     ignored, because an empty `EXPO_PUBLIC_API_URL=` in a `.env` is
 *                     "unset" to a human and `''` to the bundler.
 * @returns The normalised base URL. Side effects: none.
 */
export function resolveApiBaseUrl(configured: string | undefined): string {
  const trimmed = configured?.trim() ?? '';
  return normaliseBaseUrl(trimmed === '' ? FALLBACK_API_BASE_URL : trimmed);
}

/**
 * The base URL this build talks to.
 *
 * Read once at module load, which is also when Metro's inlined value is available.
 */
export const API_BASE_URL: string = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_URL);
