/**
 * Tests for great-circle distance and its captions.
 *
 * The assertions use published distances between real places rather than the function's
 * own output, because the failure mode being guarded against is a plausible-looking wrong
 * number: a stat strip reading "812 mi" is not obviously wrong to anyone reading the sheet.
 */

import { describe, expect, it } from 'vitest';

import { formatCount, formatMiles, greatCircleMiles, spanMiles } from './distance';
import type { GeoPoint } from './projection';

const TROAS: GeoPoint = [26.158611, 39.751944];
const SAMOTHRACE: GeoPoint = [25.53, 40.46];
const NEAPOLIS: GeoPoint = [24.05, 40.94];
const PHILIPPI: GeoPoint = [24.286944, 41.013611];
const JERUSALEM: GeoPoint = [35.234167, 31.776667];
const ROME: GeoPoint = [12.486, 41.893];

describe('greatCircleMiles', () => {
  it('is zero for a point and itself', () => {
    expect(greatCircleMiles(TROAS, TROAS)).toBe(0);
  });

  it('is symmetric', () => {
    expect(greatCircleMiles(TROAS, PHILIPPI)).toBeCloseTo(greatCircleMiles(PHILIPPI, TROAS), 12);
  });

  it('matches the known Jerusalem-to-Rome great circle of about 1,434 miles', () => {
    expect(greatCircleMiles(JERUSALEM, ROME)).toBeGreaterThan(1420);
    expect(greatCircleMiles(JERUSALEM, ROME)).toBeLessThan(1450);
  });

  it('measures one degree of latitude as about 69 miles', () => {
    expect(greatCircleMiles([25, 40], [25, 41])).toBeCloseTo(69.09, 1);
  });

  it('shrinks a degree of longitude by the cosine of the latitude', () => {
    const atEquator = greatCircleMiles([0, 0], [1, 0]);
    const atForty = greatCircleMiles([0, 40], [1, 40]);
    expect(atForty / atEquator).toBeCloseTo(Math.cos((40 * Math.PI) / 180), 3);
  });

  it('keeps precision on a short Aegean leg', () => {
    // Neapolis to Philippi is about 9 miles inland — the leg a law-of-cosines
    // implementation would round away.
    const leg = greatCircleMiles(NEAPOLIS, PHILIPPI);
    expect(leg).toBeGreaterThan(8);
    expect(leg).toBeLessThan(15);
  });
});

describe('spanMiles', () => {
  it('is zero for no points and for one point', () => {
    expect(spanMiles([])).toBe(0);
    expect(spanMiles([TROAS])).toBe(0);
  });

  it('is the widest gap in the set, not the sum of the gaps', () => {
    const points = [TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI];
    const widest = Math.max(
      greatCircleMiles(TROAS, SAMOTHRACE),
      greatCircleMiles(TROAS, NEAPOLIS),
      greatCircleMiles(TROAS, PHILIPPI),
      greatCircleMiles(SAMOTHRACE, NEAPOLIS),
      greatCircleMiles(SAMOTHRACE, PHILIPPI),
      greatCircleMiles(NEAPOLIS, PHILIPPI),
    );
    const summed =
      greatCircleMiles(TROAS, SAMOTHRACE) +
      greatCircleMiles(SAMOTHRACE, NEAPOLIS) +
      greatCircleMiles(NEAPOLIS, PHILIPPI);

    expect(spanMiles(points)).toBeCloseTo(widest, 9);
    expect(spanMiles(points)).toBeLessThan(summed);
  });

  it('cannot be changed by reordering the pins', () => {
    const forwards = spanMiles([TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI, JERUSALEM]);
    const shuffled = spanMiles([JERUSALEM, NEAPOLIS, TROAS, PHILIPPI, SAMOTHRACE]);
    expect(shuffled).toBeCloseTo(forwards, 9);
  });

  it('is driven by the outlier, which is the point of the figure', () => {
    // Jerusalem is named in Acts 16:4 without anyone going there. It is still the pin
    // that decides how much of the world the chapter's map has to cover.
    const aegean = spanMiles([TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI]);
    const withJerusalem = spanMiles([TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI, JERUSALEM]);
    expect(withJerusalem).toBeGreaterThan(aegean * 2);
  });

  it('never goes down when a pin is added', () => {
    const four = spanMiles([TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI]);
    const five = spanMiles([TROAS, SAMOTHRACE, NEAPOLIS, PHILIPPI, ROME]);
    expect(five).toBeGreaterThanOrEqual(four);
  });
});

describe('formatMiles', () => {
  /** The space the figure is joined to its unit with: U+00A0, never a plain space. */
  const NO_BREAK_SPACE = '\u00a0';

  it('groups thousands', () => {
    expect(formatMiles(1434.2)).toBe(`1,434${NO_BREAK_SPACE}mi`);
  });

  it('rounds to a whole mile', () => {
    expect(formatMiles(124.6)).toBe(`125${NO_BREAK_SPACE}mi`);
  });

  it('joins the figure to its unit unbreakably, so a narrow rail cannot split them', () => {
    // The 232 dp context rail wrapped `3,575 mi` onto two lines, which reads as two
    // facts. Asserted on the codepoint rather than on the rendering.
    expect(formatMiles(3575)).not.toContain(' ');
    expect(formatMiles(3575)).toContain(NO_BREAK_SPACE);
  });

  it('refuses a distance too small to mean anything, rather than printing 0 mi', () => {
    expect(formatMiles(0)).toBeNull();
    expect(formatMiles(0.2)).toBeNull();
  });

  it('refuses a non-finite figure', () => {
    expect(formatMiles(Number.NaN)).toBeNull();
    expect(formatMiles(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatCount', () => {
  it('prints a plain count', () => {
    expect(formatCount(20)).toBe('20');
  });

  it('never prints a negative or fractional count', () => {
    expect(formatCount(-3)).toBe('0');
    expect(formatCount(4.7)).toBe('4');
  });
});
