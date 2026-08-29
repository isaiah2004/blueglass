/**
 * Tests for the reading canvas's scroll arithmetic.
 *
 * The auto-pin boundary is asserted on both sides of the threshold, because the whole
 * value of the behaviour is what happens one pixel past it.
 */

import { describe, expect, it } from 'vitest';

import {
  AUTO_PIN_THRESHOLD_PX,
  distanceFromBottom,
  offsetToFocusVerse,
  shouldAutoPin,
  VERSE_FOCUS_VIEWPORT_POSITION,
  type ScrollMetrics,
} from './reader-scroll';

/** A 4 000 dp chapter in an 800 dp viewport, scrolled to `offsetY`. */
const at = (offsetY: number): ScrollMetrics => ({
  offsetY,
  contentHeight: 4000,
  viewportHeight: 800,
});

describe('distanceFromBottom', () => {
  it('measures the remaining scroll', () => {
    expect(distanceFromBottom(at(0))).toBe(3200);
    expect(distanceFromBottom(at(3200))).toBe(0);
  });

  it('clamps an over-scroll bounce to zero rather than reporting a negative', () => {
    expect(distanceFromBottom(at(3400))).toBe(0);
  });

  it('reports zero when the content is shorter than the viewport', () => {
    expect(distanceFromBottom({ offsetY: 0, contentHeight: 300, viewportHeight: 800 })).toBe(0);
  });
});

describe('shouldAutoPin', () => {
  it('pins when the reader is already at the bottom', () => {
    expect(shouldAutoPin(at(3200))).toBe(true);
  });

  it('pins exactly at the threshold and refuses one pixel beyond it', () => {
    const threshold = AUTO_PIN_THRESHOLD_PX.reader;
    expect(shouldAutoPin(at(3200 - threshold))).toBe(true);
    expect(shouldAutoPin(at(3200 - threshold - 1))).toBe(false);
  });

  it('never yanks a reader who scrolled up to re-read', () => {
    expect(shouldAutoPin(at(0))).toBe(false);
  });

  it('uses the looser conversation threshold when asked', () => {
    const between = 3200 - (AUTO_PIN_THRESHOLD_PX.reader + AUTO_PIN_THRESHOLD_PX.conversation) / 2;
    expect(shouldAutoPin(at(between), 'reader')).toBe(false);
    expect(shouldAutoPin(at(between), 'conversation')).toBe(true);
  });
});

describe('offsetToFocusVerse', () => {
  it('lands the verse 18 % down the viewport', () => {
    const metrics = at(0);
    const verseTop = 2000;
    const offset = offsetToFocusVerse(verseTop, metrics);
    expect(verseTop - offset).toBeCloseTo(
      metrics.viewportHeight * VERSE_FOCUS_VIEWPORT_POSITION,
      5,
    );
  });

  it('does not scroll above the top for the first verses', () => {
    expect(offsetToFocusVerse(20, at(0))).toBe(0);
  });

  it('does not ask for an offset past the end of the content', () => {
    expect(offsetToFocusVerse(3990, at(0))).toBe(3200);
  });

  it('returns zero when the content does not scroll at all', () => {
    expect(offsetToFocusVerse(200, { offsetY: 0, contentHeight: 300, viewportHeight: 800 })).toBe(
      0,
    );
  });
});
