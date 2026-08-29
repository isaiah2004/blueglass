/**
 * The theme registry.
 *
 * `D-01` is a promise that every token exists in both palettes. The compiler enforces the
 * shape; this file enforces the part the compiler cannot see — that the two are actually
 * *different*, and that neither has quietly been aliased to the other.
 */

import { describe, expect, it } from 'vitest';

import { darkTheme } from './colors';
import { lightTheme } from './light-colors';
import { badgeKinds, type Theme } from './theme-contract';
import { themeFor, themes } from './themes';

/** Walks a theme and yields every colour string it contains, with its path. */
function* colorEntries(node: unknown, path = ''): Generator<readonly [string, string]> {
  if (typeof node === 'string') {
    yield [path, node];
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node)) {
    yield* colorEntries(value, path === '' ? key : `${path}.${key}`);
  }
}

describe('the registry', () => {
  it('resolves both names', () => {
    expect(themeFor('dark')).toBe(darkTheme);
    expect(themeFor('light')).toBe(lightTheme);
  });

  it('holds exactly the two themes', () => {
    expect(Object.keys(themes).sort()).toStrictEqual(['dark', 'light']);
  });

  it('names itself correctly', () => {
    expect(darkTheme.name).toBe('dark');
    expect(lightTheme.name).toBe('light');
  });
});

describe('the two palettes agree on shape and disagree on value', () => {
  it('defines the same set of tokens', () => {
    const paths = (theme: Theme): string[] => [...colorEntries(theme)].map(([path]) => path).sort();

    expect(paths(lightTheme)).toStrictEqual(paths(darkTheme));
  });

  it('gives every badge kind a hue in both themes', () => {
    for (const kind of badgeKinds) {
      expect(darkTheme.badge[kind].tint).toMatch(/^#/);
      expect(lightTheme.badge[kind].tint).toMatch(/^#/);
    }
  });

  it('shares no surface, ink or accent value between the two', () => {
    // A token that survived unchanged from dark to light is almost always one that was
    // forgotten, not one that was chosen: near-black canvases and paper have nothing in
    // common. `name` is the single legitimate exception and is not a colour.
    const dark = new Map(colorEntries(darkTheme));
    const light = new Map(colorEntries(lightTheme));

    const shared = [...dark].filter(
      ([path, value]) => path !== 'name' && light.get(path) === value,
    );

    expect(shared).toStrictEqual([]);
  });

  it('inverts the surface ramp — dark climbs to lighter, light climbs to brighter', () => {
    // Dark: canvas is the darkest surface and cardHover the lightest.
    expect(darkTheme.background.canvas < darkTheme.background.cardHover).toBe(true);
    // Light: the canvas is the *warmest* and card the brightest, so a card lifts off paper.
    expect(lightTheme.background.card).toBe('#FFFFFF');
    expect(lightTheme.background.canvas).not.toBe('#FFFFFF');
  });
});
