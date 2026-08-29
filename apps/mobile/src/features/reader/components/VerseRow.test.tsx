/**
 * Component tests for the verse row.
 *
 * What is worth asserting here, rather than in a pure test
 *   The two techniques `flutter-port-map.md` §7.3 asks to be ported are about *rendered
 *   geometry*, not about data. `verse-state-style.test.ts` proves the colour table is
 *   right; only a render can prove the row draws the bar and the gutter in every state and
 *   never changes their size. That is the constant footprint, and it is the difference
 *   between selection reading as a light coming on and reading as a reflow.
 *
 * Both themes
 *   Every assertion runs under the dark theme and the light one, because `D-01` makes
 *   "correct in both" the acceptance criterion rather than an afterthought.
 */

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

// `@/theme/runtime` re-exports the font loader, which reaches `expo-modules-core` and its
// native globals. Component tests render into jsdom, where those do not exist and are not
// what is under test. Vitest hoists this above every import below.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

// Reanimated's entry point loads `react-native-worklets`, whose package layout Node's ESM
// resolver cannot follow. The stub keeps every animation's END STATE, which is exactly what
// these assertions are about. See `../testing/reanimated-stub`.
vi.mock(
  'react-native-reanimated',
  async () => (await import('../testing/reanimated-stub')).default,
);

import type { VerseTone } from '../model/verse-selection';
import { BOTH_THEMES, ReaderTestHost, renderReader } from '../testing/render-reader';

import { VerseRow } from './VerseRow';

const VERSE_TEXT = 'Setting sail therefore from Troas, we made a straight course.';

const TONES: readonly VerseTone[] = ['rest', 'selected', 'highlighted', 'both'];

/**
 * One verse row in a given tone.
 *
 * @param tone - Which appearance to render.
 * @returns The element. Side effects: none.
 */
function row(tone: VerseTone): ReactElement {
  return (
    <VerseRow
      verseNumber={12}
      text={VERSE_TEXT}
      tone={tone}
      scriptureStep="md"
      reduceMotion
      onPress={() => undefined}
      onLongPress={() => undefined}
    />
  );
}

/**
 * The row's geometry, as react-native-web expresses it.
 *
 * RNW hoists every static style into an atomic CSS class and leaves only the dynamic ones
 * inline, so the class list IS the layout: a changed width, padding or flex direction is a
 * changed class. Comparing class lists across tones is therefore a real assertion that the
 * footprint did not move, and it is immune to the colours that are *supposed* to change.
 *
 * @param container - The rendered container.
 * @returns One entry per box, in tree order. Side effects: none.
 */
function geometry(container: HTMLElement): readonly string[] {
  // Text nodes are excluded on purpose: the verse number gains `fontWeight: 600` when the
  // verse is active (§7.3), which is a class change but not a footprint change — the gutter
  // it sits in is a fixed width either way.
  return [...container.querySelectorAll<HTMLElement>('div, button')]
    .filter((node) => !node.className.startsWith('css-text-'))
    .map((node) => node.className);
}

/**
 * The dynamic colours the row painted this render.
 *
 * @param container - The rendered container.
 * @returns Every inline background colour, in tree order. Side effects: none.
 */
function backgrounds(container: HTMLElement): readonly string[] {
  return [...container.querySelectorAll<HTMLElement>('div')]
    .map((node) => node.style.backgroundColor)
    .filter((colour) => colour !== '');
}

describe.each(BOTH_THEMES)('VerseRow in the %s theme', (theme: ThemeName) => {
  it('renders the verse text and its number', () => {
    const view = renderReader(row('rest'), theme);
    expect(view.text()).toContain('Setting sail therefore from Troas');
    expect(view.text()).toContain('12');
    view.unmount();
  });

  it('keeps an identical footprint in all four tones — the constant-footprint rule', () => {
    const view = renderReader(row('rest'), theme);
    const resting = geometry(view.container);
    expect(resting.length).toBeGreaterThan(3);

    for (const tone of TONES) {
      view.rerender(<ReaderTestHost theme={theme}>{row(tone)}</ReaderTestHost>);
      expect(geometry(view.container)).toEqual(resting);
    }
    view.unmount();
  });

  it('draws the left bar and the number gutter in every tone, including rest', () => {
    const view = renderReader(row('rest'), theme);
    for (const tone of TONES) {
      view.rerender(<ReaderTestHost theme={theme}>{row(tone)}</ReaderTestHost>);
      expect(view.byTestId('verse-bar-12')).not.toBeNull();
      expect(view.byTestId('verse-gutter-12')).not.toBeNull();
    }
    view.unmount();
  });

  it('fades through paper, never through transparent black', () => {
    const view = renderReader(row('rest'), theme);
    const colours = backgrounds(view.container);

    expect(colours.length).toBeGreaterThan(0);
    for (const colour of colours) {
      expect(colour).not.toBe('transparent');
      // `rgba(r, g, b, 0)` is the canvas at zero alpha; `rgba(0, 0, 0, 0)` is transparent
      // BLACK, which produces the grey flash `flutter-port-map.md` §7.3 warns about.
      expect(colour.replace(/\s/g, '')).not.toBe('rgba(0,0,0,0)');
      expect(colour).toMatch(/^rgba\(/);
    }
    view.unmount();
  });

  it('changes colour, and only colour, when the tone changes', () => {
    const view = renderReader(row('rest'), theme);
    const restingColours = backgrounds(view.container);
    const restingGeometry = geometry(view.container);

    view.rerender(<ReaderTestHost theme={theme}>{row('both')}</ReaderTestHost>);

    expect(backgrounds(view.container)).not.toEqual(restingColours);
    expect(geometry(view.container)).toEqual(restingGeometry);
    view.unmount();
  });

  it('exposes the verse as a labelled button', () => {
    const view = renderReader(row('selected'), theme);
    const button = view.byTestId('verse-row-12');
    expect(button?.getAttribute('aria-label')).toBe('Verse 12');
    expect(button?.getAttribute('role')).toBe('button');
    view.unmount();
  });

  it('paints the verse number in an explicit colour, in every tone', () => {
    const view = renderReader(row('rest'), theme);
    for (const tone of TONES) {
      view.rerender(<ReaderTestHost theme={theme}>{row(tone)}</ReaderTestHost>);
      const number = view.byTestId('verse-gutter-12')?.firstElementChild as HTMLElement | null;
      expect(number?.textContent).toBe('12');
      expect(number?.style.color).not.toBe('');
    }
    view.unmount();
  });

  it('gives the verse number weight when the verse is active — and only then', () => {
    const view = renderReader(row('rest'), theme);
    const numberClass = (): string =>
      (view.byTestId('verse-gutter-12')?.firstElementChild as HTMLElement | null)?.className ?? '';

    const resting = numberClass();
    for (const tone of ['selected', 'highlighted', 'both'] as const) {
      view.rerender(<ReaderTestHost theme={theme}>{row(tone)}</ReaderTestHost>);
      expect(numberClass()).not.toBe(resting);
    }
    view.unmount();
  });

  it('sets the scripture in the serif at the reading size', () => {
    const view = renderReader(row('rest'), theme);
    const body = view.container.querySelector<HTMLElement>('.r-userSelect-1xnzce8');
    expect(body?.style.fontFamily).toContain('SourceSerif4');
    expect(body?.style.fontSize).toBe('20px');
    // design-language.md §3: ~1.6 line height on scripture.
    expect(body?.style.lineHeight).toBe('32px');
    view.unmount();
  });
});
