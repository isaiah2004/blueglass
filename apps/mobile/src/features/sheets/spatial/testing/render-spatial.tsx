/**
 * Rendering a spatial sheet in a component test.
 *
 * Purpose
 *   Every component in this feature derives its colours from the active theme (`D-01`), so
 *   none of them can be rendered bare. This wraps the shared harness with the provider they
 *   need and pins the theme, so a test never depends on the machine's own colour scheme.
 *
 * Layout in jsdom
 *   jsdom reports every element as 0x0, so `onLayout` never fires with a usable width and
 *   the maps would never measure a viewport. {@link layoutTo} fires the layout event by
 *   hand, which is what lets a component test assert on projected pin positions at a known
 *   width — including the tablet and desktop widths the sheet also has to work at.
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

/** Both palettes, for `describe.each`. `D-01`: every component verified in both. */
export const BOTH_THEMES: readonly ThemeName[] = ['dark', 'light'];

/**
 * The three widths `Q-006` puts in scope, as the sheet actually receives them.
 *
 * Phone is a 390 dp screen less the sheet's `spacing.lg` gutters; tablet and desktop are
 * the context rail's own width, which is where the same content renders at and above
 * 600 dp (`components/split/context-rail-mode.ts`).
 */
export const SHEET_WIDTHS: readonly [name: string, width: number][] = [
  ['phone sheet', 358],
  ['tablet rail', 320],
  ['desktop rail', 420],
];

/**
 * Wrap a subtree in the theme provider, pinned to one palette.
 *
 * @param props.theme - Which palette to render under.
 * @param props.children - The subtree.
 * @returns The wrapped tree.
 */
export function SpatialTestHost({
  theme,
  children,
}: {
  readonly theme: ThemeName;
  readonly children: ReactNode;
}): JSX.Element {
  return <ThemeProvider initialPreference={theme}>{children}</ThemeProvider>;
}

/**
 * Render a spatial component under a pinned theme.
 *
 * @param element - The component to render.
 * @param theme - Which palette to render under.
 * @returns The harness's query handles. Side effects: appends to `document.body` until
 *   `unmount` is called.
 */
export function renderSpatial(element: ReactNode, theme: ThemeName): RenderResult {
  return renderComponent(<SpatialTestHost theme={theme}>{element}</SpatialTestHost>);
}

/** One layout event, in the shape react-native-web hands to `onLayout`. */
interface LayoutEvent {
  readonly nativeEvent: {
    readonly layout: { x: number; y: number; width: number; height: number };
  };
}

/**
 * The property react-native-web parks an `onLayout` handler on.
 *
 * Read out of `node_modules/react-native-web/dist/modules/useElementLayout/index.js`:
 * `useElementLayout` writes the handler to `node.__reactLayoutHandler` and then calls it
 * from a shared `ResizeObserver`. jsdom implements no `ResizeObserver`, so the observer is
 * never created and the handler is never called — but it IS on the node, which is what
 * makes driving layout by hand both possible and faithful.
 */
const DOM_LAYOUT_HANDLER = '__reactLayoutHandler';

/**
 * Fire a layout event on a measured container, because jsdom never will.
 *
 * @param element - The element carrying the `onLayout` prop, found by its `testID`.
 * @param width - The width to report.
 * @param height - The height to report. Defaults to the width, which is enough for any
 *   component here: they derive their own height from an aspect ratio.
 * @throws Error when the element has no layout handler, which means the component under
 *   test stopped measuring itself and the test would otherwise silently assert nothing.
 *
 * Side effects: triggers a React state update and a re-render.
 */
export function layoutTo(element: HTMLElement, width: number, height = width): void {
  const node = element as unknown as Record<string, unknown>;
  const handler = node[DOM_LAYOUT_HANDLER];
  if (typeof handler !== 'function') {
    throw new Error('That element has no onLayout handler; it is not a measured container.');
  }
  const fire = handler as (event: LayoutEvent) => void;
  act(() => {
    fire({ nativeEvent: { layout: { x: 0, y: 0, width, height } } });
  });
}
