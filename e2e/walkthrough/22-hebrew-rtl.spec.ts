/**
 * Chapter 22 — Hebrew, right-to-left, and a badge with no source behind it.
 *
 * Why this chapter drives a diagnostic route and not the reader
 *   It has no choice, and that is itself the finding. The word layer is Greek-only —
 *   `verse_words` holds 142,096 rows, every one of them in books 40-66 — so **no `[Root]`
 *   badge anywhere in the corpus is Hebrew**, while the lexicon already holds 8,021 Hebrew
 *   and 653 Aramaic headwords waiting for verse occurrences. Right-to-left layout is
 *   therefore a rendering path with real code, real unit tests, and no example a reader can
 *   reach. `/spike/textual-sheets` is the one place it is drawn at all.
 *
 *   `docs/qa/WALKTHROUGH.md` §6 listed "Hebrew, and right-to-left layout" under *not
 *   covered*. This is the smallest honest way to cover it: drive the probe the feature team
 *   built for exactly this, and say plainly that it is a probe.
 *
 * What a component test cannot see, and this can
 *   `original-language.test.ts` proves `originalTextStyle('hebrew')` returns
 *   `writingDirection: 'rtl'`. It cannot prove that React Native Web compiles that to CSS
 *   `direction: rtl`, and it cannot prove the browser has a glyph for a single Hebrew
 *   letter. A lemma rendered as five identical boxes satisfies every assertion in the unit
 *   suite and is, in the module's own words, worse than not showing the word at all.
 *
 * The third test is the pillar-3 one
 *   The gallery deliberately includes the same `[Root]` badge with its provenance removed.
 *   `AI-05` says a badge with no source must not render its content. Nothing in chapters
 *   1-21 ever drives an unattributed payload, because the API never sends one — so the
 *   refusal path, the single mechanism standing between the product and an uncited claim,
 *   has never been exercised in a browser.
 *
 * Lifetime
 *   Delete with `/spike/textual-sheets`, or move to the reader on the day Hebrew verse
 *   words land — whichever comes first. The assertions move with it unchanged.
 *
 * Dependencies
 *   The walkthrough fixtures, the script-rendering probe, and the shell contract.
 */

import { expect, test } from '../support/fixtures';
import { launchApp, tap } from '../support/journeys';
import { hasGlyphCoverage, measureScript, within } from '../support/script-rendering';
import { SHELL_IDS } from '../support/test-ids';
import { MIN_TAP_TARGET_PX } from '../support/viewports';

/** The diagnostic route that renders the textual sheets, including the Hebrew probe. */
const GALLERY_PATH = '/spike/textual-sheets';

/** The gallery card holding the synthetic Hebrew `[Root]`. */
const HEBREW_SHEET = 'gallery-sheet-root-hebrew';

/** The gallery card holding the real Greek `[Root]`, as the left-to-right control. */
const GREEK_SHEET = 'gallery-sheet-root';

/** The gallery card holding the same badge with its provenance stripped. */
const UNATTRIBUTED_SHEET = 'gallery-sheet-unattributed';

/** The three container widths the gallery boxes each sheet to. */
const GALLERY_WIDTHS = ['phone', 'rail', 'wide'] as const;

/** The Hebrew lemma element, scoped to its own card. Five sheets share the `root-lemma` id. */
const HEBREW_LEMMA_SELECTOR = within(HEBREW_SHEET, 'root-lemma');

/** `HEBREW_ROOT_PROBE.payload.lemma` — the word the sheet must draw, in its own script. */
const HEBREW_LEMMA = 'שָׁלוֹם';

/** `ROOT_BADGE.payload.lemma` — the Greek control. */
const GREEK_LEMMA = 'πορφυρόπωλις';

/** The lemma of the badge whose sources were removed. It must appear nowhere. */
const WITHHELD_LEMMA = GREEK_LEMMA;

test.describe('22 · Hebrew and right-to-left', () => {
  test.skip(
    ({ viewportName }) => viewportName !== 'desktop',
    'the gallery sets its own container widths, so the window width would only repeat it',
  );

  test('a Hebrew lemma is drawn, in Hebrew, right to left', async ({ page, walkthrough }) => {
    // One step, not four. The standing audit runs after every step and this route currently
    // fails it (see the last test in this chapter), so a chapter split into four steps would
    // abort at the first one and measure no Hebrew at all. Keeping the measurements inside a
    // single step body means this chapter's own subject is always evaluated first, and the
    // audit failure lands after it rather than instead of it.
    await walkthrough.step('open the gallery and measure the Hebrew lemma', async () => {
      await launchApp(page, GALLERY_PATH);
      await expect(
        page.getByTestId(HEBREW_SHEET),
        `${GALLERY_PATH} did not render the Hebrew probe card. It is the only place in the ` +
          'product where right-to-left layout can be seen at all.',
      ).toBeVisible({ timeout: 30_000 });

      const lemma = page.getByTestId(HEBREW_SHEET).getByTestId('root-lemma');
      await expect(lemma, 'the Hebrew card rendered no lemma').toHaveText(HEBREW_LEMMA);
      const layout = await measureScript(page, HEBREW_LEMMA_SELECTOR);
      expect(layout, 'the Hebrew card carries no root-lemma element').toBeDefined();

      // Catches: `writingDirection: 'rtl'` never reaching the DOM. React Native Web compiles
      // it to CSS `direction`, and nothing but a browser can confirm that it did. Without it
      // the Unicode bidi algorithm still orders the letters, so the word looks right — but
      // the block aligns to the left and every neutral character (the trailing comma on "as
      // written here") lands on the wrong side of the word.
      expect(
        layout?.direction,
        'the Hebrew lemma is laid out left-to-right. original-language.ts sets ' +
          "writingDirection: 'rtl' for Hebrew and Aramaic; it is not reaching the browser.",
      ).toBe('rtl');
      expect(
        layout?.textAlign,
        'the Hebrew lemma is not right-aligned, so the block reads from the wrong edge',
      ).toBe('right');

      // Catches: tofu. `original-language.ts` names no font family for Hebrew on purpose,
      // handing the platform its own face — which is correct, and which means nothing in the
      // codebase guarantees a glyph. `toHaveText` passes on five identical boxes, because
      // textContent is what was written and not what was painted. Measuring the advance
      // against the same number of Private Use code points is what tells them apart: with no
      // coverage both fall back to .notdef and measure identically.
      expect(
        layout !== undefined && hasGlyphCoverage(layout),
        `the Hebrew lemma measures ${String(layout?.advancePx ?? 0)}px, the same as ` +
          `${String(layout?.notdefAdvancePx ?? 0)}px of glyphless code points. The browser ` +
          'is drawing substitution boxes, not Hebrew — the failure original-language.ts was ' +
          'written to avoid.',
      ).toBe(true);

      // Catches: a direction applied to every original-language lemma rather than only to
      // the right-to-left ones. Without this control the assertion above would also pass on
      // a component that sets `rtl` unconditionally, and Greek — the only original language
      // the corpus actually ships — would be the one laid out backwards.
      const greek = page.getByTestId(GREEK_SHEET).getByTestId('root-lemma');
      await expect(greek, 'the Greek card rendered no lemma').toHaveText(GREEK_LEMMA);
      const greekDirection = await greek.evaluate(
        (element: Element) => window.getComputedStyle(element).direction,
      );
      expect(
        greekDirection,
        'Greek is being laid out right-to-left, and it is the script the corpus ships',
      ).toBe('ltr');
    });
  });

  test('right-to-left survives every container width the sheet has', async ({
    page,
    walkthrough,
  }) => {
    await walkthrough.step('box the sheets to each of their three real widths', async () => {
      await launchApp(page, GALLERY_PATH);
      await expect(page.getByTestId(HEBREW_SHEET)).toBeVisible({ timeout: 30_000 });

      for (const width of GALLERY_WIDTHS) {
        await tap(page, `gallery-width-${width}`, `the ${width} width option`);

        // Catches: a right-aligned block that only survives at the width it was designed at.
        // The rail is 340 dp — narrower than a phone — and the lemma is set at 32 pt, so this
        // is where a right-aligned word wraps, overflows, or silently re-aligns to the left.
        // The standing audit measures the overflow; this measures that it is still Hebrew.
        const layout = await measureScript(page, HEBREW_LEMMA_SELECTOR);
        expect(
          layout?.direction,
          `the Hebrew lemma stopped being right-to-left at the ${width} width`,
        ).toBe('rtl');
        expect(
          layout !== undefined && hasGlyphCoverage(layout),
          `the Hebrew lemma stopped being drawn at the ${width} width`,
        ).toBe(true);
      }
    });
  });

  test('a badge with no source shows none of its content', async ({ page, walkthrough }) => {
    await walkthrough.step('read the unattributed card, and its attributed twin', async () => {
      await launchApp(page, GALLERY_PATH);
      await expect(
        page.getByTestId(UNATTRIBUTED_SHEET),
        'the gallery no longer renders the unattributed probe, so the AI-05 refusal path ' +
          'has nowhere left to be exercised in a browser',
      ).toBeVisible({ timeout: 30_000 });
      const text = await page.getByTestId(UNATTRIBUTED_SHEET).innerText();

      // Catches: the single most serious failure this product can have. AI-05 makes
      // attribution non-optional; `TextualSheet` refuses to render a payload whose sources
      // are empty. If that guard is ever inverted, weakened, or moved below the switch, the
      // app shows a lexicon entry, a definition and an occurrence count with nothing behind
      // them — a claim the reader has no way to check, which is pillar 3 exactly.
      expect(
        text,
        'the unattributed badge rendered its lemma. A badge with no provenance must show ' +
          'none of its content (AI-05); this one is making an uncited claim.',
      ).not.toContain(WITHHELD_LEMMA);
      expect(
        text,
        'the unattributed badge shows neither its content nor a reason. A silent empty box ' +
          'reads as a bug; the reader should be told why nothing is there.',
      ).toMatch(/no source attribution/i);

      // Catches: a refusal that fires for every badge. Without this the assertion above
      // would pass on a sheet that renders nothing at all, and the guard would look correct
      // while having removed the feature.
      await expect(
        page.getByTestId(GREEK_SHEET).getByTestId('root-lemma'),
        'the attributed copy of the same badge shows no lemma either, so the refusal is ' +
          'firing on everything rather than on missing provenance',
      ).toHaveText(GREEK_LEMMA);
    });
  });

  test('the probe reads in both themes', async ({ page, walkthrough }) => {
    await walkthrough.step('open the gallery and toggle to light', async () => {
      await launchApp(page, GALLERY_PATH);
      await expect(page.getByTestId(HEBREW_SHEET)).toBeVisible({ timeout: 30_000 });
      await tap(page, SHELL_IDS.themeToggle, 'the theme toggle');

      // Catches: `D-01` — light mode ships and every component is verified in both. The
      // lemma is set through `originalTextStyle`, which carries no colour and therefore
      // inherits; a component that hard-coded the dark ink would be invisible here and
      // nowhere else, because no other screen sets a 32 pt word in a script with no family.
      const layout = await measureScript(page, HEBREW_LEMMA_SELECTOR);
      expect(layout?.direction, 'the lemma lost its direction under the light theme').toBe('rtl');
      expect(
        layout !== undefined && hasGlyphCoverage(layout),
        'the Hebrew lemma is not drawn under the light theme',
      ).toBe(true);
      await expect(page.getByTestId(HEBREW_SHEET)).toBeVisible();
    });
  });

  test('the width control on this route is big enough to touch', async ({ page, walkthrough }) => {
    await walkthrough.step('measure the segmented control', async () => {
      await launchApp(page, GALLERY_PATH);
      await expect(page.getByTestId('gallery-width')).toBeVisible({ timeout: 30_000 });

      // Catches: `SegmentedControl` laying out `size.control` (32 dp) with no hit-area
      // padding. `theme/spacing.ts` states the rule on the token itself — "44 — the minimum
      // touchable area ... a control shorter than this pads its hit area up to it" — and the
      // component does not. It is named here explicitly, rather than left to the standing
      // audit, because the same component is the reader's display-size switcher and the
      // settings theme switcher, and a finding attributed to a diagnostic route reads as a
      // diagnostic-route problem.
      const tooSmall = await page.evaluate((minimum: number) => {
        const problems: string[] = [];
        for (const segment of document.querySelectorAll('[data-testid^="gallery-width-"]')) {
          const box = segment.getBoundingClientRect();
          if (box.height >= minimum) continue;
          problems.push(
            `${segment.getAttribute('data-testid') ?? '?'} is ${box.height.toFixed(0)}px tall`,
          );
        }
        return problems;
      }, MIN_TAP_TARGET_PX);

      expect(
        tooSmall,
        `every segment must present at least ${String(MIN_TAP_TARGET_PX)}px of touchable ` +
          'height (theme/spacing.ts, size.tapTarget). SegmentedControl sets minHeight to ' +
          'size.control and adds no vertical padding, so every screen using it — the ' +
          "reader's display sheet and the settings theme switcher included — ships segments " +
          'a finger cannot reliably hit.',
      ).toEqual([]);
    });
  });
});
