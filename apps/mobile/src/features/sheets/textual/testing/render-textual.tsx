/**
 * Rendering a textual sheet in a component test.
 *
 * Purpose
 *   Every component in this folder derives its colours from the active theme (`D-01`), so
 *   none can be rendered bare. This wraps the shared harness with the provider they need and
 *   pins the palette explicitly, so a test never depends on the machine's colour scheme.
 *
 * The `__DEV__` shim
 *   `./dev-global` must be imported before `@/theme/runtime`, and is. See that file.
 *
 * Dependencies
 *   `@/testing/render` and `@/theme/runtime`. Test-only; never imported by shipped code.
 */

// MUST be first: defines `__DEV__` before `@/theme/runtime` is evaluated. See the file.
import './dev-global';

import { act, type JSX, type ReactNode } from 'react';

import { renderComponent, type RenderResult } from '@/testing/render';
import type { ThemeName } from '@/theme';
import { ThemeProvider } from '@/theme/runtime';

/**
 * Wrap a subtree in the theme provider, pinned to one palette.
 *
 * @param props.theme - Which palette to render under.
 * @param props.children - The subtree.
 * @returns The wrapped tree.
 */
export function SheetTestHost({
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
 * Render a sheet component under a pinned theme.
 *
 * @param element - The component to render.
 * @param theme - Which palette to render under.
 * @returns The harness's query handles. Side effects: appends to `document.body` until
 *   `unmount` is called.
 */
export function renderSheet(element: ReactNode, theme: ThemeName): RenderResult {
  return renderComponent(<SheetTestHost theme={theme}>{element}</SheetTestHost>);
}

/**
 * The CSS declarations that actually apply to one rendered element.
 *
 * Why this is needed
 *   react-native-web does not write inline styles. It compiles each style property into an
 *   atomic CSS class and injects the rules into a `<style>` element, so `element.style` is
 *   empty and jsdom's `getComputedStyle` does not resolve the cascade for most properties.
 *   Asserting that a Hebrew lemma is laid out right to left therefore means reading the
 *   rules the element's classes point at, which is what this does.
 *
 * @param element - The rendered element.
 * @returns Every declared property that reaches it, lowest-specificity first, with the
 *   inline attribute last. Side effects: none.
 */
export function appliedStyle(element: HTMLElement): Readonly<Record<string, string>> {
  const classes = [...element.classList];
  const applied: Record<string, string> = {};

  for (const sheet of [...document.styleSheets]) {
    for (const rule of [...sheet.cssRules]) {
      if (!(rule instanceof CSSStyleRule)) {
        continue;
      }
      if (!classes.some((name) => rule.selectorText.includes(`.${name}`))) {
        continue;
      }
      for (const property of [...rule.style]) {
        applied[property] = rule.style.getPropertyValue(property);
      }
    }
  }

  for (const property of [...element.style]) {
    applied[property] = element.style.getPropertyValue(property);
  }

  return applied;
}

/**
 * Click an element and flush the React work the click caused.
 *
 * `element.click()` on its own leaves React's state update outside `act`, which React warns
 * about and which lets an assertion run against the tree as it was before the press.
 *
 * @param element - The element to press. `null` is accepted so a caller can pass a query
 *   result directly; pressing nothing is a test failure, so it throws.
 * @returns Nothing. Side effects: dispatches a click and flushes React.
 * @throws Error when the element is `null`.
 */
export function press(element: HTMLElement | null): void {
  if (element === null) {
    throw new Error('press() was given no element: the query found nothing to press.');
  }
  act(() => {
    element.click();
  });
}
