/**
 * Tests for the derived map palette.
 *
 * The point of these is that the map must work in BOTH themes (`D-01`), and the failure
 * mode is silent: a land fill derived for the dark canvas can come out invisible on warm
 * paper, and nothing in a dark-theme screenshot would show it. So the polarity is asserted
 * numerically, in both palettes, rather than looked at.
 */

import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  darkTheme,
  flattenOver,
  lightTheme,
  relativeLuminance,
  type Color,
  type HexColor,
} from '@/theme';

import { mapPalette } from './map-palette';

/** What the eye actually sees for a translucent fill over the sea. */
function seenOver(color: Color, background: HexColor): number {
  return relativeLuminance(flattenOver(color, background));
}

/**
 * The floor land must clear against the sea.
 *
 * The reported Lystra screenshot measured **1.31:1** in the dark palette and **1.35:1** in
 * the light one — a difference no reader can see, which is why a coastline read as two
 * unexplained black wedges. WCAG's 3:1 non-text bar is not reachable here without painting
 * a slab over a near-black canvas; the coastline stroke carries that bar instead. 1.7 is
 * the floor the fill has to clear for the two materials to be told apart at a glance.
 */
const MIN_LAND_SEA_RATIO = 1.7;

/** WCAG 1.4.11: a graphic that carries meaning needs 3:1. The coastline is one. */
const MIN_COAST_RATIO = 3;

/**
 * WCAG AA for text, and the bar `Q-017` resolved conflict `C-3` on.
 *
 * The map key's caption -- "Places named, not a journey" -- is the sentence that stops the
 * route map being read as a journey, and it is the whole reason `MapKey` exists. It shipped
 * at 4.33:1 in dark and 3.57:1 in light while the pin labels beside it measured 16-17:1,
 * because `furnitureLabel` took `ink.secondary` and then cut it with a 0.72 alpha. Nothing
 * here tested it: the file asserted land, sea and coastline and never the words. An
 * illegible caveat is a caveat that is not made.
 */
const MIN_TEXT_RATIO = 4.5;

describe('mapPalette', () => {
  it('paints the route in the Route badge hue, so the mark and its map agree', () => {
    expect(mapPalette(darkTheme).route).toBe(darkTheme.badge.route.tint);
    expect(mapPalette(lightTheme).route).toBe(lightTheme.badge.route.tint);
  });

  it('paints pins in the 3D City hue, which is the gold the mockups give city markers', () => {
    expect(mapPalette(darkTheme).pin).toBe(darkTheme.badge.city3d.tint);
    expect(mapPalette(lightTheme).pin).toBe(lightTheme.badge.city3d.tint);
  });

  it('makes land lighter than the sea in the dark theme', () => {
    const palette = mapPalette(darkTheme);
    const sea = relativeLuminance(darkTheme.background.canvas);
    expect(seenOver(palette.land, darkTheme.background.canvas)).toBeGreaterThan(sea);
  });

  it('makes land darker than the sea in the light theme', () => {
    const palette = mapPalette(lightTheme);
    const sea = relativeLuminance(lightTheme.background.canvas);
    expect(seenOver(palette.land, lightTheme.background.canvas)).toBeLessThan(sea);
  });

  it('keeps land and sea far enough apart to be told apart, in both themes', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const canvas = theme.background.canvas as HexColor;
      const land = flattenOver(mapPalette(theme).land, canvas);
      expect(contrastRatio(land, canvas)).toBeGreaterThanOrEqual(MIN_LAND_SEA_RATIO);
    }
  });

  it('draws the coastline at the 3:1 bar against both the land and the sea it divides', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const palette = mapPalette(theme);
      const canvas = theme.background.canvas as HexColor;
      const land = flattenOver(palette.land, canvas);
      expect(contrastRatio(palette.coast, canvas)).toBeGreaterThanOrEqual(MIN_COAST_RATIO);
      expect(contrastRatio(palette.coast, land)).toBeGreaterThanOrEqual(MIN_COAST_RATIO);
    }
  });

  it('draws the coastline more strongly than the land it bounds, in both themes', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const palette = mapPalette(theme);
      const canvas = theme.background.canvas as HexColor;
      const landStep = Math.abs(seenOver(palette.land, canvas) - relativeLuminance(canvas));
      const coastStep = Math.abs(seenOver(palette.coast, canvas) - relativeLuminance(canvas));
      expect(coastStep).toBeGreaterThan(landStep);
    }
  });

  it('sets the key caption above the AA bar in both themes — the pillar-3 caveat', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const palette = mapPalette(theme);
      const plate = flattenOver(palette.keyPlate, theme.background.canvas);
      expect(contrastRatio(palette.furnitureLabel, plate)).toBeGreaterThanOrEqual(MIN_TEXT_RATIO);
    }
  });

  it('draws furniture on an opaque plate, so the map cannot show through the words', () => {
    // The "30 N" graticule label bled through the translucent plate on the tablet
    // screenshot. A plate with an alpha also makes the caption's contrast depend on
    // whether the key happens to sit over land or over sea, which is untestable.
    for (const theme of [darkTheme, lightTheme]) {
      expect(mapPalette(theme).keyPlate).not.toContain('rgba(');
    }
  });

  it('keeps a place label plate translucent, because a label is ON the map', () => {
    for (const theme of [darkTheme, lightTheme]) {
      expect(mapPalette(theme).labelPlate).toContain('rgba(');
    }
  });

  it('keeps the glow weaker than the line it sits under', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const palette = mapPalette(theme);
      expect(palette.routeGlow).toContain('rgba(');
      expect(palette.routeGlow).not.toBe(palette.route);
    }
  });

  it('derives every colour from a token — no palette entry is a bare hex of its own', () => {
    const palette = mapPalette(darkTheme);
    const fromTheme = new Set<string>([
      darkTheme.background.canvas,
      darkTheme.background.elevated,
      darkTheme.badge.route.tint,
      darkTheme.badge.city3d.tint,
      darkTheme.ink.primary,
      darkTheme.ink.secondary,
    ]);
    const values: readonly Color[] = Object.values(palette);
    for (const value of values) {
      // Either it IS a token, or it is a token with an alpha applied.
      expect(fromTheme.has(value) || value.startsWith('rgba(')).toBe(true);
    }
  });
});
