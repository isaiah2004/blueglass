/**
 * The five primary destinations.
 *
 * Three chrome surfaces read this table. The assertions here are the ones that would
 * otherwise only be caught by looking at all three on all three form factors: order,
 * uniqueness, glyph coverage, and — the one that matters most — the colour language.
 */

import { describe, expect, it } from 'vitest';

import { navDestinationFor, navDestinations } from './nav-destinations';
import { iconNames } from './nav-icons';

describe('the table', () => {
  it('holds the five tabs the design language names, in order', () => {
    expect(navDestinations.map((destination) => destination.label)).toStrictEqual([
      'Home',
      'Bible',
      'Discover',
      'Studio',
      'Journal',
    ]);
  });

  it('names a distinct route and a distinct glyph for each', () => {
    const routes = navDestinations.map((destination) => destination.routeName);
    const icons = navDestinations.map((destination) => destination.icon);

    expect(new Set(routes).size).toBe(navDestinations.length);
    expect(new Set(icons).size).toBe(navDestinations.length);
  });

  it('draws Home from the index route, as Expo Router requires', () => {
    expect(navDestinations[0].routeName).toBe('index');
  });

  it('uses only glyphs that exist', () => {
    for (const destination of navDestinations) {
      expect(iconNames).toContain(destination.icon);
    }
  });
});

describe('the colour language', () => {
  it('paints the reader’s own surfaces gold and the system’s cyan', () => {
    // `design-language.md` §8.2: gold means "you", cyan means "the system". Never mixed.
    const accentByLabel = Object.fromEntries(
      navDestinations.map((destination) => [destination.label, destination.accent]),
    );

    expect(accentByLabel).toStrictEqual({
      Home: 'gold',
      Bible: 'gold',
      Journal: 'gold',
      Discover: 'cyan',
      Studio: 'cyan',
    });
  });

  it('uses both accents, so the rail teaches the distinction rather than hiding it', () => {
    expect(new Set(navDestinations.map((d) => d.accent))).toStrictEqual(new Set(['gold', 'cyan']));
  });
});

describe('the harness contract', () => {
  it('carries the test ids `e2e/support/test-ids.ts` addresses each tab by', () => {
    expect(navDestinations.map((destination) => destination.testID)).toStrictEqual([
      'tab-home',
      'tab-bible',
      'tab-discover',
      'tab-studio',
      'tab-journal',
    ]);
  });
});

describe('accessibility', () => {
  it('gives every destination a spoken label that says more than the visible one', () => {
    for (const destination of navDestinations) {
      expect(destination.accessibilityLabel.startsWith(destination.label)).toBe(true);
      expect(destination.accessibilityLabel.length).toBeGreaterThan(destination.label.length);
    }
  });
});

describe('navDestinationFor', () => {
  it('finds every route in the table', () => {
    for (const destination of navDestinations) {
      expect(navDestinationFor(destination.routeName)).toBe(destination);
    }
  });

  it('returns undefined for a route the table does not describe', () => {
    // A screen added to `app/(tabs)` without a row here. The bars render a neutral
    // fallback rather than crashing the whole shell over one unlabelled tab.
    expect(navDestinationFor('settings')).toBeUndefined();
    expect(navDestinationFor('')).toBeUndefined();
  });
});
