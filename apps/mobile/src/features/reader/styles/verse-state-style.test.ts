/**
 * Tests for the verse row's tone colours, in BOTH themes.
 *
 * Every assertion runs against the dark theme and the light one, because decision `D-01`
 * makes "correct in both" the acceptance criterion rather than an afterthought. The two
 * techniques from `flutter-port-map.md` §7.3 — constant footprint and the fade through
 * paper — are asserted directly: the resting bar must exist and be transparent, and no
 * resting colour may ever be the string `transparent`. `clearOn` itself is covered by
 * `tint.test.ts`; what is covered here is that the tone table actually uses it.
 */

import { colors as darkTheme, lightTheme, toRgbaChannels, type Theme } from '@/theme';
import { describe, expect, it } from 'vitest';

import type { VerseTone } from '../model/verse-selection';

import { verseToneColors } from './verse-state-style';

const THEMES: readonly (readonly [string, Theme])[] = [
  ['dark', darkTheme],
  ['light', lightTheme],
];

const TONES: readonly VerseTone[] = ['rest', 'selected', 'highlighted', 'both'];

describe.each(THEMES)('%s theme', (_name, theme) => {
  it('answers for every tone', () => {
    for (const tone of TONES) {
      const paint = verseToneColors(theme, tone);
      expect(paint.background).toBeTruthy();
      expect(paint.bar).toBeTruthy();
      expect(paint.number).toBeTruthy();
      expect(paint.text).toBe(theme.ink.primary);
    }
  });

  it('fades through paper, never through transparent black', () => {
    const resting = verseToneColors(theme, 'rest');
    for (const color of [resting.background, resting.bar]) {
      expect(color).not.toBe('transparent');
      const channels = toRgbaChannels(color);
      expect(channels.alpha).toBe(0);
      // The invisible colour must still BE the canvas, so an interpolation towards it
      // never travels through grey.
      const canvas = toRgbaChannels(theme.background.canvas);
      expect([channels.red, channels.green, channels.blue]).toEqual([
        canvas.red,
        canvas.green,
        canvas.blue,
      ]);
    }
  });

  it('keeps the bar present at rest, so selection reflows nothing', () => {
    // Constant footprint: `rest` returns a bar colour rather than omitting one, which is
    // what lets the row render a fixed-width bar in every state.
    expect(verseToneColors(theme, 'rest').bar).toBeDefined();
  });

  it('never changes the scripture colour with the tone', () => {
    const inks = TONES.map((tone) => verseToneColors(theme, tone).text);
    expect(new Set(inks).size).toBe(1);
  });

  it('gives the four tones four distinct backgrounds', () => {
    const fills = TONES.map((tone) => verseToneColors(theme, tone).background);
    expect(new Set(fills).size).toBe(TONES.length);
  });

  it('makes "both" the strongest of the three active tones', () => {
    const alpha = (tone: VerseTone): number =>
      toRgbaChannels(verseToneColors(theme, tone).background).alpha;
    expect(alpha('both')).toBeGreaterThan(alpha('highlighted'));
    expect(alpha('highlighted')).toBeGreaterThan(alpha('selected'));
    expect(alpha('selected')).toBeGreaterThan(alpha('rest'));
  });

  it('paints the verse number gold in every tone — §3, gold means "you"', () => {
    for (const tone of TONES) {
      expect(verseToneColors(theme, tone).number).toBe(theme.accent.gold);
    }
  });
});
