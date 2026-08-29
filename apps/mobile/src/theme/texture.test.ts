/**
 * Surface texture tokens.
 *
 * `D-05` asked for texture and, in the same breath, for less glass. The failure mode of a
 * texture system is always the same one: it creeps louder, one surface at a time, until
 * the page is a pattern. These assertions are the ceiling.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_TEXTURE_OPACITY,
  textureFor,
  textureNames,
  textureRoles,
  type TextureRole,
} from './texture';
import type { ThemeName } from './theme-contract';

/** Every (role, theme) pair the app can ask for. */
const EVERY_PAIR: readonly (readonly [TextureRole, ThemeName])[] = textureRoles.flatMap((role) =>
  (['dark', 'light'] as const).map((themeName) => [role, themeName] as const),
);

describe('textureFor', () => {
  it('answers for every surface class in both themes', () => {
    for (const [role, themeName] of EVERY_PAIR) {
      const token = textureFor(role, themeName);

      expect(textureNames).toContain(token.name);
      expect(token.tint).toMatch(/^#[0-9A-F]{6}$/i);
      expect(token.opacity).toBeGreaterThan(0);
    }
  });

  it('never paints a texture loudly enough to compete with scripture', () => {
    for (const [role, themeName] of EVERY_PAIR) {
      expect(textureFor(role, themeName).opacity).toBeLessThanOrEqual(MAX_TEXTURE_OPACITY);
    }
  });

  it('keeps light mode quieter than dark, role for role', () => {
    // Dark ink on paper reads heavier than white ink on near-black at the same alpha, so
    // matching the numbers across themes would make light mode the noisier of the two.
    for (const role of textureRoles) {
      expect(textureFor(role, 'light').opacity).toBeLessThan(textureFor(role, 'dark').opacity);
    }
  });

  it('inks the tile to the theme, not to a fixed colour', () => {
    for (const role of textureRoles) {
      expect(textureFor(role, 'dark').tint).not.toBe(textureFor(role, 'light').tint);
    }
  });

  it('gives each surface class its own motif, so two adjacent surfaces never moiré', () => {
    const motifs = textureRoles.map((role) => textureFor(role, 'dark').name);

    expect(new Set(motifs).size).toBe(motifs.length);
  });

  it('picks the same motif in both themes — only the ink and the strength change', () => {
    for (const role of textureRoles) {
      expect(textureFor(role, 'light').name).toBe(textureFor(role, 'dark').name);
    }
  });
});
