/**
 * Tests for the colour token tree.
 *
 * Two jobs. First, prove the dark theme fills the `Theme` contract exhaustively — every
 * role present, every badge type given a hue, every leaf a readable colour. Second, pin the
 * palette to `docs/product/design-language.md` §2, so a value cannot drift from the design
 * language without a test saying so.
 */

import { describe, expect, it } from 'vitest';

import { toRgbaChannels, type Color } from './color-math';
import { colors, darkTheme } from './colors';
import { badgeKinds, type BadgeKind, type Theme } from './theme-contract';

/** The roles `Theme` declares. Restated here so an added role fails until it is reviewed. */
const THEME_ROLES = [
  'name',
  'background',
  'line',
  'ink',
  'accent',
  'state',
  'badge',
  'overlay',
  'ambient',
  'cardGradient',
] as const;

/** The keys each colour group must carry. */
const GROUP_KEYS = {
  background: ['canvas', 'elevated', 'card', 'cardHover'],
  line: ['hairline', 'strong'],
  ink: ['primary', 'secondary', 'tertiary'],
  accent: ['gold', 'goldDim', 'cyan', 'cyanDim'],
  state: ['success', 'danger'],
  overlay: ['scrim', 'glass'],
  ambient: ['gold', 'cyan'],
} as const;

/**
 * Flattens every colour a theme holds into `path -> value` pairs.
 *
 * @param theme - The theme to walk.
 * @returns One entry per colour leaf, path-labelled so a failure names the token.
 */
function colorLeaves(theme: Theme): [string, Color][] {
  const groups: [string, Readonly<Record<string, Color>>][] = [
    ['background', theme.background],
    ['line', theme.line],
    ['ink', theme.ink],
    ['accent', theme.accent],
    ['state', theme.state],
    ['overlay', theme.overlay],
    ['ambient', theme.ambient],
  ];

  const flat = groups.flatMap(([group, values]) =>
    Object.entries(values).map(([key, value]): [string, Color] => [`${group}.${key}`, value]),
  );
  const badges = Object.entries(theme.badge).flatMap(([kind, set]) =>
    Object.entries(set).map(([key, value]): [string, Color] => [`badge.${kind}.${key}`, value]),
  );
  const gradient = theme.cardGradient.map((value, index): [string, Color] => [
    `cardGradient[${String(index)}]`,
    value,
  ]);

  return [...flat, ...badges, ...gradient];
}

describe('darkTheme structure', () => {
  it('satisfies the Theme contract', () => {
    const asContract: Theme = darkTheme;

    expect(asContract).toBe(darkTheme);
  });

  it('fills every role the contract declares, and no extras', () => {
    expect(Object.keys(darkTheme).sort()).toEqual([...THEME_ROLES].sort());
  });

  it.each(Object.entries(GROUP_KEYS))('fills every key of the %s group', (group, keys) => {
    const groupValues = darkTheme[group as keyof typeof GROUP_KEYS];

    expect(Object.keys(groupValues).sort()).toEqual([...keys].sort());
  });

  it('names itself dark, so a future light theme is distinguishable at runtime', () => {
    expect(darkTheme.name).toBe('dark');
  });

  it('exposes the dark theme as the theme in force', () => {
    expect(colors).toBe(darkTheme);
  });
});

describe('darkTheme values', () => {
  it.each(colorLeaves(darkTheme))('%s is a readable colour', (_path, value) => {
    expect(() => toRgbaChannels(value)).not.toThrow();
  });

  it('matches design-language.md section 2 for the opaque palette', () => {
    expect(darkTheme.background).toEqual({
      canvas: '#05070C',
      elevated: '#0B1018',
      card: '#0E141E',
      cardHover: '#131B27',
    });
    expect(darkTheme.ink).toEqual({
      primary: '#E8EDF5',
      secondary: '#93A0B4',
      tertiary: '#5D6A7D',
    });
    expect(darkTheme.accent).toEqual({
      gold: '#F0B429',
      goldDim: '#8A6414',
      cyan: '#35D2E8',
      cyanDim: '#14606C',
    });
    expect(darkTheme.state).toEqual({ success: '#34D399', danger: '#F87171' });
  });

  it('builds the two border tokens from translucent white, never a solid tone', () => {
    expect(darkTheme.line.hairline).toBe('rgba(255,255,255,0.08)');
    expect(darkTheme.line.strong).toBe('rgba(255,255,255,0.16)');
  });

  it('runs a card gradient from cardHover down to card', () => {
    expect(darkTheme.cardGradient).toEqual([
      darkTheme.background.cardHover,
      darkTheme.background.card,
    ]);
  });

  it('keeps the glass sheet inside the 86 to 92 percent opacity band', () => {
    const { alpha } = toRgbaChannels(darkTheme.overlay.glass);

    expect(alpha).toBeGreaterThanOrEqual(0.86);
    expect(alpha).toBeLessThanOrEqual(0.92);
  });

  it('keeps both ambient glows at a very low opacity', () => {
    expect(toRgbaChannels(darkTheme.ambient.gold).alpha).toBeLessThanOrEqual(0.1);
    expect(toRgbaChannels(darkTheme.ambient.cyan).alpha).toBeLessThanOrEqual(0.1);
  });
});

describe('badge colours', () => {
  it('covers all ten badge types', () => {
    expect(Object.keys(darkTheme.badge).sort()).toEqual([...badgeKinds].sort());
  });

  it.each(badgeKinds)(
    'gives %s a fill at 10 percent and a border at 35 percent of its tint',
    (kind) => {
      const set = darkTheme.badge[kind];
      const tint = toRgbaChannels(set.tint);

      expect(toRgbaChannels(set.surface)).toEqual({ ...tint, alpha: 0.1 });
      expect(toRgbaChannels(set.border)).toEqual({ ...tint, alpha: 0.35 });
    },
  );

  it('assigns the hues design-language.md section 2 lists per badge type', () => {
    const tints: Record<BadgeKind, Color> = {
      route: darkTheme.accent.cyan,
      city3d: darkTheme.accent.gold,
      history: '#5B8DEF',
      manuscript: darkTheme.accent.cyan,
      crossRef: darkTheme.accent.gold,
      root: darkTheme.accent.cyan,
      structure: '#5B8DEF',
      cultural: darkTheme.accent.gold,
      context: darkTheme.accent.cyan,
      meditate: '#A78BFA',
    };

    for (const kind of badgeKinds) {
      expect(darkTheme.badge[kind].tint).toBe(tints[kind]);
    }
  });
});
