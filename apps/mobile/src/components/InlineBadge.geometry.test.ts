/**
 * Tests for the inline-badge geometry.
 *
 * Purpose
 *   The badge's size and its per-platform baseline nudge are the two numbers the whole spike
 *   turns on, and neither can be checked by eye on one platform. These tests pin them to the
 *   design language's stated band and prove the correction makes the platforms agree.
 */

import { describe, expect, it } from 'vitest';

import { scriptureSize, scriptureText, size } from '@/theme';

import {
  badgeBaselineOffset,
  badgeGeometry,
  bottomEdgeBelowLabelBaseline,
  fitsControlHeight,
  fitsLineBox,
  type BadgePlatform,
} from './InlineBadge.geometry';

/** `design-language.md` §5 fixes the pill's height at 22-24 pt over §3's reading range. */
const DESIGN_HEIGHT_MIN = 22;

/** The upper end of that band. */
const DESIGN_HEIGHT_MAX = 24;

/**
 * Where the pill's bottom edge ends up relative to the text baseline, after the nudge.
 *
 * Mirrors the two host rules the component relies on, so the assertion is about the rendered
 * result rather than about the function's own arithmetic.
 *
 * @param platform - Which platform.
 * @returns Points below the baseline. Positive is below.
 */
function bottomEdgeBelowBaseline(platform: BadgePlatform): number {
  const nudge = badgeBaselineOffset('textAttachment', platform);
  if (platform !== 'web') {
    // Native attaches the view with its bottom edge on the baseline.
    return nudge;
  }
  // The web aligns the pill by its own label's baseline.
  return bottomEdgeBelowLabelBaseline() + nudge;
}

describe('badgeGeometry', () => {
  it('keeps the pill inside the design language 22-24 pt band across the reading range', () => {
    for (const step of ['sm', 'md', 'lg'] as const) {
      const { height } = badgeGeometry(step);
      expect(height).toBeGreaterThanOrEqual(DESIGN_HEIGHT_MIN);
      expect(height).toBeLessThanOrEqual(DESIGN_HEIGHT_MAX);
    }
  });

  it('grows with the scripture size so a reader text-size change keeps the proportion', () => {
    expect(badgeGeometry('sm').height).toBeLessThan(badgeGeometry('md').height);
    expect(badgeGeometry('md').height).toBeLessThan(badgeGeometry('lg').height);
    expect(badgeGeometry('lg').height).toBeLessThan(badgeGeometry('title').height);
  });

  it('makes a true pill: the radius is exactly half the height', () => {
    const geometry = badgeGeometry('md');
    expect(geometry.borderRadius * 2).toBe(geometry.height);
  });

  it('leaves non-negative vertical padding, so the label never overflows the pill', () => {
    for (const step of ['sm', 'md', 'lg', 'title', 'display'] as const) {
      expect(badgeGeometry(step).paddingVertical).toBeGreaterThanOrEqual(0);
    }
  });

  it('defaults to the 20 pt reading size', () => {
    expect(badgeGeometry()).toStrictEqual(badgeGeometry('md'));
    expect(scriptureSize.md).toBe(20);
  });
});

describe('fitsLineBox', () => {
  it('holds at every scripture size — a pill that overflows overlaps the line ABOVE it', () => {
    // Android will not grow a line to fit a tall inline view; see the function's docstring.
    for (const step of ['sm', 'md', 'lg', 'title', 'display'] as const) {
      expect(fitsLineBox(step)).toBe(true);
    }
  });

  it('has real headroom, not a coincidence at one size', () => {
    // 1.15 (pill) + 0.25 (descent) against 1.6 (line height) leaves 0.2 em of slack, so a
    // small change to the pill height cannot silently cross the line.
    const geometry = badgeGeometry('md');
    expect(scriptureText('md').lineHeight - geometry.height).toBeGreaterThan(
      scriptureSize.md * 0.25,
    );
  });
});

describe('fitsControlHeight', () => {
  it('holds across the reading range — the badge is the smallest control in the app', () => {
    for (const step of ['sm', 'md', 'lg', 'title'] as const) {
      expect(fitsControlHeight(step)).toBe(true);
    }
  });

  it('fails at display size, which is the lockup and never wraps a badge', () => {
    expect(fitsControlHeight('display')).toBe(false);
    expect(badgeGeometry('display').height).toBeGreaterThan(size.control);
  });
});

describe('badgeBaselineOffset', () => {
  it('treats iOS and Android identically — both attach the view bottom to the baseline', () => {
    expect(badgeBaselineOffset('textAttachment', 'ios')).toBe(
      badgeBaselineOffset('textAttachment', 'android'),
    );
  });

  it('pushes the pill DOWN on native and pulls it UP on the web', () => {
    expect(badgeBaselineOffset('textAttachment', 'android')).toBeGreaterThan(0);
    expect(badgeBaselineOffset('textAttachment', 'web')).toBeLessThan(0);
  });

  it('lands the pill bottom in the same place on every platform — the point of the nudge', () => {
    const native = bottomEdgeBelowBaseline('android');
    const web = bottomEdgeBelowBaseline('web');
    expect(web).toBeCloseTo(native, 5);
  });

  it('hangs the pill below the baseline by about a serif descender', () => {
    // A quarter of the scripture size is the descender depth the overhang is matched to.
    expect(bottomEdgeBelowBaseline('android')).toBeGreaterThan(0);
    expect(bottomEdgeBelowBaseline('android')).toBeLessThan(scriptureSize.md * 0.25);
  });

  it('reproduces the browser measurement the ratios were fitted to', () => {
    // Chrome, react-native-web 0.21.2, 20 pt scripture: the label's baseline probed 12.0 px
    // below the top of the label box, putting the pill's bottom edge 8.0 px below it.
    // See docs/architecture/spike-inline-badges.md, "How the numbers were measured".
    expect(bottomEdgeBelowLabelBaseline('md')).toBeCloseTo(8, 1);
  });

  it('uses the label-baseline rule on every platform for a flex child', () => {
    expect(badgeBaselineOffset('flexBaseline', 'android')).toBe(
      badgeBaselineOffset('flexBaseline', 'web'),
    );
    expect(badgeBaselineOffset('flexBaseline', 'ios')).toBe(
      badgeBaselineOffset('textAttachment', 'web'),
    );
  });

  it('scales the nudge with the scripture size', () => {
    expect(badgeBaselineOffset('textAttachment', 'android', 'lg')).toBeGreaterThan(
      badgeBaselineOffset('textAttachment', 'android', 'sm'),
    );
  });
});
