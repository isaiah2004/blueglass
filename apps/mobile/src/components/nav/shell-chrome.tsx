/**
 * Where the theme toggle lives, at this width.
 *
 * Purpose
 *   The walkthrough addresses the theme control by a single test id
 *   (`e2e/support/test-ids.ts`, `SHELL_IDS.themeToggle`), so exactly one may be mounted at
 *   a time — two is an ambiguous match, not a nicer layout. But the control has to be
 *   reachable from every surface a reader can be standing on, and those surfaces do not all
 *   have the same chrome: the tab shell grows a nav rail at 600 dp, while a route outside
 *   the tab group (Settings, the reader) never has one at any width.
 *
 * The rule, in one place
 *   Whoever draws chrome that already carries the toggle announces it here;
 *   `ScreenScaffold` draws its own only when nobody above it has. A screen that reads a
 *   context is a screen that cannot get this wrong by being rendered somewhere new.
 *
 * Dependencies
 *   React only.
 */

import { createContext, useContext, type JSX, type ReactNode } from 'react';

/** Set by chrome that already renders a theme toggle. */
const ShellChromeContext = createContext(false);

/** Inputs to {@link ShellChromeProvider}. */
export interface ShellChromeProviderProps {
  /** True when the chrome around these children already carries a theme toggle. */
  readonly hasThemeToggle: boolean;
  readonly children: ReactNode;
}

/**
 * Declare that the surrounding chrome carries the theme toggle.
 *
 * @param props - See {@link ShellChromeProviderProps}.
 * @returns The children, under the declaration.
 */
export function ShellChromeProvider({
  hasThemeToggle,
  children,
}: ShellChromeProviderProps): JSX.Element {
  return (
    <ShellChromeContext.Provider value={hasThemeToggle}>{children}</ShellChromeContext.Provider>
  );
}

/**
 * Does the chrome above this screen already carry a theme toggle?
 *
 * @returns True when it does, so the screen must not draw a second one. Defaults to false,
 *   which is the safe answer: a route rendered outside any shell draws its own.
 */
export function useChromeHasThemeToggle(): boolean {
  return useContext(ShellChromeContext);
}
