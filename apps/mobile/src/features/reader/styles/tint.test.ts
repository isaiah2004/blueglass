/**
 * Tests for alpha over a token colour.
 *
 * The round trip through `toRgbaChannels` is what matters: whatever comes back must be a
 * colour the theme layer can read again, in both directions, for both input forms.
 */

import { colors, lightTheme, toRgbaChannels } from '@/theme';
import { describe, expect, it } from 'vitest';

import { clearOn, tint } from './tint';

describe('tint', () => {
  it('keeps the hue and replaces the alpha, from a hex token', () => {
    expect(toRgbaChannels(tint('#FBF9F5', 0.5))).toEqual({
      red: 251,
      green: 249,
      blue: 245,
      alpha: 0.5,
    });
  });

  it('accepts a colour that is already translucent', () => {
    const once = tint(colors.accent.gold, 0.5);
    const twice = tint(once, 0.25);
    expect(toRgbaChannels(twice).alpha).toBe(0.25);
    expect(toRgbaChannels(twice).red).toBe(toRgbaChannels(colors.accent.gold).red);
  });

  it('produces a colour the theme layer can read back', () => {
    for (const theme of [colors, lightTheme]) {
      for (const role of [theme.ink.primary, theme.accent.gold, theme.background.canvas]) {
        expect(() => toRgbaChannels(tint(role, 0.3))).not.toThrow();
      }
    }
  });

  it('clamps rather than throwing, so a slip cannot cost a reader their chapter', () => {
    expect(toRgbaChannels(tint('#FFFFFF', 2)).alpha).toBe(1);
    expect(toRgbaChannels(tint('#FFFFFF', -1)).alpha).toBe(0);
  });
});

describe('clearOn', () => {
  it('is the colour at zero alpha, never transparent black', () => {
    const cleared = clearOn(lightTheme.background.canvas);
    const canvas = toRgbaChannels(lightTheme.background.canvas);
    expect(cleared).not.toBe('transparent');
    expect(toRgbaChannels(cleared)).toEqual({ ...canvas, alpha: 0 });
  });

  it('differs between the two themes’ papers', () => {
    expect(clearOn(colors.background.canvas)).not.toBe(clearOn(lightTheme.background.canvas));
  });
});
