/**
 * Theme probes — what colour the reader is actually looking at.
 *
 * Purpose
 *   `D-01` makes light mode a real deliverable, not a possibility the tokens leave open.
 *   The only machine-checkable form of "the theme changed" is that the painted surface
 *   changed, so this module answers one question precisely: what colour is behind this
 *   element, once transparency has been resolved?
 *
 * Why "effective" rather than "computed"
 *   React Native Web paints the canvas on a container, not on `body`, and every view inside
 *   it is transparent by default. `getComputedStyle(el).backgroundColor` on a verse row
 *   therefore reports `rgba(0, 0, 0, 0)` on a perfectly correct screen. Walking up to the
 *   first ancestor that actually paints is what makes the answer meaningful.
 *
 * Dependencies
 *   `@playwright/test` for the `Page` type.
 */

import type { Locator, Page } from '@playwright/test';

/**
 * The colour an element's own text is painted in.
 *
 * Only meaningful on an element that *is* a text node. A verse row is a `Pressable` view
 * that sets no colour, and asking it reports the inherited `rgb(0, 0, 0)` on a perfectly
 * legible screen — use {@link textColorInside} for a container.
 *
 * @param locator The element to inspect. Must resolve to exactly one node.
 * @returns The computed `color` as a CSS colour string.
 */
export async function computedTextColor(locator: Locator): Promise<string> {
  return locator.evaluate((element: Element) => window.getComputedStyle(element).color);
}

/**
 * The colour the text *inside* a container is painted in.
 *
 * The mirror of `probes-text.ts`'s `textFontFamily`, and for the same reason: a verse row
 * is a pressable `View` and the scripture is a `Text` inside it. Reading the container's
 * computed colour reported `rgb(0, 0, 0)` — the browser's inherited default, which a view
 * that paints no text of its own always reports — and chapter 7 accused a correct dark
 * theme of painting black scripture on a black canvas. The longest run of text inside is
 * the scripture, so that is what gets measured.
 *
 * @param page The page to inspect.
 * @param testId The container's test id.
 * @returns The computed `color` of the longest text node inside it, or `''` when the
 *   container is not on the page.
 */
export async function textColorInside(page: Page, testId: string): Promise<string> {
  return page.evaluate((id: string) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    if (root === null) return '';
    let best: Element = root;
    let longest = -1;
    for (const element of Array.from(root.querySelectorAll('*'))) {
      if (element.children.length > 0) continue;
      const length = (element.textContent ?? '').trim().length;
      if (length > longest) {
        longest = length;
        best = element;
      }
    }
    return window.getComputedStyle(best).color;
  }, testId);
}

/**
 * The colour actually painted behind an element.
 *
 * @param page The page to inspect.
 * @param testId The `data-testid` of the element to start from.
 * @returns The first opaque background colour found walking up to `<html>`, as a CSS
 *   colour string, or `transparent` when nothing in the chain paints anything.
 */
export async function effectiveBackgroundColor(page: Page, testId: string): Promise<string> {
  return page.evaluate((id: string) => {
    const start = document.querySelector(`[data-testid="${id}"]`);
    for (let node: Element | null = start; node !== null; node = node.parentElement) {
      const colour = window.getComputedStyle(node).backgroundColor;
      if (colour !== '' && !/,\s*0\)$/.test(colour) && colour !== 'transparent') return colour;
    }
    return 'transparent';
  }, testId);
}

/**
 * The colour painted behind the whole document.
 *
 * @param page The page to inspect.
 * @returns The document's painted background as a CSS colour string.
 */
export async function documentBackgroundColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    for (const node of [document.getElementById('root'), document.body, document.documentElement]) {
      if (node === null) continue;
      const colour = window.getComputedStyle(node).backgroundColor;
      if (colour !== '' && !/,\s*0\)$/.test(colour) && colour !== 'transparent') return colour;
    }
    return 'transparent';
  });
}

/**
 * Perceived lightness of a CSS `rgb()` / `rgba()` colour, 0 (black) to 1 (white).
 *
 * Used to tell the two themes apart by more than inequality: a light theme whose canvas is
 * darker than the dark theme's is a bug that "the colours differ" would happily pass.
 *
 * @param colour A CSS colour string in `rgb()` or `rgba()` form.
 * @returns Relative luminance approximation in the range 0 to 1, or `NaN` if unparseable.
 */
export function lightnessOf(colour: string): number {
  const parts = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(colour);
  if (parts === null) return Number.NaN;
  const [red, green, blue] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
}
