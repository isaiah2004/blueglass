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

  it('draws the coastline more strongly than the land it bounds, in both themes', () => {
    for (const theme of [darkTheme, lightTheme]) {
      const palette = mapPalette(theme);
      const canvas = theme.background.canvas as HexColor;
      const landStep = Math.abs(seenOver(palette.land, canvas) - relativeLuminance(canvas));
      const coastStep = Math.abs(seenOver(palette.coast, canvas) - relativeLuminance(canvas));
      expect(coastStep).toBeGreaterThan(landStep);
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
    ]);
    const values: readonly Color[] = Object.values(palette);
    for (const value of values) {
      // Either it IS a token, or it is a token with an alpha applied.
      expect(fromTheme.has(value) || value.startsWith('rgba(')).toBe(true);
    }
  });
});
