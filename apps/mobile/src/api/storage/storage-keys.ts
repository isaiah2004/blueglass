/**
 * Every key the client writes into persistent storage, in one table.
 *
 * Purpose
 *   Storage keys are a shared namespace with no compiler behind it: a typo produces a
 *   silent second key rather than an error, and two features that pick the same string
 *   corrupt each other. Naming them once, here, makes both failures impossible to
 *   introduce without editing this file.
 *
 * Naming scheme
 *   `atlas.<area>.v<n>` — the prefix keeps Atlas Bible's keys distinguishable from
 *   anything else sharing a browser origin, and the trailing version lets a shape
 *   change ship as a *new* key rather than as a migration. Old data then ages out
 *   naturally instead of being read with the wrong parser.
 *
 * Dependencies
 *   None.
 */

/**
 * The anonymous device id (decision `A-01`).
 *
 * Never versioned upward casually: bumping this key mints a new identity and orphans
 * everything the server scoped to the old one.
 */
export const DEVICE_ID_STORAGE_KEY = 'atlas.identity.device-id.v1';

/** The dehydrated TanStack Query cache (decision `O-01`, offline scripture). */
export const QUERY_CACHE_STORAGE_KEY = 'atlas.query-cache.v1';

/** Reader preferences mirrored to `PUT /me/prefs`. */
export const PREFERENCES_STORAGE_KEY = 'atlas.prefs.v1';

/** The last reading position, so a cold start opens where the reader left off. */
export const READER_POSITION_STORAGE_KEY = 'atlas.reader.position.v1';

/**
 * The reader's theme choice — `'system' | 'light' | 'dark'` (decision `D-01`).
 *
 * Stored as the preference, never as the resolved palette: freezing "dark" the moment a
 * reader is on a dark OS would stop `system` from ever following the OS again.
 */
export const THEME_PREFERENCE_STORAGE_KEY = 'atlas.theme.v1';
