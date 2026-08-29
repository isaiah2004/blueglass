/**
 * Layout probes — measurements taken inside the page.
 *
 * Purpose
 *   These are the four ways a layout betrays a reader without throwing anything: the page
 *   scrolls sideways, an element hangs off the edge, a label is cut in half, or two pieces
 *   of text land on top of each other. None of them fails a unit test, and none of them
 *   fails a smoke test that only asks "is the text present".
 *
 * Why each probe is its own `page.evaluate`
 *   A function handed to `page.evaluate` is serialised and re-parsed in the browser, so it
 *   cannot reference anything from module scope. One combined probe would therefore have to
 *   be a single very long self-contained function, which the 50-line rule forbids. Small
 *   independent probes cost a few extra round-trips and stay readable.
 *
 * Dependencies
 *   `@playwright/test` for the `Page` type, and the shared `Finding` shape.
 */

import type { Page } from '@playwright/test';

import type { Finding } from './findings';

/** How many findings of one kind are worth reporting before the point is made. */
const MAX_FINDINGS_PER_PROBE = 10;

/**
 * Does the whole document scroll horizontally?
 *
 * Catches: a rail, verse row or badge wider than the phone viewport — the single most
 * common way a responsive layout fails, and the one a reader notices instantly.
 *
 * @param page The page to measure.
 * @returns One finding if the document overflows horizontally, otherwise none.
 */
export async function probeDocumentOverflow(page: Page): Promise<Finding[]> {
  return page.evaluate((): Finding[] => {
    const root = document.documentElement;
    const overflow = root.scrollWidth - root.clientWidth;
    if (overflow <= 1) return [];
    return [
      {
        kind: 'horizontal-page-scroll',
        label: 'html',
        detail:
          'scrollWidth ' +
          String(root.scrollWidth) +
          'px exceeds clientWidth ' +
          String(root.clientWidth) +
          'px by ' +
          String(overflow) +
          'px',
      },
    ];
  });
}

/**
 * Which visible elements hang off the right edge of the viewport?
 *
 * Catches: the element responsible for a horizontal scroll, and the subtler case where an
 * ancestor clips the overflow so the page does not scroll but the content is simply gone —
 * a fixed-width card at 375 px, or a long unbroken reference that will not wrap. Elements
 * inside a deliberately horizontally-scrollable ancestor are excluded.
 *
 * So is anything drawn inside an `<svg>`. An SVG child reports its full geometric bounding
 * box regardless of the viewBox that clips it, so a decorative circle bled 1152 px past a
 * 1280 px viewport in this project's own texture layer while rendering perfectly. The root
 * `<svg>` is still measured — that one really can overflow.
 *
 * @param page The page to measure.
 * @returns Up to ten offending elements.
 */
export async function probeOverhangingElements(page: Page): Promise<Finding[]> {
  return page.evaluate((limit: number): Finding[] => {
    const findings: Finding[] = [];
    const viewportWidth = window.innerWidth;
    const exempt = (element: Element): boolean => {
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        if (node.tagName.toLowerCase() === 'svg') return true;
        const overflowX = window.getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      return false;
    };
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const overhang = Math.round(rect.right - viewportWidth);
      if (overhang <= 1 || exempt(element)) continue;
      const testId = element.getAttribute('data-testid') ?? '(no test id)';
      const text = (element.textContent ?? '').trim().slice(0, 40);
      findings.push({
        kind: 'element-wider-than-viewport',
        label: element.tagName.toLowerCase() + ' ' + testId + ' ' + text,
        detail:
          'right edge is ' +
          String(overhang) +
          'px past the ' +
          String(viewportWidth) +
          'px viewport',
      });
      if (findings.length >= limit) break;
    }
    return findings;
  }, MAX_FINDINGS_PER_PROBE);
}

/**
 * Which text sits below the bottom edge with no way to scroll to it?
 *
 * Catches: fixed chrome that is taller than the space it was given — the classic being a
 * bottom tab bar whose labels are sliced in half by the viewport edge, which is invisible
 * to every other probe because the element's own box is not overflowing and the page has no
 * scroll to reveal it. A reader simply never sees the bottom of those words.
 *
 * Text inside something scrollable is ignored: content below the fold that a reader can
 * reach is not a defect, it is a page.
 *
 * @param page The page to measure.
 * @returns Up to ten unreachable text elements.
 */
export async function probeTextBelowViewport(page: Page): Promise<Finding[]> {
  return page.evaluate((limit: number): Finding[] => {
    const findings: Finding[] = [];
    const viewportHeight = window.innerHeight;
    if (document.documentElement.scrollHeight > document.documentElement.clientHeight + 1)
      return [];
    const inScroller = (element: Element): boolean => {
      for (let node = element.parentElement; node !== null; node = node.parentElement) {
        const overflowY = window.getComputedStyle(node).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return true;
      }
      return false;
    };
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      if (element.children.length > 0) continue;
      const text = (element.textContent ?? '').trim();
      if (text === '') continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const below = Math.round(rect.bottom - viewportHeight);
      if (below <= 1 || inScroller(element)) continue;
      findings.push({
        kind: 'text-below-the-viewport',
        label: JSON.stringify(text.slice(0, 40)),
        detail:
          'its last ' +
          String(below) +
          'px fall past the ' +
          String(viewportHeight) +
          'px viewport, and nothing scrolls to reveal them',
      });
      if (findings.length >= limit) break;
    }
    return findings;
  }, MAX_FINDINGS_PER_PROBE);
}

/**
 * Which text is cut off by its own container?
 *
 * Catches: a translation code truncated to "BS", a verse reference clipped in a rail that
 * got narrower than its content, a button label that lost its last word. Only elements that
 * clip without an ellipsis are reported — an explicit `text-overflow: ellipsis` is a
 * deliberate design choice, not a defect.
 *
 * @param page The page to measure.
 * @returns Up to ten clipped text elements.
 */
export async function probeClippedText(page: Page): Promise<Finding[]> {
  return page.evaluate((limit: number): Finding[] => {
    const findings: Finding[] = [];
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      if (element.children.length > 0) continue;
      const text = (element.textContent ?? '').trim();
      if (text === '') continue;
      const style = window.getComputedStyle(element);
      if (style.overflow === 'visible' || style.textOverflow === 'ellipsis') continue;
      const clippedX = element.scrollWidth - element.clientWidth;
      const clippedY = element.scrollHeight - element.clientHeight;
      if (clippedX <= 1 && clippedY <= 1) continue;
      findings.push({
        kind: 'clipped-text',
        label: JSON.stringify(text.slice(0, 48)),
        detail:
          'content overflows its box by ' +
          String(Math.max(clippedX, 0)) +
          'px wide and ' +
          String(Math.max(clippedY, 0)) +
          'px tall, with overflow:' +
          style.overflow +
          ' and no ellipsis',
      });
      if (findings.length >= limit) break;
    }
    return findings;
  }, MAX_FINDINGS_PER_PROBE);
}

/**
 * Which pieces of text are drawn on top of each other?
 *
 * Catches: a verse number colliding with the verse it numbers, a chapter heading landing on
 * the first line of scripture, two tab labels overlapping when the bar runs out of room.
 * Restricted to sibling leaf-text elements that are both in normal flow, because that is
 * the case where overlap is always a bug — an absolutely positioned sheet is supposed to
 * cover what is behind it.
 *
 * @param page The page to measure.
 * @returns Up to ten overlapping pairs.
 */
export async function probeOverlappingText(page: Page): Promise<Finding[]> {
  return page.evaluate((limit: number): Finding[] => {
    const groups = new Map<Element, Element[]>();
    for (const element of Array.from(document.body.querySelectorAll('*'))) {
      const parent = element.parentElement;
      if (parent === null || element.children.length > 0) continue;
      if ((element.textContent ?? '').trim() === '') continue;
      if (window.getComputedStyle(element).position !== 'static') continue;
      if (element.getBoundingClientRect().width < 1) continue;
      groups.set(parent, [...(groups.get(parent) ?? []), element]);
    }
    const findings: Finding[] = [];
    const label = (element: Element): string =>
      JSON.stringify((element.textContent ?? '').trim().slice(0, 24));
    for (const group of Array.from(groups.values())) {
      for (let i = 0; i < group.length && findings.length < limit; i += 1) {
        for (let j = i + 1; j < group.length && findings.length < limit; j += 1) {
          const a = group[i]!.getBoundingClientRect();
          const b = group[j]!.getBoundingClientRect();
          const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (overlapX <= 1 || overlapY <= 1) continue;
          const smallest = Math.min(a.width * a.height, b.width * b.height);
          if (smallest <= 0 || (overlapX * overlapY) / smallest < 0.25) continue;
          findings.push({
            kind: 'overlapping-text',
            label: label(group[i]!) + ' over ' + label(group[j]!),
            detail:
              'siblings in normal flow overlap by ' +
              String(Math.round(overlapX)) +
              'x' +
              String(Math.round(overlapY)) +
              'px',
          });
        }
      }
    }
    return findings;
  }, MAX_FINDINGS_PER_PROBE);
}
