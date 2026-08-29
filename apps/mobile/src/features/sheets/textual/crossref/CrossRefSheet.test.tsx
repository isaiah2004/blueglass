/**
 * Component tests for the `[Cross-Ref]` sheet.
 *
 * What is worth asserting here, rather than in a pure test
 *   The thing that makes this sheet useful rather than merely correct: the scripture is on
 *   screen, in order, and a tap on it goes somewhere. `crossref-targets.test.ts` proves the
 *   ranking; only a render proves the ranking is what the reader sees and that the row for
 *   `Acts 2:38-39` admits it is showing one verse of two.
 *
 * Both themes
 *   Every assertion runs under both palettes (`D-01`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// See the note in `RootSheet.test.tsx`: the theme runtime reaches `expo-modules-core`.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import type { ThemeName } from '@/theme';

import { CROSS_REF_BADGE } from '../testing/fixtures';
import { BOTH_THEMES, press, renderSheet } from '../testing/render-textual';
import { CrossRefSheet } from './CrossRefSheet';

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('CrossRefSheet in the %s theme', (theme: ThemeName) => {
  it('shows the text of a linked verse, not only its reference', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);
    const row = view.byTestId('cross-ref-row-43001012');

    expect(row?.textContent).toContain('John 1:12');
    expect(row?.textContent).toContain('the right to become children of God');
    view.unmount();
  });

  it('lists every link the payload carries', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);

    expect(view.container.querySelectorAll('[data-testid^="cross-ref-row-"]')).toHaveLength(6);
    view.unmount();
  });

  it('orders the links strongest first', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);
    const rows = [...view.container.querySelectorAll('[data-testid^="cross-ref-row-"]')];

    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'cross-ref-row-43001012',
      'cross-ref-row-43003036',
      'cross-ref-row-44002038',
      'cross-ref-row-45010009',
      'cross-ref-row-44011013',
      'cross-ref-row-41016016',
    ]);
    view.unmount();
  });

  it('shows how strongly attested each link is, in words and in votes', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);
    const strongest = view.byTestId('cross-ref-row-43001012');

    expect(strongest?.textContent).toContain('Strong consensus');
    expect(strongest?.textContent).toContain('43 votes');
    view.unmount();
  });

  it('admits when a row shows only the first verse of a span', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);

    expect(view.byTestId('cross-ref-row-44002038')?.textContent).toContain(
      'First verse of Acts 2:38-39',
    );
    view.unmount();
  });

  it('does not add a first-verse note to a single verse', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);

    expect(view.byTestId('cross-ref-row-41016016')?.textContent).not.toContain('First verse of');
    view.unmount();
  });

  it('says that OpenBible records the link and not the reason for it', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);

    expect(view.byTestId('cross-ref-targets')?.textContent).toContain('not the reason for it');
    view.unmount();
  });

  it('names its source and licence (AI-05)', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, theme);

    expect(view.byTestId('cross-ref-sources')?.textContent).toContain(
      'Cross-references © OpenBible.info, CC BY 4.0',
    );
    view.unmount();
  });
});

describe('CrossRefSheet navigation', () => {
  it('opens the first verse of a span, not its middle', () => {
    const onOpenVerse = vi.fn();
    const view = renderSheet(
      <CrossRefSheet badge={CROSS_REF_BADGE} onOpenVerse={onOpenVerse} />,
      'dark',
    );

    press(view.byTestId('cross-ref-row-44002038'));

    expect(onOpenVerse.mock.calls[0]?.[0]).toMatchObject({
      bookId: 'acts',
      chapter: 2,
      verseNumber: 38,
      label: 'Acts 2:38-39',
    });
    view.unmount();
  });

  it('crosses into another book when the link does', () => {
    const onOpenVerse = vi.fn();
    const view = renderSheet(
      <CrossRefSheet badge={CROSS_REF_BADGE} onOpenVerse={onOpenVerse} />,
      'dark',
    );

    press(view.byTestId('cross-ref-row-43001012'));

    expect(onOpenVerse.mock.calls[0]?.[0]).toMatchObject({ bookId: 'john', chapter: 1 });
    view.unmount();
  });

  it('renders readable rows when no navigation handler is given', () => {
    const view = renderSheet(<CrossRefSheet badge={CROSS_REF_BADGE} />, 'dark');

    expect(view.byTestId('cross-ref-row-43001012')?.textContent).toContain('John 1:12');
    view.unmount();
  });
});
