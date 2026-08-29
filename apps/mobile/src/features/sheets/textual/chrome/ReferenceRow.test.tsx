/**
 * Component tests for `ReferenceRow`'s header, the row that clipped a vote count.
 *
 * What is worth asserting here
 *   jsdom has no layout engine, so no test in this file can measure an overflow — that was
 *   measured in Chrome, at the 231 dp tablet rail, where `1 Thessalonians 5:16-18` wrapped
 *   to two lines and pushed the strength meter 13 dp past the rail to be clipped as
 *   `STRONG CONSENS` / `42 VOT`. What a test *can* pin is the rule that stops it: both
 *   children of the header must be able to shrink below their own content width. React
 *   Native defaults `flexShrink` to 0 and a flex item will not go below its min-content
 *   width without `minWidth: 0`, so the pair has to be asserted together — either one alone
 *   silently restores the defect.
 *
 * Why the computed style and not a snapshot
 *   React Native Web compiles `StyleSheet` values into generated class names whose hashes
 *   change with the value. Reading the resolved `flex-shrink` and `min-width` asserts the
 *   property the browser actually applies, and survives a rename of the class.
 *
 * Both themes
 *   `D-01`: every component verified in both.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// See the note in `RootSheet.test.tsx`: the theme runtime reaches `expo-modules-core`.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import type { ThemeName } from '@/theme';

import { BOTH_THEMES, renderSheet } from '../testing/render-textual';

import { ReferenceRow } from './ReferenceRow';

/** The widest reference the cross-reference corpus produces, and the one that clipped. */
const LONG_REFERENCE = '1 Thessalonians 5:16-18';

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('ReferenceRow in the %s theme', (theme: ThemeName) => {
  it('gives the trailing slot room to shrink and wrap inside the row', () => {
    const view = renderSheet(
      <ReferenceRow
        testID="row"
        reference={LONG_REFERENCE}
        trailing={<span data-testid="meter">Strong consensus</span>}
      />,
      theme,
    );

    const slot = view.byTestId('row')?.querySelector('[data-testid="meter"]')?.parentElement;
    expect(slot, 'the trailing node is rendered into a slot the row can size').not.toBeNull();

    const style = getComputedStyle(slot as HTMLElement);
    expect(style.flexShrink).toBe('1');
    expect(style.minWidth).toBe('0px');
    view.unmount();
  });

  it('lets the reference itself shrink below its own content width', () => {
    const view = renderSheet(<ReferenceRow testID="row" reference={LONG_REFERENCE} />, theme);

    const reference = [...(view.byTestId('row')?.children ?? [])][0]?.firstElementChild;
    expect(reference?.textContent).toBe(LONG_REFERENCE);

    const style = getComputedStyle(reference as HTMLElement);
    expect(style.flexShrink).toBe('1');
    expect(style.minWidth).toBe('0px');
    view.unmount();
  });

  it('renders no trailing slot at all when there is nothing to put in it', () => {
    const view = renderSheet(<ReferenceRow testID="row" reference={LONG_REFERENCE} />, theme);

    const header = view.byTestId('row')?.firstElementChild;
    expect(header?.childElementCount).toBe(1);
    view.unmount();
  });
});
