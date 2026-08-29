/**
 * The words of a verse, with the badge labels taken back out.
 *
 * Purpose
 *   `journeys.verseText` returns the verse row's `innerText`, which is the right answer for
 *   "what does the reader see" and the wrong one for "is this the translation it claims to
 *   be". A pill is a `<View>` **inside** the verse's `<Text>` (`A-1`), so its label lands in
 *   the middle of the sentence: Acts 16:1 reads back as `1 Derbe Route and Lystra...`. Any
 *   comparison against the API's verse text then fails on every enriched verse, for a
 *   reason that has nothing to do with the text being wrong.
 *
 *   This reads the same row and drops exactly the pill labels, so a chapter can compare
 *   what is on screen against what the server said, in a chapter that has badges in it.
 *
 * What it deliberately keeps
 *   The tinted anchor word. `model/verse-badges` splices a verse into `text`, `word` and
 *   `badge` segments, and the `word` segment is the translation's own word, merely painted
 *   in the badge's hue. Dropping it would hide a reader that lost a word while tinting it.
 *
 * Dependencies
 *   `@playwright/test` for `Page`, and the badge id prefix.
 */

import type { Page } from '@playwright/test';

import { INLINE_BADGE_PREFIX } from './badge-ids';
import { verseId } from './test-ids';

/**
 * One verse's scripture, without the badge labels spliced into it.
 *
 * The verse number is still at the front — it is rendered inside the same row and there is
 * no id to exclude it by — so callers compare with `endsWith` rather than equality.
 *
 * @param page The page to query.
 * @param verse The verse number.
 * @returns The row's text with pill labels removed and whitespace collapsed.
 */
export async function verseProseText(page: Page, verse: number): Promise<string> {
  return page.evaluate(
    ([rowTestId, badgePrefix]: [string, string]): string => {
      const row = document.querySelector(`[data-testid="${rowTestId}"]`);
      if (row === null) return '';
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      let collected = '';
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const owner = node.parentElement;
        if (owner === null) continue;
        if (owner.closest(`[data-testid^="${badgePrefix}"]`) !== null) continue;
        collected += node.textContent ?? '';
      }
      return collected.replace(/\s+/g, ' ').trim();
    },
    [verseId(verse), INLINE_BADGE_PREFIX] as [string, string],
  );
}
