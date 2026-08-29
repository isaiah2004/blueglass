/**
 * Component tests for the `[Root]` sheet.
 *
 * What is worth asserting here, rather than in a pure test
 *   Two things a pure test cannot reach. First, that the Greek and Hebrew actually arrive in
 *   the document intact — a lemma silently mangled by a font, an encoding, or a normalisation
 *   pass is the classic failure of an original-language feature, and the only proof is a
 *   render. Second, that a Hebrew lemma is laid out right to left once react-native-web has
 *   compiled the style, which is a different question from whether the style object said so.
 *
 * Both themes
 *   Every assertion runs under the dark palette and the light one, because `D-01` makes
 *   "correct in both" the acceptance criterion rather than an afterthought.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// `@/theme/runtime` re-exports the font loader, which reaches `expo-modules-core` and its
// native globals. Component tests render into jsdom, where those do not exist and are not
// what is under test. Vitest hoists this above every import below.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import type { ThemeName } from '@/theme';

import { ACTS_16_14_TEXT, HEBREW_ROOT_PROBE, ROOT_BADGE } from '../testing/fixtures';
import { BOTH_THEMES, appliedStyle, press, renderSheet } from '../testing/render-textual';
import { useFlashcardDrafts } from './flashcard-store';
import { RootSheet } from './RootSheet';

afterEach(() => {
  useFlashcardDrafts.getState().clear();
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('RootSheet in the %s theme', (theme: ThemeName) => {
  it('renders the Greek lemma exactly as the lexicon holds it', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);

    expect(view.byTestId('root-lemma')?.textContent).toBe('πορφυρόπωλις');
    view.unmount();
  });

  it('renders the transliteration and the Strongs number', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);

    expect(view.byTestId('root-transliteration')?.textContent).toBe('porphuropōlis');
    expect(view.byTestId('root-strongs')?.textContent).toBe("Strong's G4211");
    view.unmount();
  });

  it('shows the inflected form the verse actually spells', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);

    expect(view.byTestId('root-surface')?.textContent).toBe('πορφυρόπωλις');
    view.unmount();
  });

  it('states how rare the word is, in words and not only as a number', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);

    expect(view.byTestId('root-rarity')?.textContent).toBe(
      'This word occurs once in the whole of the Greek New Testament.',
    );
    view.unmount();
  });

  it('names its sources and their licences (AI-05)', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);
    const strip = view.byTestId('root-sources');

    expect(strip?.textContent).toContain('STEP Bible — www.STEPBible.org (CC BY 4.0)');
    expect(strip?.textContent).toContain('CC-BY-4.0');
    expect(strip?.textContent).toContain('CC0-1.0');
    view.unmount();
  });

  it('lists the verse the word was found in, with its text', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} verseText={ACTS_16_14_TEXT} />, theme);
    const row = view.byTestId('root-example-row');

    expect(row?.textContent).toContain('Acts 16:14');
    expect(row?.textContent).toContain('a dealer in purple cloth');
    view.unmount();
  });

  it('opens the verse when its row is pressed', () => {
    const onOpenVerse = vi.fn();
    const view = renderSheet(
      <RootSheet badge={ROOT_BADGE} verseText={ACTS_16_14_TEXT} onOpenVerse={onOpenVerse} />,
      theme,
    );

    press(view.byTestId('root-example-row'));

    expect(onOpenVerse).toHaveBeenCalledTimes(1);
    expect(onOpenVerse.mock.calls[0]?.[0]).toMatchObject({
      bookId: 'acts',
      chapter: 16,
      verseNumber: 14,
    });
    view.unmount();
  });

  it('saves and un-saves a flashcard', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, theme);
    const button = view.byTestId('root-save-flashcard');

    expect(button?.getAttribute('aria-checked')).toBe('false');

    press(button);
    expect(useFlashcardDrafts.getState().drafts['G4211']?.lemma).toBe('πορφυρόπωλις');

    press(view.byTestId('root-save-flashcard'));
    expect(useFlashcardDrafts.getState().drafts['G4211']).toBeUndefined();
    view.unmount();
  });
});

describe('RootSheet and a headword too wide for its surface', () => {
  // Measured in Chrome, not asserted from theory: in the 231 dp tablet rail
  // `προευαγγελίζομαι` laid out 266 dp wide and an ancestor clipped it to
  // `προευαγγελίζομα`, with no ellipsis to tell the reader a letter was missing. jsdom
  // cannot lay text out, so what is pinned here is the pair of properties that let the box
  // be narrower than the word: a flex item defaults to `min-width: auto`, its min-content
  // width, and a shrink-to-fit cross size takes that same min-content width, so the lemma
  // has to both stretch and be allowed below its content width. Either alone still clips.
  it.each(['root-lemma', 'root-surface'])('lets %s wrap rather than be clipped', (testID) => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, 'dark');
    const element = view.byTestId(testID);

    expect(element, `${testID} is not rendered`).not.toBeNull();
    const style = getComputedStyle(element as HTMLElement);
    expect(style.minWidth).toBe('0px');
    expect(style.alignSelf).toBe('stretch');
    view.unmount();
  });
});

describe('RootSheet and right-to-left scripts', () => {
  it('renders a Hebrew lemma intact, not as replacement characters', () => {
    const view = renderSheet(<RootSheet badge={HEBREW_ROOT_PROBE} />, 'dark');

    expect(view.byTestId('root-lemma')?.textContent).toBe('שָׁלוֹם');
    expect(view.byTestId('root-lemma')?.textContent).not.toContain('�');
    view.unmount();
  });

  it('lays a Hebrew lemma out right to left once the style is compiled', () => {
    const view = renderSheet(<RootSheet badge={HEBREW_ROOT_PROBE} />, 'dark');
    const lemma = view.byTestId('root-lemma');
    const style = lemma === null ? {} : appliedStyle(lemma);

    expect(style['direction']).toBe('rtl');
    expect(style['text-align']).toBe('right');
    view.unmount();
  });

  it('does not name the Latin-and-Greek serif for a Hebrew lemma', () => {
    const view = renderSheet(<RootSheet badge={HEBREW_ROOT_PROBE} />, 'dark');
    const lemma = view.byTestId('root-lemma');
    const style = lemma === null ? {} : appliedStyle(lemma);

    // Source Serif 4 has no Hebrew block. What the element falls back to is the platform's
    // own stack, which does — the point is only that the serif is not named.
    expect(style['font-family'] ?? '').not.toContain('SourceSerif4');
    view.unmount();
  });

  it('lays a Greek lemma out left to right, in the scripture serif', () => {
    const view = renderSheet(<RootSheet badge={ROOT_BADGE} />, 'dark');
    const lemma = view.byTestId('root-lemma');
    const style = lemma === null ? {} : appliedStyle(lemma);

    expect(style['direction']).toBe('ltr');
    expect(style['font-family']).toContain('SourceSerif4-Regular');
    view.unmount();
  });
});
