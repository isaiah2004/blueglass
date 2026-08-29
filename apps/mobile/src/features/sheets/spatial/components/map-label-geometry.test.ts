/**
 * Tests for label placement.
 *
 * SVG text overflows its viewport silently, so every one of these is guarding against a
 * failure that produces no error and no warning — just a place name sliced in half at the
 * edge of the sheet.
 */

import { describe, expect, it } from 'vitest';

import type { Viewport } from '../geo/projection';

import { placeLabel, plateWidth } from './map-label-geometry';

const SHEET: Viewport = { width: 360, height: 240 };
const FONT = 11;

describe('plateWidth', () => {
  it('grows with the name', () => {
    expect(plateWidth('Samothrace', FONT)).toBeGreaterThan(plateWidth('Troas', FONT));
  });

  it('grows with the font size', () => {
    expect(plateWidth('Troas', 15)).toBeGreaterThan(plateWidth('Troas', FONT));
  });

  it('leaves room for an empty name rather than collapsing to nothing', () => {
    expect(plateWidth('', FONT)).toBeGreaterThan(0);
  });

  it('over-estimates rather than under-estimates — a clipped name is the failure', () => {
    // Inter's widest lower-case advances are around 0.62 em; a ten-character name must fit.
    expect(plateWidth('Samothrace', FONT)).toBeGreaterThanOrEqual(10 * FONT * 0.62);
  });
});

describe('placeLabel', () => {
  it('sits to the right of a pin with room', () => {
    const placement = placeLabel({ x: 60, y: 120 }, 'Troas', FONT, SHEET);
    expect(placement.side).toBe('right');
    expect(placement.x).toBeGreaterThan(60);
  });

  it('flips to the left of a pin near the right edge', () => {
    const placement = placeLabel({ x: 340, y: 120 }, 'Thyatira', FONT, SHEET);
    expect(placement.side).toBe('left');
    expect(placement.x + placement.width).toBeLessThanOrEqual(SHEET.width);
  });

  it('keeps the whole plate inside the viewport, wherever the pin is', () => {
    const corners = [
      { x: 0, y: 0 },
      { x: SHEET.width, y: 0 },
      { x: 0, y: SHEET.height },
      { x: SHEET.width, y: SHEET.height },
      { x: -40, y: -40 },
      { x: SHEET.width + 40, y: SHEET.height + 40 },
    ];
    for (const pin of corners) {
      const placement = placeLabel(pin, 'Samothrace', FONT, SHEET);
      expect(placement.x).toBeGreaterThanOrEqual(0);
      expect(placement.y).toBeGreaterThanOrEqual(0);
      expect(placement.x + placement.width).toBeLessThanOrEqual(SHEET.width + 0.001);
      expect(placement.y + placement.height).toBeLessThanOrEqual(SHEET.height + 0.001);
    }
  });

  it('centres the plate vertically on its pin', () => {
    const placement = placeLabel({ x: 100, y: 120 }, 'Troas', FONT, SHEET);
    expect(placement.y + placement.height / 2).toBeCloseTo(120, 9);
  });

  it('puts the baseline inside the plate', () => {
    const placement = placeLabel({ x: 100, y: 120 }, 'Troas', FONT, SHEET);
    expect(placement.textY).toBeGreaterThan(placement.y);
    expect(placement.textY).toBeLessThan(placement.y + placement.height);
  });

  it('insets the text from the plate edge', () => {
    const placement = placeLabel({ x: 100, y: 120 }, 'Troas', FONT, SHEET);
    expect(placement.textX).toBeGreaterThan(placement.x);
    expect(placement.textX).toBeLessThan(placement.x + placement.width);
  });

  it('does not fall apart when the label is wider than the viewport', () => {
    const narrow: Viewport = { width: 40, height: 240 };
    const placement = placeLabel({ x: 20, y: 120 }, 'Caesarea Philippi', FONT, narrow);
    expect(placement.x).toBe(0);
    expect(Number.isFinite(placement.width)).toBe(true);
  });
});
