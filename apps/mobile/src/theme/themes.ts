/**
 * The theme registry — every palette the app can render, by name.
 *
 * Purpose
 *   One lookup from a {@link ThemeName} to the `Theme` object. Kept apart from both
 *   palettes so neither has to import the other, and apart from the React context so the
 *   mapping can be exercised without rendering.
 *
 * Dependencies
 *   `./colors`, `./light-colors`, `./theme-contract`.
 */

import { darkTheme } from './colors';
import { lightTheme } from './light-colors';
import type { Theme, ThemeName } from './theme-contract';

/**
 * Both themes, keyed by name.
 *
 * The `Record<ThemeName, Theme>` constraint is what forces a new `ThemeName` to come with
 * a palette: adding one to the contract without adding it here is a type error.
 */
export const themes = {
  dark: darkTheme,
  light: lightTheme,
} as const satisfies Record<ThemeName, Theme>;

/**
 * Look a theme up by name.
 *
 * @param name - Which palette to render.
 * @returns That palette.
 */
export function themeFor(name: ThemeName): Theme {
  return themes[name];
}
