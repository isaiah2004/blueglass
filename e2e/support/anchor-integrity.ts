/**
 * Does each pill sit against the word it claims?
 *
 * Purpose
 *   This is the pillar-3 probe. `[Route]` on Acts 16:1 says "Derbe", and the reader is
 *   entitled to read that as *this word, here, is the one the gazetteer matched*. If the
 *   pill lands one word to the left, the badge is asserting something the text does not
 *   support — a false claim, delivered with a citation, which is the worst failure this
 *   product has. It is also invisible: the pill renders, the sheet opens, the attribution
 *   is correct, every existing assertion passes, and the screenshot looks right.
 *
 *   The only way to see it is to compare the DOM against the API's own anchor. That is what
 *   this does.
 *
 * How an offset slips
 *   `anchor.start_offset` and `anchor.end_offset` index into the verse text **of one
 *   translation**. The badge endpoint is per-translation and the offsets are recomputed per
 *   translation, so a client that fetched badges for BSB and rendered them over KJV text —
 *   or that cached one chapter's badges across a translation change — anchors every pill in
 *   the chapter to the wrong word. The reader sees no error. That is the specific bug this
 *   module exists to catch, and it is why the check is run in all four translations.
 *
 * Why it reads backwards from the pill
 *   `model/verse-badges` splices a verse into `text`, `word`, `badge` segments, so the
 *   annotated word is the element immediately before its pill. Reading backwards and
 *   accumulating until there is enough text to compare survives the word being split across
 *   several spans, which is what happens when a badge anchor straddles a punctuation run.
 *
 * Dependencies
 *   `@playwright/test` for `Page`, the badge id prefix, and the shared `Finding` shape.
 */

import type { Page } from '@playwright/test';

import { INLINE_BADGE_PREFIX } from './badge-ids';
import type { Finding } from './findings';

/**
 * How much text before the pill is read while looking for the anchor word.
 *
 * The longest anchor the corpus produces is a multi-word place name; 120 characters is
 * several times that, and bounding the walk stops one malformed verse from reading an
 * entire chapter's DOM.
 */
const LOOKBEHIND_CHARS = 120;

/**
 * Compare every rendered pill against the anchor its badge declares.
 *
 * @param page The page to query.
 * @param anchorTextById The API's anchor text for each badge id, from
 *   `scripture-api.anchorTextByBadgeId`.
 * @returns One finding per pill whose preceding text is not the word it names. Empty when
 *   every pill is anchored honestly.
 */
export async function probeBadgeAnchors(
  page: Page,
  anchorTextById: Readonly<Record<string, string>>,
): Promise<Finding[]> {
  return page.evaluate(
    ([prefix, expected, lookbehind]: [string, Record<string, string>, number]): Finding[] => {
      /**
       * The text rendered immediately before an element, within its verse.
       *
       * @param pill The pill element.
       * @returns Up to `lookbehind` characters of preceding text, in reading order.
       */
      const textBefore = (pill: Element): string => {
        const verse = pill.closest('[data-testid^="verse-row-"]');
        if (verse === null) return '';
        let collected = '';
        let node: Element | null = pill.previousElementSibling;
        while (node !== null && collected.length < lookbehind) {
          collected = (node.textContent ?? '') + collected;
          node = node.previousElementSibling;
        }
        return collected.slice(-lookbehind);
      };

      const findings: Finding[] = [];
      for (const pill of document.querySelectorAll(`[data-testid^="${prefix}"]`)) {
        const badgeId = (pill.getAttribute('data-testid') ?? '').slice(prefix.length);
        const anchor = expected[badgeId];
        if (anchor === undefined || anchor === '') continue;
        const preceding = textBefore(pill).replace(/\s+$/, '');
        if (preceding.endsWith(anchor)) continue;
        findings.push({
          kind: 'badge-anchored-to-the-wrong-word',
          label: badgeId,
          detail:
            `the pill claims the word "${anchor}", but the text it sits against ends ` +
            `"...${preceding.slice(-40)}"`,
        });
      }
      return findings;
    },
    [INLINE_BADGE_PREFIX, { ...anchorTextById }, LOOKBEHIND_CHARS] as [
      string,
      Record<string, string>,
      number,
    ],
  );
}

/**
 * Which badge ids the reader rendered that the API never sent for this chapter.
 *
 * The other half of the same question. A pill whose id is not in the server's answer is a
 * claim with no source behind it at all — the state `AI-05` forbids outright — and it is
 * what a stale enrichment cache looks like after a translation or chapter change.
 *
 * @param renderedIds The badge ids currently on screen.
 * @param anchorTextById The API's answer for this chapter and translation.
 * @returns The ids the server did not send, in DOM order.
 */
export function unsourcedBadgeIds(
  renderedIds: readonly string[],
  anchorTextById: Readonly<Record<string, string>>,
): string[] {
  return renderedIds.filter((id) => !Object.hasOwn(anchorTextById, id));
}
