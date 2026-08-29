/**
 * Rendering a reader component in a component test.
 *
 * Purpose
 *   Every component under `features/reader/` derives its colours from the active theme
 *   (`D-01`), so none of them can be rendered bare. This wraps the shared harness with the
 *   provider they need, and pins the theme explicitly so a test never depends on the
 *   machine's own colour scheme.
 *
 * The `__DEV__` shim
 *   `./dev-global` must be imported before `@/theme/runtime`, and is. See that file for
 *   why, and why it has no imports of its own.
 *
 * Dependencies
 *   `@/testing/render` and `@/theme/runtime`. Test-only; never imported by shipped code.
 */

// MUST be first: defines `__DEV__` before `@/theme/runtime` is evaluated. See the file.
import './dev-global';

import type { JSX, ReactNode } from 'react';

import { renderComponent, type RenderResult } from '@/testing/render';
import { ThemeProvider } from '@/theme/runtime';
import type { ThemeName } from '@/theme';

/**
 * Wraps a subtree in the theme provider, pinned to one palette.
 *
 * @param props.theme - Which palette to render under.
 * @param props.children - The subtree.
 * @returns The wrapped tree.
 */
export function ReaderTestHost({
  theme,
  children,
}: {
  readonly theme: ThemeName;
  readonly children: ReactNode;
}): JSX.Element {
  return <ThemeProvider initialPreference={theme}>{children}</ThemeProvider>;
}

/** Both palettes, for `describe.each`. `D-01`: every component verified in both. */
export const BOTH_THEMES: readonly ThemeName[] = ['dark', 'light'];

/**
 * Render a reader component under a pinned theme.
 *
 * @param element - The component to render.
 * @param theme - Which palette to render under.
 * @returns The harness's query handles. Side effects: appends to `document.body` until
 *   `unmount` is called.
 */
export function renderReader(element: ReactNode, theme: ThemeName): RenderResult {
  return renderComponent(<ReaderTestHost theme={theme}>{element}</ReaderTestHost>);
}

/**
 * Query the whole document, not just the render container.
 *
 * `Modal` on react-native-web renders through a portal appended to `document.body`, so a
 * sheet's contents are never inside the harness's container. Anything that asserts on a
 * `ReaderSheet` has to look here instead.
 */
export const inDocument = {
  /**
   * @param testId - The `testID` to find.
   * @returns The element, or `null`. Side effects: none.
   */
  byTestId(testId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  },
  /**
   * @param selector - Any CSS selector.
   * @returns Every match. Side effects: none.
   */
  all(selector: string): readonly HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(selector)];
  },
  /**
   * @returns The document's visible text, whitespace-collapsed. Side effects: none.
   */
  text(): string {
    return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  },
};

/**
 * Clear every portal react-native-web left behind.
 *
 * `Modal` mounts into a root appended to `document.body`, and unmounting the React tree
 * does not always take that root with it. Without this, a second test in the same file
 * queries the first test's sheet as well as its own — which shows up as a count that keeps
 * growing rather than as an obvious failure. Call it from `afterEach`.
 *
 * Side effects: empties `document.body`.
 */
export function resetDocument(): void {
  document.body.innerHTML = '';
}
