/**
 * WCAG contrast audit of the light palette.
 *
 * Purpose
 *   The dark palette failed this audit the first time it was measured (`Q-017`:
 *   `ink.tertiary` at 3.36:1), so the light one was assumed to have its own failures and
 *   was measured rather than eyeballed. Every pair the app renders is locked to a number
 *   here; change a value and this file reports, in ratios, what it cost.
 *
 * What measuring actually found
 *   The first draft of the light palette re-used the dark accents. `accent.cyan`
 *   (`#35D2E8`) measures **1.82:1** on `#FFFFFF` — well under half of AA's 4.5:1 — and
 *   `accent.gold` (`#F0B429`) measures **1.86:1**. Both are unreadable on paper. That is
 *   why the light theme takes the ink-weight version of each hue rather than the dark
 *   theme's, and why "invert the palette" was never a viable plan.
 *
 * Known shortfalls, deliberately asserted as failing
 *   - `ink.tertiary` on every surface (3.17-3.45:1) is below AA's 4.5:1 for normal text.
 *     Identical to the dark theme's shortfall, and identical on purpose: `Q-017`'s usage
 *     rule (large text, icons and rules only) has to hold in both themes or nobody can
 *     follow it.
 *   - Inline badge borders at 35 % opacity (1.65-1.73:1) are decorative. The badge's label
 *     clears AA at 4.72:1 or better on every surface.
 *   - The two hairlines are dividers, not affordances.
 *
 * Where light is better than dark
 *   `accent.cyanDim` clears the 3:1 non-text bar here (3.66:1) where the dark theme's
 *   fails it (2.80:1). The shared usage rule stays the stricter of the two.
 */

import { describe, expect, it } from 'vitest';

import { flattenOver } from './color-math';
import { darkTheme } from './colors';
import { contrastRatio, meetsContrast } from './contrast';
import { lightAuditableSurfaces, lightTheme } from './light-colors';

/** Ratios are compared to one decimal: 0.05 of slack absorbs channel rounding, nothing more. */
const RATIO_PRECISION = 1;

describe('body and supporting text', () => {
  it('puts ink.primary far above AA on every surface', () => {
    expect(contrastRatio(lightTheme.ink.primary, lightAuditableSurfaces.canvas)).toBeCloseTo(
      16.02,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.ink.primary, lightAuditableSurfaces.card)).toBeCloseTo(
      17.44,
      RATIO_PRECISION,
    );
  });

  it('clears AA for ink.secondary on every surface', () => {
    expect(contrastRatio(lightTheme.ink.secondary, lightAuditableSurfaces.canvas)).toBeCloseTo(
      6.94,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(lightAuditableSurfaces)) {
      expect(meetsContrast(lightTheme.ink.secondary, surface, 'aaText')).toBe(true);
    }
  });

  it('FAILS AA for ink.tertiary as normal text — large text, icons and rules only', () => {
    expect(contrastRatio(lightTheme.ink.tertiary, lightAuditableSurfaces.canvas)).toBeCloseTo(
      3.17,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.ink.tertiary, lightAuditableSurfaces.card)).toBeCloseTo(
      3.45,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(lightAuditableSurfaces)) {
      expect(meetsContrast(lightTheme.ink.tertiary, surface, 'aaText')).toBe(false);
      expect(meetsContrast(lightTheme.ink.tertiary, surface, 'aaLarge')).toBe(true);
    }
  });
});

describe('accents as text', () => {
  it('clears AA for gold and cyan on every surface', () => {
    expect(contrastRatio(lightTheme.accent.gold, lightAuditableSurfaces.canvas)).toBeCloseTo(
      5.38,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.accent.cyan, lightAuditableSurfaces.canvas)).toBeCloseTo(
      5.61,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(lightAuditableSurfaces)) {
      expect(meetsContrast(lightTheme.accent.gold, surface, 'aaText')).toBe(true);
      expect(meetsContrast(lightTheme.accent.cyan, surface, 'aaText')).toBe(true);
    }
  });

  it('records why the dark accents could not simply be re-used', () => {
    // The measurement that killed "invert the palette". Locked so nobody tries again.
    expect(contrastRatio(darkTheme.accent.cyan, lightAuditableSurfaces.card)).toBeCloseTo(
      1.82,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.accent.gold, lightAuditableSurfaces.card)).toBeCloseTo(
      1.86,
      RATIO_PRECISION,
    );

    for (const accent of [darkTheme.accent.cyan, darkTheme.accent.gold]) {
      expect(meetsContrast(accent, lightAuditableSurfaces.card, 'aaText')).toBe(false);
      expect(meetsContrast(accent, lightAuditableSurfaces.card, 'nonText')).toBe(false);
    }
  });

  it('clears AA for both state colours', () => {
    expect(contrastRatio(lightTheme.state.success, lightAuditableSurfaces.canvas)).toBeCloseTo(
      4.93,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.state.danger, lightAuditableSurfaces.canvas)).toBeCloseTo(
      6.0,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(lightAuditableSurfaces)) {
      expect(meetsContrast(lightTheme.state.success, surface, 'aaText')).toBe(true);
      expect(meetsContrast(lightTheme.state.danger, surface, 'aaText')).toBe(true);
    }
  });
});

describe('accents as resting borders', () => {
  it('clears the 3:1 non-text bar for both dim accents', () => {
    expect(contrastRatio(lightTheme.accent.goldDim, lightAuditableSurfaces.canvas)).toBeCloseTo(
      3.64,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.accent.cyanDim, lightAuditableSurfaces.canvas)).toBeCloseTo(
      3.66,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(lightAuditableSurfaces)) {
      expect(meetsContrast(lightTheme.accent.goldDim, surface, 'nonText')).toBe(true);
      expect(meetsContrast(lightTheme.accent.cyanDim, surface, 'nonText')).toBe(true);
    }
  });
});

describe('the inline badge', () => {
  it('keeps every badge label above AA against its own 10 percent fill', () => {
    for (const kind of ['route', 'city3d', 'history', 'meditate'] as const) {
      const { tint, surface } = lightTheme.badge[kind];

      for (const paper of Object.values(lightAuditableSurfaces)) {
        expect(meetsContrast(tint, flattenOver(surface, paper), 'aaText')).toBe(true);
      }
    }
  });

  it('measures the worst badge label — gold on its own fill over the canvas', () => {
    const { tint, surface } = lightTheme.badge.city3d;

    expect(contrastRatio(tint, flattenOver(surface, lightAuditableSurfaces.canvas))).toBeCloseTo(
      4.72,
      RATIO_PRECISION,
    );
  });

  it('records that badge borders are decorative, below the non-text bar at 35 percent', () => {
    const border = lightTheme.badge.route.border;

    expect(contrastRatio(border, lightAuditableSurfaces.canvas)).toBeCloseTo(1.69, RATIO_PRECISION);
    expect(meetsContrast(border, lightAuditableSurfaces.canvas, 'nonText')).toBe(false);
  });
});

describe('hairlines', () => {
  it('records that both line tokens are dividers, not affordances', () => {
    expect(contrastRatio(lightTheme.line.hairline, lightAuditableSurfaces.canvas)).toBeCloseTo(
      1.25,
      RATIO_PRECISION,
    );
    expect(contrastRatio(lightTheme.line.strong, lightAuditableSurfaces.canvas)).toBeCloseTo(
      1.52,
      RATIO_PRECISION,
    );
  });
});

describe('the audit is exhaustive', () => {
  it('keeps every ink and accent above the 3:1 bar on every surface', () => {
    const foregrounds = [
      lightTheme.ink.primary,
      lightTheme.ink.secondary,
      lightTheme.ink.tertiary,
      lightTheme.accent.gold,
      lightTheme.accent.goldDim,
      lightTheme.accent.cyan,
      lightTheme.accent.cyanDim,
      lightTheme.state.success,
      lightTheme.state.danger,
    ];

    // A palette entry below 3:1 would have no legal use at all — and a component would
    // reach for it anyway, because nothing about the token's name would say so.
    for (const foreground of foregrounds) {
      for (const surface of Object.values(lightAuditableSurfaces)) {
        expect(meetsContrast(foreground, surface, 'nonText')).toBe(true);
      }
    }
  });
});
