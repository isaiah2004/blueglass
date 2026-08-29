/**
 * Chapter 4 · Changing translation.
 *
 * `S-01` ships multiple open translations behind a switcher, and the seeded catalogue names
 * them: BSB, KJV, WEB and ASV, with BSB the default. This chapter drives that switcher, and it carries
 * the one assertion in the whole suite with legal weight — the licensed translations that
 * appear throughout the reference mockups must never be offered. ESV is in `image1.png`.
 * Copying a mockup faithfully is how it would ship.
 *
 * Route: `/read/{book}/{chapter}`
 */

import { expect, test } from '../support/fixtures';
import {
  DEFAULT_TRANSLATION,
  LICENSED_TRANSLATIONS,
  OPEN_TRANSLATIONS,
  openReader,
  tap,
  verseText,
} from '../support/journeys';
import { TRANSLATION_IDS, translationOptionId } from '../support/test-ids';

test.describe('chapter 4 · changing translation', () => {
  test('the switcher offers every open translation and no licensed one', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('open the reader', async () => {
      await openReader(page);
    });

    await walkthrough.step('the reader states which translation it is showing', async () => {
      const code = (await page.getByTestId(TRANSLATION_IDS.switcher).innerText()).trim();

      // Catches: a reader that renders scripture without saying whose. Every open
      // translation carries an attribution obligation, and a reader comparing wordings
      // needs to know which one is on screen.
      expect(
        code,
        `the switcher reads "${code}"; expected one of ${OPEN_TRANSLATIONS.join(', ')}`,
      ).toContain(DEFAULT_TRANSLATION);
    });

    await walkthrough.step('open the switcher', async () => {
      await tap(page, TRANSLATION_IDS.switcher, 'the translation switcher');
      await expect(
        page.getByTestId(TRANSLATION_IDS.menu),
        `the switcher menu (testID "${TRANSLATION_IDS.menu}") did not open`,
      ).toBeVisible();
    });

    await walkthrough.step('every shipped translation is offered', async () => {
      for (const code of OPEN_TRANSLATIONS) {
        // Catches: a catalogue that silently lost a translation between the seed script and
        // the switcher — the reader would have no way to notice, and neither would a unit
        // test of the API.
        await expect(
          page.getByTestId(translationOptionId(code)),
          `${code} is missing from the switcher, though the seeded catalogue ships it`,
        ).toBeVisible();
      }
    });

    await walkthrough.step('no licensed translation is offered', async () => {
      const menu = page.getByTestId(TRANSLATION_IDS.menu);
      const offered = (await menu.innerText()).toUpperCase();
      for (const code of LICENSED_TRANSLATIONS) {
        // Catches: a licensed translation copied out of the mockups into the switcher.
        // ESV appears in the reference designs and must never ship (S-01); this is the
        // assertion that stops a pixel-faithful port becoming a copyright violation.
        expect(
          offered,
          `the switcher offers ${code}, which is licensed and must never ship (S-01)`,
        ).not.toMatch(new RegExp(`\\b${code}\\b`));
      }
    });
  });

  test('choosing another translation changes the words on screen', async ({
    page,
    walkthrough,
  }) => {
    let before = '';

    await walkthrough.step('read verse 1 in the default translation', async () => {
      await openReader(page);
      before = await verseText(page, 1);
      expect(before, 'verse 1 is empty before the switch').not.toBe('');
    });

    await walkthrough.step('switch to the KJV', async () => {
      await tap(page, TRANSLATION_IDS.switcher, 'the translation switcher');
      await tap(page, translationOptionId('KJV'), 'the KJV option');

      // Catches: a menu that never closes, which leaves the reading canvas covered — a
      // direct pillar-1 failure ("no floating menus over scripture").
      await expect(
        page.getByTestId(TRANSLATION_IDS.menu),
        'the switcher menu stayed open over the scripture after a choice was made',
      ).toBeHidden();
    });

    await walkthrough.step('the reader now shows the KJV, and says so', async () => {
      await expect(
        page.getByTestId(TRANSLATION_IDS.switcher),
        'the switcher still names the old translation after switching',
      ).toContainText('KJV');

      // Catches: a switcher wired to state but not to the query — the label changes, the
      // scripture does not, and a reader comparing wordings is quietly shown the wrong one.
      await expect
        .poll(async () => verseText(page, 1), {
          message: 'verse 1 never changed after switching from BSB to KJV',
        })
        .not.toBe(before);
    });
  });
});
