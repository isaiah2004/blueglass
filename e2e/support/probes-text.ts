/**
 * Typography and touch probes — the parts of "does it look right" a machine can measure.
 *
 * Purpose
 *   Three checks that a screenshot alone will not give you, because a human flipping
 *   through screenshots will not notice a 40 px tab target, will read 10 px metadata
 *   without registering that it is too small, and cannot tell Source Serif 4 from the
 *   system fallback at a glance.
 *
 * Why the serif probe exists at all
 *   `D-03` picked Source Serif 4 for scripture and `typography.ts` names it in a token, but
 *   naming a family in a stylesheet does nothing if `expo-font` never registered the face —
 *   the browser silently substitutes and the page still looks plausible. Reading the
 *   *resolved* `font-family` off a real verse is the only check that can tell the
 *   difference.
 *
 * Dependencies
 *   `@playwright/test` for the `Locator` and `Page` types, and the shared `Finding` shape.
 */

import type { Locator, Page } from '@playwright/test';

import type { Finding } from './findings';

/** How many findings of one kind are worth reporting before the point is made. */
const MAX_FINDINGS_PER_PROBE = 10;

/**
 * The CSS selector for everything a reader can press.
 *
 * React Native Web renders `Pressable` as a plain element with `tabindex`, and only sets a
 * `role` when the component passes `accessibilityRole`. Matching on both means a control
 * is measured whether or not its author remembered the role.
 */
const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  '[role="button"]',
  '[role="tab"]',
  '[role="link"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="menuitem"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * The one control that is deliberately smaller than the minimum, and why.
 *
 * `design-language.md` §5 fixes the inline badge at 22-24 pt and requires that it "must not
 * disturb the scripture's line rhythm". A 44 px pill inside a 32 px line cannot satisfy both;
 * the design chose the line. Three things make that safe rather than sloppy, and all three
 * have to stay true for this exemption to be honest:
 *
 *   1. The pill carries a `hitSlop` sized to bring its *touch* area to 44 dp, so a thumb
 *      meets the minimum even though the painted pill does not (`InlineBadge.tsx`).
 *   2. Every badge in the chapter is repeated in the chapter-end summary list, whose rows are
 *      a full `size.tapTarget` tall. That is WCAG 2.5.8's "Equivalent" exception, and it is
 *      the reason that list exists (`design-language.md` §5, `image9.png`).
 *   3. The pill is 67-96 px WIDE. It is small on one axis, not small.
 *
 * Nothing else in the app may join this list without the same three answers.
 */
const TAP_TARGET_EXEMPT_SELECTOR = '[data-testid^="inline-badge-"]';

/**
 * Which pressable controls are smaller than the minimum tap target?
 *
 * Catches: a tab bar whose buttons are 32 px tall, an icon-only close control with no
 * padding, a translation pill that is comfortable with a mouse and unhittable with a thumb.
 * Only the innermost control of a nest is measured, so a large wrapper cannot excuse a
 * small child and a small child cannot condemn its large wrapper.
 *
 * @param page The page to measure.
 * @param minimumPx The minimum edge length in CSS pixels.
 * @returns Up to ten undersized controls, excluding {@link TAP_TARGET_EXEMPT_SELECTOR}.
 */
export async function probeSmallTapTargets(page: Page, minimumPx: number): Promise<Finding[]> {
  return page.evaluate(
    ([selector, exemptSelector, minimum, limit]: [string, string, number, number]): Finding[] => {
      const all = Array.from(document.querySelectorAll(selector));
      const innermost = all.filter(
        (element) => !all.some((other) => other !== element && element.contains(other)),
      );
      const findings: Finding[] = [];
      for (const element of innermost) {
        if (element.matches(exemptSelector)) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        if (window.getComputedStyle(element).pointerEvents === 'none') continue;
        if (rect.width + 0.5 >= minimum && rect.height + 0.5 >= minimum) continue;
        const testId = element.getAttribute('data-testid') ?? '(no test id)';
        const text = (element.textContent ?? '').trim().slice(0, 32);
        findings.push({
          kind: 'tap-target-too-small',
          label: element.tagName.toLowerCase() + ' ' + testId + ' ' + text,
          detail:
            'measures ' +
            String(Math.round(rect.width)) +
            'x' +
            String(Math.round(rect.height)) +
            'px, below the ' +
            String(minimum) +
            'px minimum',
        });
        if (findings.length >= limit) break;
      }
      return findings;
    },
    [INTERACTIVE_SELECTOR, TAP_TARGET_EXEMPT_SELECTOR, minimumPx, MAX_FINDINGS_PER_PROBE] as [
      string,
      string,
      number,
      number,
    ],
  );
}

/**
 * Which visible text is too small or invisible to read?
 *
 * Catches: metadata rendered below the design system's smallest step, and text painted at
 * zero alpha — the failure mode where a screenshot looks fine because the text is simply
 * not there, and `toBeVisible()` still passes because the element occupies space.
 *
 * @param page The page to measure.
 * @param minimumFontPx The smallest legible font size in CSS pixels.
 * @returns Up to ten illegible text elements.
 */
export async function probeIllegibleText(page: Page, minimumFontPx: number): Promise<Finding[]> {
  return page.evaluate(
    ([minimum, limit]: [number, number]): Finding[] => {
      const findings: Finding[] = [];
      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        if (element.children.length > 0) continue;
        const text = (element.textContent ?? '').trim();
        if (text === '') continue;
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) continue;
        const style = window.getComputedStyle(element);
        const size = Number.parseFloat(style.fontSize);
        const transparent = /rgba\([^)]*,\s*0\)/.test(style.color) || style.opacity === '0';
        if (size >= minimum && !transparent) continue;
        findings.push({
          kind: transparent ? 'invisible-text' : 'text-too-small',
          label: JSON.stringify(text.slice(0, 48)),
          detail:
            'font-size ' + style.fontSize + ', color ' + style.color + ', opacity ' + style.opacity,
        });
        if (findings.length >= limit) break;
      }
      return findings;
    },
    [minimumFontPx, MAX_FINDINGS_PER_PROBE] as [number, number],
  );
}

/**
 * Read the font family the browser resolved for the text *inside* a container.
 *
 * A verse row is a pressable `View`; the scripture is a `Text` inside it. Reading the
 * container's computed family would report whatever it inherited, which is exactly the
 * value a broken verse style would also report. The longest run of text inside is the
 * scripture, so that is what gets measured.
 *
 * @param page The page to inspect.
 * @param testId The container's test id.
 * @returns The computed `font-family` of the longest text node inside it.
 */
export async function textFontFamily(page: Page, testId: string): Promise<string> {
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
    return window.getComputedStyle(best).fontFamily;
  }, testId);
}

/**
 * Read the font family the browser actually resolved for an element.
 *
 * @param locator The element to inspect. Must resolve to exactly one node.
 * @returns The computed `font-family` string, e.g. `"Source Serif 4", Georgia, serif`.
 */
export async function computedFontFamily(locator: Locator): Promise<string> {
  return locator.evaluate((element: Element) => window.getComputedStyle(element).fontFamily);
}

/**
 * Report whether a web font family has actually been registered and loaded.
 *
 * `document.fonts.check()` is deliberately not used: it answers true for a family the
 * document has never heard of, because there is then nothing outstanding to load. Walking
 * the font set instead asks the only question that matters — did a face with this family
 * name arrive? `expo-font` registers each face as an `@font-face`, so a loaded scripture
 * serif appears here and a silently substituted one does not.
 *
 * @param page The page to ask.
 * @param family The family name, without quotes, e.g. `Source Serif 4`.
 * @returns True when at least one face for that family has finished loading.
 */
export async function isFontLoaded(page: Page, family: string): Promise<boolean> {
  return page.evaluate((name: string) => {
    const normalise = (value: string): string => value.replace(/["']/g, '').trim().toLowerCase();
    for (const face of Array.from(document.fonts)) {
      if (normalise(face.family).startsWith(normalise(name)) && face.status === 'loaded')
        return true;
    }
    return false;
  }, family);
}
