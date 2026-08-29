/**
 * WCAG contrast audit of the dark palette.
 *
 * Purpose
 *   Question `D-06`'s standing default sets the bar at "AA for text contrast". A near-black
 *   canvas with saturated accents can fail that quietly, so every pair the app actually
 *   renders is measured here and locked to a number. Change a palette value and this file
 *   tells you, in ratios, what it cost.
 *
 * How to read a failure
 *   A changed ratio is not automatically a bug — it is a decision. Update the number *and*
 *   the note on the token, or put the colour back.
 *
 * Known shortfalls, deliberately asserted as failing
 *   - `ink.tertiary` on every surface (3.15-3.67:1) is below AA's 4.5:1 for normal text.
 *     Legal for large text, icons and rules; the 9-11 pt metadata style uses `ink.secondary`
 *     instead (assumption `Q-017`).
 *   - `accent.cyanDim` as a border (2.80:1) is below the 3:1 non-text bar. It is a resting
 *     decorative edge whose meaning is carried by the cyan label beside it, not by the edge.
 *   - Inline badge borders at 35 % opacity (1.68-2.18:1) are decorative for the same reason:
 *     the badge's label clears AA at 5.68:1 or better on every surface.
 */

import { describe, expect, it } from 'vitest';

import { flattenOver } from './color-math';
import { auditableSurfaces, darkTheme } from './colors';
import { contrastRatio, meetsContrast } from './contrast';

/** Ratios are compared to one decimal: 0.05 of slack absorbs channel rounding, nothing more. */
const RATIO_PRECISION = 1;

describe('body and supporting text', () => {
  it('puts ink.primary far above AA on every surface', () => {
    expect(contrastRatio(darkTheme.ink.primary, auditableSurfaces.canvas)).toBeCloseTo(
      17.14,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.ink.primary, auditableSurfaces.card)).toBeCloseTo(
      15.7,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.ink.primary, auditableSurfaces.cardHover)).toBeCloseTo(
      14.72,
      RATIO_PRECISION,
    );
  });

  it('clears AA for ink.secondary on every surface', () => {
    expect(contrastRatio(darkTheme.ink.secondary, auditableSurfaces.canvas)).toBeCloseTo(
      7.61,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.ink.secondary, auditableSurfaces.cardHover)).toBeCloseTo(
      6.53,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(auditableSurfaces)) {
      expect(meetsContrast(darkTheme.ink.secondary, surface, 'aaText')).toBe(true);
    }
  });

  it('FAILS AA for ink.tertiary as normal text — large text, icons and rules only', () => {
    expect(contrastRatio(darkTheme.ink.tertiary, auditableSurfaces.canvas)).toBeCloseTo(
      3.67,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.ink.tertiary, auditableSurfaces.cardHover)).toBeCloseTo(
      3.15,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(auditableSurfaces)) {
      expect(meetsContrast(darkTheme.ink.tertiary, surface, 'aaText')).toBe(false);
      expect(meetsContrast(darkTheme.ink.tertiary, surface, 'aaLarge')).toBe(true);
    }
  });
});

describe('accents as text', () => {
  it('clears AA for gold on every surface — the small-size risk the brief flagged does not land', () => {
    expect(contrastRatio(darkTheme.accent.gold, auditableSurfaces.canvas)).toBeCloseTo(
      10.81,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.accent.gold, auditableSurfaces.cardHover)).toBeCloseTo(
      9.28,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(auditableSurfaces)) {
      expect(meetsContrast(darkTheme.accent.gold, surface, 'aaText')).toBe(true);
    }
  });

  it('clears AA for cyan on every surface', () => {
    expect(contrastRatio(darkTheme.accent.cyan, auditableSurfaces.canvas)).toBeCloseTo(
      11.07,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(auditableSurfaces)) {
      expect(meetsContrast(darkTheme.accent.cyan, surface, 'aaText')).toBe(true);
    }
  });

  it('clears AA for both state colours', () => {
    expect(contrastRatio(darkTheme.state.success, auditableSurfaces.canvas)).toBeCloseTo(
      10.48,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.state.danger, auditableSurfaces.canvas)).toBeCloseTo(
      7.28,
      RATIO_PRECISION,
    );

    for (const surface of Object.values(auditableSurfaces)) {
      expect(meetsContrast(darkTheme.state.success, surface, 'aaText')).toBe(true);
      expect(meetsContrast(darkTheme.state.danger, surface, 'aaText')).toBe(true);
    }
  });
});

describe('accents as resting borders', () => {
  it('clears the 3:1 non-text bar for goldDim', () => {
    expect(contrastRatio(darkTheme.accent.goldDim, auditableSurfaces.canvas)).toBeCloseTo(
      3.76,
      RATIO_PRECISION,
    );
    expect(meetsContrast(darkTheme.accent.goldDim, auditableSurfaces.canvas, 'nonText')).toBe(true);
  });

  it('FAILS the 3:1 non-text bar for cyanDim — decorative edges only, never a lone affordance', () => {
    expect(contrastRatio(darkTheme.accent.cyanDim, auditableSurfaces.canvas)).toBeCloseTo(
      2.8,
      RATIO_PRECISION,
    );
    expect(meetsContrast(darkTheme.accent.cyanDim, auditableSurfaces.canvas, 'nonText')).toBe(
      false,
    );
  });
});

describe('the inline badge', () => {
  it.each(['route', 'history', 'meditate'] as const)(
    'keeps the %s badge label above AA against its own 10 percent fill',
    (kind) => {
      const { tint, surface } = darkTheme.badge[kind];
      const filledPill = flattenOver(surface, auditableSurfaces.canvas);

      expect(meetsContrast(tint, filledPill, 'aaText')).toBe(true);
    },
  );

  it('measures the worst badge label — history blue on its own fill', () => {
    const { tint, surface } = darkTheme.badge.history;
    const onCanvas = flattenOver(surface, auditableSurfaces.canvas);
    const onCard = flattenOver(surface, auditableSurfaces.card);

    expect(contrastRatio(tint, onCanvas)).toBeCloseTo(5.68, RATIO_PRECISION);
    expect(contrastRatio(tint, onCard)).toBeCloseTo(5.04, RATIO_PRECISION);
  });

  it('records that badge borders are decorative, below the non-text bar at 35 percent', () => {
    const border = darkTheme.badge.route.border;

    expect(contrastRatio(border, auditableSurfaces.canvas)).toBeCloseTo(2.18, RATIO_PRECISION);
    expect(meetsContrast(border, auditableSurfaces.canvas, 'nonText')).toBe(false);
  });
});

describe('hairlines', () => {
  it('records that both line tokens are dividers, not affordances', () => {
    expect(contrastRatio(darkTheme.line.hairline, auditableSurfaces.canvas)).toBeCloseTo(
      1.17,
      RATIO_PRECISION,
    );
    expect(contrastRatio(darkTheme.line.strong, auditableSurfaces.canvas)).toBeCloseTo(
      1.5,
      RATIO_PRECISION,
    );
  });
});
