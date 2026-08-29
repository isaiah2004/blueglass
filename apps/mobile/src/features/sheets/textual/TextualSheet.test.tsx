/**
 * Component tests for the dispatcher and the `AI-05` gate.
 *
 * What is worth asserting here
 *   The gate, mostly. `AI-05` says a badge that cannot name its source and licence is not
 *   rendered, and the failure mode is silent: the sheet renders beautifully and simply stops
 *   crediting anyone. These tests prove that an unattributed badge shows none of its payload
 *   — not the lemma, not a ruler, not one verse of a cross-reference — whichever kind it is.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// See the note in `root/RootSheet.test.tsx`: the theme runtime reaches `expo-modules-core`.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import type { SourceAttribution } from '@atlas/shared';

import type { TextualBadge } from './model/textual-payloads';
import { CROSS_REF_BADGE, HISTORY_BADGE, ROOT_BADGE } from './testing/fixtures';
import { renderSheet } from './testing/render-textual';
import { TextualSheet } from './TextualSheet';

/** The three badges, with the content each must be shown to withhold. */
const BADGES: readonly (readonly [string, TextualBadge, string])[] = [
  ['root', ROOT_BADGE, 'πορφυρόπωλις'],
  ['history', HISTORY_BADGE, 'Claudius'],
  ['cross-ref', CROSS_REF_BADGE, 'John 1:12'],
];

/**
 * The same badge with its provenance stripped.
 *
 * @param badge - The badge to strip.
 * @param sources - What to replace `sources` with.
 * @returns The stripped badge. Side effects: none.
 */
function withSources(badge: TextualBadge, sources: readonly SourceAttribution[]): TextualBadge {
  return { ...badge, sources };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('TextualSheet', () => {
  it.each(BADGES)('renders the %s sheet', (_kind, badge, expected) => {
    const view = renderSheet(<TextualSheet badge={badge} />, 'dark');

    expect(view.text()).toContain(expected);
    view.unmount();
  });

  it.each(BADGES)('withholds the %s payload when no source is named', (_kind, badge, expected) => {
    const view = renderSheet(<TextualSheet badge={withSources(badge, [])} />, 'dark');

    expect(view.byTestId('textual-sheet-unattributed')).not.toBeNull();
    expect(view.text()).not.toContain(expected);
    view.unmount();
  });

  it('withholds the payload when the only source cannot name its licence', () => {
    const unlicensed: SourceAttribution = {
      key: 'mystery',
      name: 'Somewhere',
      license: '',
      attribution: 'Somebody said so',
      shareAlike: false,
    };
    const view = renderSheet(
      <TextualSheet badge={withSources(ROOT_BADGE, [unlicensed])} />,
      'dark',
    );

    expect(view.byTestId('textual-sheet-unattributed')).not.toBeNull();
    view.unmount();
  });

  it('explains the refusal rather than showing a blank sheet', () => {
    const view = renderSheet(<TextualSheet badge={withSources(ROOT_BADGE, [])} />, 'dark');

    expect(view.text()).toContain('names the dataset it came from');
    view.unmount();
  });
});
