/**
 * Tests for the scale bar.
 *
 * A scale bar is a measurement claim printed on a picture, so the assertions are against
 * the published Web Mercator ground resolution rather than against the implementation's own
 * output. A bar that is 20 % wrong looks exactly like a bar that is right.
 */

import { describe, expect, it } from 'vitest';

import { transformForZoom, type Viewport } from './projection';
import { metresPerPixel, scaleBar } from './scale-bar';

const SHEET: Viewport = { width: 360, height: 240 };

describe('metresPerPixel', () => {
  it('matches the published resolution at the equator, zoom 0, 512 px world', () => {
    // 40,075,016.686 m / 512 px = 78,271.5 m per pixel.
    expect(metresPerPixel(transformForZoom([0, 0], 0, SHEET), 0)).toBeCloseTo(78271.5, 1);
  });

  it('halves with each zoom level', () => {
    const atFour = metresPerPixel(transformForZoom([0, 0], 4, SHEET), 0);
    const atFive = metresPerPixel(transformForZoom([0, 0], 5, SHEET), 0);
    expect(atFour / atFive).toBeCloseTo(2, 9);
  });

  it('shrinks with the cosine of the latitude', () => {
    const transform = transformForZoom([0, 0], 6, SHEET);
    const ratio = metresPerPixel(transform, 40) / metresPerPixel(transform, 0);
    expect(ratio).toBeCloseTo(Math.cos((40 * Math.PI) / 180), 9);
  });

  it('refuses a degenerate transform rather than returning a plausible number', () => {
    expect(metresPerPixel({ scale: 0, offsetX: 0, offsetY: 0 }, 40)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('scaleBar', () => {
  it('prints a round distance, never an arbitrary one', () => {
    const bar = scaleBar(transformForZoom([32.34, 37.6], 10, SHEET), 37.6, 120);
    expect(bar!.label).toMatch(/^(0\.1|0\.2|0\.5|[125]0{0,3}(,\d{3})?) mi$/);
  });

  it('fits inside the width it is given', () => {
    for (const zoom of [4, 6, 8, 10, 12]) {
      const bar = scaleBar(transformForZoom([32.34, 37.6], zoom, SHEET), 37.6, 120);
      expect(bar).not.toBeNull();
      expect(bar!.widthPx).toBeLessThanOrEqual(120);
    }
  });

  it('takes the largest round distance that fits, not the smallest', () => {
    const bar = scaleBar(transformForZoom([32.34, 37.6], 8, SHEET), 37.6, 120);
    // The next step up would overflow; this one must use more than a third of the room.
    expect(bar!.widthPx).toBeGreaterThan(40);
  });

  it('shows a shorter distance as the map zooms in', () => {
    const wide = scaleBar(transformForZoom([32.34, 37.6], 5, SHEET), 37.6, 120);
    const close = scaleBar(transformForZoom([32.34, 37.6], 12, SHEET), 37.6, 120);
    const asMiles = (label: string): number => Number(label.replace(/[^\d.]/g, ''));
    expect(asMiles(close!.label)).toBeLessThan(asMiles(wide!.label));
  });

  it('draws no bar rather than an unreadable stub a few pixels long', () => {
    // At zoom 0 the largest round distance that fits in 10 px is 200 mi — drawn 5 px long,
    // which is a tick, not a ruler.
    expect(scaleBar(transformForZoom([32.34, 37.6], 0, SHEET), 37.6, 10)).toBeNull();
    expect(scaleBar(transformForZoom([32.34, 37.6], 8, SHEET), 37.6, 0)).toBeNull();
  });

  it('never draws a bar shorter than it is legible', () => {
    for (const zoom of [0, 2, 4, 6, 8, 10, 14]) {
      const bar = scaleBar(transformForZoom([32.34, 37.6], zoom, SHEET), 37.6, 120);
      if (bar !== null) expect(bar.widthPx).toBeGreaterThanOrEqual(24);
    }
  });

  it('reports a different distance at a different latitude, as Mercator requires', () => {
    const transform = transformForZoom([32.34, 37.6], 8, SHEET);
    const equator = scaleBar(transform, 0, 120);
    const north = scaleBar(transform, 60, 120);
    // The pixel widths happen to coincide exactly, because cos(60 deg) is one half and the
    // nice-distance ladder doubles: 100 mi at 60 N is the same bar length as 200 mi at the
    // equator. What must differ is what the bar SAYS.
    expect(north!.label).not.toBe(equator!.label);
  });
});
