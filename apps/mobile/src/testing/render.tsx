/**
 * The component-test harness.
 *
 * Purpose
 *   Renders a React Native component into jsdom and hands back the DOM it produced, so a
 *   component can be asserted on without a device and without a browser.
 *
 * Why it is hand-written rather than `@testing-library/react-native`
 *   That library matches host components by React Native's own names — `Text`, `View`. Under
 *   the `react-native` -> `react-native-web` alias that `vitest.config.ts` applies, the tree
 *   renders `span` and `div`, so every query would miss even though the render succeeded.
 *   The DOM is the right thing to query here, because the DOM is what the first-class web
 *   target (`T-01`) actually ships.
 *
 * What a query looks like
 *   react-native-web maps `testID` to `data-testid` and the accessibility props to ARIA, so
 *   the same ids and roles the Playwright walkthrough uses work here too. One vocabulary,
 *   two harnesses.
 *
 * Dependencies
 *   `react-dom/client` and React's `act`. No test-library packages.
 */

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

/** What {@link renderComponent} hands back. */
export interface RenderResult {
  /** The container the tree was rendered into. */
  readonly container: HTMLElement;
  /** Re-render the same root with a new element. */
  rerender: (element: ReactElement) => void;
  /** Unmount and remove the container. Always call it, or jsdom accumulates trees. */
  unmount: () => void;
  /** Find one element by its `testID`. */
  byTestId: (testId: string) => HTMLElement | null;
  /** Find every element with a given ARIA role. */
  byRole: (role: string) => readonly HTMLElement[];
  /** The rendered text content, whitespace-collapsed. */
  text: () => string;
}

/**
 * Render a component into a fresh jsdom container.
 *
 * @param element - The element to render.
 * @returns Handles for querying, re-rendering, and unmounting. See {@link RenderResult}.
 *
 * Side effects: appends a container to `document.body` until `unmount` is called.
 */
export function renderComponent(element: ReactElement): RenderResult {
  const container = document.createElement('div');
  document.body.appendChild(container);

  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
    root.render(element);
  });

  return {
    container,
    rerender(next: ReactElement): void {
      act(() => {
        root?.render(next);
      });
    },
    unmount(): void {
      act(() => {
        root?.unmount();
      });
      container.remove();
    },
    byTestId(testId: string): HTMLElement | null {
      return container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    },
    byRole(role: string): readonly HTMLElement[] {
      return [...container.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
    },
    text(): string {
      return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
    },
  };
}

/**
 * Run a callback inside React's `act`, so state updates are flushed before assertions.
 *
 * @param work - What to do.
 */
export function actSync(work: () => void): void {
  act(work);
}

/**
 * Flush pending promises and the renders they cause.
 *
 * Needed by anything that reads from the key/value store, which is a promise on every
 * platform.
 */
export async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}
