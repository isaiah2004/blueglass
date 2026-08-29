/**
 * The reader's theme choice, as pure logic.
 *
 * Purpose
 *   Decision `D-01` asks for a switcher with three positions — system, light, dark — and
 *   for the choice to be remembered. That is two different values that are easy to
 *   conflate: what the reader *asked for* (`ThemePreference`) and what is *rendered*
 *   (`ThemeName`). Keeping them apart is what lets "system" follow the OS at runtime
 *   instead of freezing whatever the OS said the first time.
 *
 * Key responsibilities
 *   - Name the three preference positions, once, as a runtime tuple and a union.
 *   - Resolve a preference plus the OS scheme into the theme actually rendered.
 *   - Validate a string read back out of storage, because persisted data is untrusted
 *     input: an older build, a hand-edited `localStorage`, or a half-written value must
 *     degrade to the default rather than render an undefined palette.
 *
 * Dependencies
 *   `./theme-contract` for `ThemeName`. No React, no React Native, no storage.
 */

import type { ThemeName } from './theme-contract';

/** What the reader picked in the switcher. */
export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * The three switcher positions, in the order they are drawn.
 *
 * A runtime tuple so the switcher iterates it rather than restating it, and so
 * {@link isThemePreference} has one list to check against.
 */
export const themePreferences = ['system', 'light', 'dark'] as const;

/**
 * The theme rendered when nothing else decides.
 *
 * `D-01`: "Dark by default." This is that default in code — it applies both before the
 * stored preference has loaded and when the platform reports no colour scheme at all.
 */
export const DEFAULT_THEME_NAME: ThemeName = 'dark';

/**
 * The preference a first run starts from.
 *
 * `'dark'`, not `'system'`. `D-01` says *dark by default*, and the design language is a
 * dark cinematic canvas — a reader whose OS happens to be light should still meet the app
 * the way it was designed, then choose otherwise. Starting on `'system'` would mean the
 * majority of desktop browsers, which report light, never see the default look at all.
 *
 * "Follow the system" is one tap away in Settings, and once chosen it is remembered and
 * keeps tracking the OS live.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

/**
 * Is this unknown value one of the three preferences?
 *
 * @param value - Anything; typically a string just read out of persistent storage.
 * @returns True when the value can be used as a {@link ThemePreference}.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (themePreferences as readonly string[]).includes(value);
}

/**
 * Which theme should actually render.
 *
 * @param preference - What the reader picked.
 * @param systemScheme - What the platform reports right now, or `null` when it reports
 *   nothing. React Native's `useColorScheme()` returns `null` on a device with no
 *   preference set and, on the web, before the first `matchMedia` read.
 * @returns The theme to render. An explicit `'light'` or `'dark'` always wins; `'system'`
 *   follows the platform and falls back to {@link DEFAULT_THEME_NAME}.
 */
export function resolveThemeName(
  preference: ThemePreference,
  systemScheme: ThemeName | null | undefined,
): ThemeName {
  if (preference !== 'system') return preference;
  return systemScheme ?? DEFAULT_THEME_NAME;
}

/**
 * Read a persisted preference back, safely.
 *
 * @param stored - The raw string from storage, or `undefined` when the key is absent.
 * @returns The stored preference, or {@link DEFAULT_THEME_PREFERENCE} when the value is
 *   missing or unrecognised. Never throws: a corrupt preference must not stop the app
 *   from painting.
 */
export function parseThemePreference(stored: string | undefined): ThemePreference {
  return isThemePreference(stored) ? stored : DEFAULT_THEME_PREFERENCE;
}

/**
 * The next preference in the cycle, for a single-button toggle.
 *
 * @param preference - The current position.
 * @returns The following position, wrapping from the last back to the first.
 */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  const index = themePreferences.indexOf(preference);
  // `indexOf` cannot return -1: the parameter's type is the tuple's own union.
  return themePreferences[(index + 1) % themePreferences.length] ?? DEFAULT_THEME_PREFERENCE;
}

/** The human label for one switcher position. */
export const themePreferenceLabel = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
} as const satisfies Record<ThemePreference, string>;
