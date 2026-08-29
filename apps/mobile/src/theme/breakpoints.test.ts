/**
 * The responsive rules.
 *
 * Every assertion here is a boundary. `Q-006` reinstated three layouts, and the failure
 * mode of a breakpoint is always the same: it is one pixel out, nobody notices on their
 * own screen, and the tablet layout appears on a phone in landscape.
 */

import { describe, expect, it } from 'vitest';

import {
  breakpoint,
  contextRailMinimum,
  formFactorFor,
  layout,
  readingMeasure,
  scriptureStepByFormFactor,
  usesNavigationRail,
  usesSplitPane,
} from './breakpoints';
import { scriptureSize } from './typography';

describe('formFactorFor', () => {
  it('places every width in exactly one bucket', () => {
    expect(formFactorFor(320)).toBe('phone');
    expect(formFactorFor(599)).toBe('phone');
    expect(formFactorFor(600)).toBe('tablet');
    expect(formFactorFor(1099)).toBe('tablet');
    expect(formFactorFor(1100)).toBe('desktop');
    expect(formFactorFor(3840)).toBe('desktop');
  });

  it('is inclusive at both thresholds, matching the prototype', () => {
    expect(formFactorFor(breakpoint.tablet)).toBe('tablet');
    expect(formFactorFor(breakpoint.tablet - 1)).toBe('phone');
    expect(formFactorFor(breakpoint.desktop)).toBe('desktop');
    expect(formFactorFor(breakpoint.desktop - 1)).toBe('tablet');
  });

  it('falls back to the phone layout for a width it cannot trust', () => {
    // `useWindowDimensions` reports 0 for one frame on some Android cold starts, and NaN
    // has been seen on the web when a layout runs before the container is measured.
    expect(formFactorFor(0)).toBe('phone');
    expect(formFactorFor(-1)).toBe('phone');
    expect(formFactorFor(Number.NaN)).toBe('phone');
    expect(formFactorFor(Number.POSITIVE_INFINITY)).toBe('phone');
  });
});

describe('what each layout turns on', () => {
  it('gives the rail and the split pane to tablet and desktop only', () => {
    expect(usesNavigationRail('phone')).toBe(false);
    expect(usesNavigationRail('tablet')).toBe(true);
    expect(usesNavigationRail('desktop')).toBe(true);

    expect(usesSplitPane('phone')).toBe(false);
    expect(usesSplitPane('tablet')).toBe(true);
    expect(usesSplitPane('desktop')).toBe(true);
  });

  it('widens the context rail minimum on desktop', () => {
    expect(contextRailMinimum('tablet')).toBe(layout.contextRail.minTablet);
    expect(contextRailMinimum('desktop')).toBe(layout.contextRail.minDesktop);
    expect(contextRailMinimum('desktop')).toBeGreaterThan(contextRailMinimum('tablet'));
  });

  it('never asks a phone for a rail width of zero', () => {
    expect(contextRailMinimum('phone')).toBeGreaterThan(0);
  });
});

describe('the reading column', () => {
  it('leaves the phone uncapped and caps the two wider layouts', () => {
    expect(readingMeasure.phone).toBe(0);
    expect(readingMeasure.tablet).toBeGreaterThan(0);
    expect(readingMeasure.desktop).toBeGreaterThan(readingMeasure.tablet);
  });

  it('grows the type with the window, one step at a time', () => {
    const steps = [
      scriptureSize[scriptureStepByFormFactor.phone],
      scriptureSize[scriptureStepByFormFactor.tablet],
      scriptureSize[scriptureStepByFormFactor.desktop],
    ];

    expect(steps).toStrictEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps).size).toBe(steps.length);
  });

  it('keeps every capped measure under 90 characters at its own type size', () => {
    // Typographic rule of thumb: a line is comfortable up to ~75 characters and unreadable
    // past ~90. Average glyph advance in a serif runs about 0.5 em, so characters per line
    // is roughly measure / (size * 0.5).
    for (const form of ['tablet', 'desktop'] as const) {
      const size = scriptureSize[scriptureStepByFormFactor[form]];
      expect(readingMeasure[form] / (size * 0.5)).toBeLessThan(90);
    }
  });
});

describe('chrome sizes', () => {
  it('keeps every interactive rail size at or above the 44 dp tap target', () => {
    expect(layout.navRail.itemSize).toBeGreaterThanOrEqual(44);
    expect(layout.navSidebar.itemHeight).toBeGreaterThanOrEqual(44);
    expect(layout.tabBar.height).toBeGreaterThanOrEqual(44);
  });

  it('leaves the reader more room than the rail on the narrowest desktop', () => {
    const narrowestDesktop = breakpoint.desktop;
    const chrome = layout.navSidebar.width + layout.contextRail.minDesktop;

    expect(narrowestDesktop - chrome).toBeGreaterThanOrEqual(layout.contextRail.minReader);
  });

  it('leaves the reader more room than the rail on the narrowest tablet', () => {
    const chrome = layout.navRail.width + layout.contextRail.minTablet;

    expect(breakpoint.tablet - chrome).toBeGreaterThan(0);
  });
});
