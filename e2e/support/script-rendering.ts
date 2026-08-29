/**
 * Is a word in another script actually being drawn, or is it a row of boxes?
 *
 * Purpose
 *   `features/sheets/textual/root/original-language.ts` states the failure mode plainly:
 *   the `[Root]` sheet exists to show one word in its own script, set large, and "a lemma
 *   rendered as tofu boxes or laid out left-to-right is worse than not showing it". Both of
 *   those failures pass every assertion a normal test makes. `toContainText('שָׁלוֹם')`
 *   passes when the DOM holds the right code points and the font draws none of them —
 *   `textContent` is what was written, not what was painted.
 *
 *   This module answers the painted question instead, for direction and for coverage.
 *
 * How coverage is measured
 *   The element's own resolved font is handed to a canvas, and the word's advance width is
 *   compared against the advance of the same number of code points from a Private Use Area
 *   block that no font in the world has a glyph for. A font with no Hebrew falls back to
 *   `.notdef` for every character, so the two measure the same; a font that draws Hebrew
 *   cannot, because Hebrew combining marks have zero advance and its letters do not all
 *   have the box's width. Equality is therefore the signal, and it is a measurement rather
 *   than a screenshot.
 *
 * This check is about the machine as much as the code
 *   A failure means *this browser, with these fonts, draws nothing for these code points*.
 *   That is the finding, not a false alarm: the module under test deliberately names no
 *   font family for Hebrew and Aramaic so the platform picks one, and a platform that has
 *   none is the case the decision was taken to expose rather than to hide.
 *
 * Dependencies
 *   `@playwright/test` for `Page`. Everything else runs in the browser.
 */

import type { Page } from '@playwright/test';

/**
 * A Private Use Area code point: assigned to nobody, so no font ships a glyph for it.
 *
 * Written as an escape rather than as the character itself, which is invisible in every
 * editor and would read as an empty string to the next person here.
 */
const NO_GLYPH_CODE_POINT = '\uE000';

/** How a piece of text is laid out, once the browser has resolved its styles. */
export interface ScriptLayout {
  /** The CSS `direction` in force — what `writingDirection: 'rtl'` compiles to on web. */
  readonly direction: string;
  /** The resolved `text-align`. */
  readonly textAlign: string;
  /** The text the element holds. */
  readonly text: string;
  /** The advance width of that text in the element's own font, in CSS pixels. */
  readonly advancePx: number;
  /** The advance width of the same number of glyphless code points, in the same font. */
  readonly notdefAdvancePx: number;
}

/**
 * A selector for one test id nested inside another.
 *
 * The gallery renders five sheets on one page and every `[Root]` sheet carries the same
 * `root-lemma` id, so an unscoped lookup silently measures the first card — the Greek one —
 * while the failure message names Hebrew. Scoping is not a nicety here: it is the
 * difference between measuring the thing under test and measuring its control.
 *
 * @param outerTestId The container's test id.
 * @param innerTestId The test id inside it.
 * @returns A CSS selector for {@link measureScript}.
 */
export function within(outerTestId: string, innerTestId: string): string {
  return `[data-testid="${outerTestId}"] [data-testid="${innerTestId}"]`;
}

/**
 * Measure how one element's text is laid out and whether its glyphs exist.
 *
 * @param page The page to query.
 * @param selector A CSS selector for the element. Use {@link within} to scope by test id.
 * @returns The measurement, or `undefined` when the selector matches nothing.
 */
export async function measureScript(
  page: Page,
  selector: string,
): Promise<ScriptLayout | undefined> {
  return page.evaluate(
    ([target, filler]: [string, string]): ScriptLayout | undefined => {
      const element = document.querySelector(target);
      if (element === null) return undefined;
      const style = window.getComputedStyle(element);
      const text = (element.textContent ?? '').trim();
      const context = document.createElement('canvas').getContext('2d');
      if (context === null) {
        return {
          direction: style.direction,
          textAlign: style.textAlign,
          text,
          advancePx: 0,
          notdefAdvancePx: 0,
        };
      }
      // `font` is the shorthand the canvas understands, and the element's own resolved
      // value is what the browser is really painting with — including whichever fallback
      // face it chose when the style named no family at all.
      context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      return {
        direction: style.direction,
        textAlign: style.textAlign,
        text,
        advancePx: context.measureText(text).width,
        notdefAdvancePx: context.measureText(filler.repeat([...text].length)).width,
      };
    },
    [selector, NO_GLYPH_CODE_POINT] as [string, string],
  );
}

/**
 * Whether the browser drew real glyphs for this text rather than substitution boxes.
 *
 * @param layout A measurement from {@link measureScript}.
 * @returns True when the text advances differently from the same run of glyphless points.
 */
export function hasGlyphCoverage(layout: ScriptLayout): boolean {
  if (layout.text === '' || layout.advancePx === 0) return false;
  return Math.abs(layout.advancePx - layout.notdefAdvancePx) > 0.5;
}
