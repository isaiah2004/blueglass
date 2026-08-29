/**
 * Component tests for the `[History]` sheet.
 *
 * What is worth asserting here, rather than in a pure test
 *   That the obligations actually reach the screen. `dating-notice.test.ts` proves the
 *   Murai wording is right; only a render proves it is rendered, and that the heading is the
 *   sourced year rather than the attributed title — the `Q-015` failure that would look
 *   perfectly good in a screenshot.
 *
 * Both themes
 *   Every assertion runs under both palettes (`D-01`).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// See the note in `RootSheet.test.tsx`: the theme runtime reaches `expo-modules-core`.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import type { ThemeName } from '@/theme';

import type { HistorySheetBadge } from '../model/textual-payloads';
import { HISTORY_BADGE } from '../testing/fixtures';
import { BOTH_THEMES, renderSheet } from '../testing/render-textual';
import { HistorySheet } from './HistorySheet';

/**
 * The fixture with a replaced payload.
 *
 * @param payload - The payload to use.
 * @returns The badge. Side effects: none.
 */
function withPayload(payload: HistorySheetBadge['payload']): HistorySheetBadge {
  return { ...HISTORY_BADGE, payload };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('HistorySheet in the %s theme', (theme: ThemeName) => {
  it('heads the sheet with the sourced year, not with Murais title (Q-015)', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const headings = view.byRole('heading');

    expect(headings.map((node) => node.textContent)).toContain('AD 47');
    expect(headings.map((node) => node.textContent)).not.toContain(
      "Paul's vision of the man of Macedonia",
    );
    view.unmount();
  });

  it("shows the title inside its attribution, labelled Murai's reading", () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const note = view.byTestId('history-murai-note');

    expect(note?.textContent).toContain("Murai's reading");
    expect(note?.textContent).toContain('Hajime Murai');
    expect(note?.textContent).toContain("Paul's vision of the man of Macedonia");
    view.unmount();
  });

  it('names who was on the throne', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);

    expect(view.text()).toContain('Claudius held the imperial throne.');
    view.unmount();
  });

  it('draws both axes, with the rulers and the events', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const timeline = view.byTestId('history-timeline');

    expect(timeline?.textContent).toContain('Claudius, Emperor of Roman Empire');
    expect(timeline?.textContent).toContain('Call to Macedonia');
    view.unmount();
  });

  it('prints each nodes own date label and never the sort year', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const timeline = view.byTestId('history-timeline');

    // The reign is a span in the sources and stays one on screen.
    expect(timeline?.textContent).toContain('AD 41 to AD 54');
    view.unmount();
  });

  it('marks the row the passage is dated to', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);

    expect(view.byTestId('history-passage-marker')).not.toBeNull();
    view.unmount();
  });

  it('shows the working behind the date, and calls the number coverage', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const rationale = view.byTestId('history-rationale');

    expect(rationale?.textContent).toContain('narrates about 60% of this passage');
    expect(rationale?.textContent).toContain('Covers about 60% of the passage');
    view.unmount();
  });

  it('says that dating is New Testament only (Q-016)', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);

    expect(view.byTestId('history-era-note')?.textContent).toContain('Old Testament');
    view.unmount();
  });

  it('names its sources, including the share-alike one (AI-05)', () => {
    const view = renderSheet(<HistorySheet badge={HISTORY_BADGE} />, theme);
    const strip = view.byTestId('history-sources');

    expect(strip?.textContent).toContain('Theographic Bible Metadata');
    expect(strip?.textContent).toContain('CC-BY-SA-4.0');
    expect(strip?.textContent).toContain('Hajime Murai');
    view.unmount();
  });
});

describe('HistorySheet with incomplete data', () => {
  it('shows no attribution note, and no title anywhere, when the scholar is missing', () => {
    // `exactOptionalPropertyTypes` means the field is removed, not set to `undefined`.
    const { attributedTo, ...rest } = HISTORY_BADGE.payload;
    expect(attributedTo).toBe('Hajime Murai');

    const view = renderSheet(<HistorySheet badge={withPayload(rest)} />, 'dark');

    expect(view.byTestId('history-murai-note')).toBeNull();
    expect(view.text()).not.toContain("Paul's vision of the man of Macedonia");
    view.unmount();
  });

  it('says plainly when nothing is sourced for the year, instead of drawing an empty spine', () => {
    const view = renderSheet(
      <HistorySheet
        badge={withPayload({ ...HISTORY_BADGE.payload, biblicalAxis: [], worldAxis: [] })}
      />,
      'dark',
    );

    expect(view.byTestId('history-timeline')).toBeNull();
    expect(view.byTestId('history-empty')?.textContent).toContain(
      'No contemporary rulers or narrated events are sourced for AD 47',
    );
    view.unmount();
  });

  it('warns when a date was written by a model rather than sourced', () => {
    const view = renderSheet(
      <HistorySheet badge={withPayload({ ...HISTORY_BADGE.payload, datingOrigin: 'generated' })} />,
      'dark',
    );

    expect(view.byTestId('history-origin-note')?.textContent).toContain('language model');
    view.unmount();
  });
});
