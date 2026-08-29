/**
 * Theme selection.
 *
 * `D-01` asks for three switcher positions and a remembered choice. The two failure modes
 * worth locking are (a) "system" quietly freezing into whatever the OS said at launch, and
 * (b) a corrupt stored value rendering an undefined palette.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  nextThemePreference,
  parseThemePreference,
  resolveThemeName,
  themePreferenceLabel,
  themePreferences,
} from './theme-preference';

describe('the switcher positions', () => {
  it('offers exactly system, light and dark, in that order', () => {
    expect(themePreferences).toStrictEqual(['system', 'light', 'dark']);
  });

  it('labels every position', () => {
    for (const preference of themePreferences) {
      expect(themePreferenceLabel[preference]).toMatch(/\S/);
    }
  });

  it('starts on dark, whatever the platform reports', () => {
    // `D-01`: dark by default. Starting on `system` would mean most desktop browsers, which
    // report light, never see the design as it was drawn.
    expect(DEFAULT_THEME_PREFERENCE).toBe('dark');
    expect(DEFAULT_THEME_NAME).toBe('dark');
    expect(resolveThemeName(DEFAULT_THEME_PREFERENCE, 'light')).toBe('dark');
  });

  it('cycles through every position and returns to the start', () => {
    let preference = DEFAULT_THEME_PREFERENCE;
    const seen = [preference];

    for (let step = 0; step < themePreferences.length; step += 1) {
      preference = nextThemePreference(preference);
      seen.push(preference);
    }

    expect(new Set(seen).size).toBe(themePreferences.length);
    expect(seen.at(-1)).toBe(DEFAULT_THEME_PREFERENCE);
  });
});

describe('resolveThemeName', () => {
  it('lets an explicit choice beat the platform', () => {
    expect(resolveThemeName('light', 'dark')).toBe('light');
    expect(resolveThemeName('dark', 'light')).toBe('dark');
  });

  it('follows the platform under system', () => {
    expect(resolveThemeName('system', 'light')).toBe('light');
    expect(resolveThemeName('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when the platform reports nothing', () => {
    expect(resolveThemeName('system', null)).toBe('dark');
    expect(resolveThemeName('system', undefined)).toBe('dark');
  });

  it('re-reads the platform every call, so system never freezes', () => {
    // The bug this guards: resolving once at launch and caching. A reader who flips their
    // OS to light with the app open would stay dark until the next cold start.
    expect(resolveThemeName('system', 'dark')).toBe('dark');
    expect(resolveThemeName('system', 'light')).toBe('light');
  });
});

describe('reading a stored preference back', () => {
  it('accepts every value it writes', () => {
    for (const preference of themePreferences) {
      expect(isThemePreference(preference)).toBe(true);
      expect(parseThemePreference(preference)).toBe(preference);
    }
  });

  it('rejects anything else without throwing', () => {
    for (const rubbish of ['', 'Dark', 'sepia', '{"preference":"dark"}', 'null']) {
      expect(isThemePreference(rubbish)).toBe(false);
      expect(parseThemePreference(rubbish)).toBe(DEFAULT_THEME_PREFERENCE);
    }

    expect(parseThemePreference(undefined)).toBe(DEFAULT_THEME_PREFERENCE);
    expect(isThemePreference(undefined)).toBe(false);
    expect(isThemePreference(null)).toBe(false);
    expect(isThemePreference(0)).toBe(false);
  });
});
