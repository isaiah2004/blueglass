/**
 * Tests for the timeline's alignment.
 *
 * What is worth asserting here
 *   Alignment is invisible when it is wrong. A ruler drawn beside the wrong event still
 *   looks like a timeline, so the merge is pinned directly: same year, same row; different
 *   year, different row; earliest first. The year parser gets its own attention because it
 *   is the only thing placing the "you are here" marker, and a span label like
 *   `AD 41 to AD 54` must not be mistaken for a single year.
 */

import { describe, expect, it } from 'vitest';

import type { HistorySheetPayload, TimelineEvent } from '../model/textual-payloads';
import {
  buildTimelineRows,
  hasPassageMarker,
  hasTimeline,
  nodeDetail,
  parseYearLabel,
  passageSortYear,
} from './timeline-rows';

/**
 * One axis node.
 *
 * @param id - Its id.
 * @param sortYear - The year it sorts at.
 * @param label - What it says.
 * @returns The node. Side effects: none.
 */
function node(id: string, sortYear: number, label: string): TimelineEvent {
  return { id, label, yearLabel: `AD ${String(sortYear)}`, sortYear };
}

/**
 * A `[History]` payload with the shape the API returns for Acts 16:6-10.
 *
 * @param overrides - Fields to replace.
 * @returns The payload. Side effects: none.
 */
function payload(overrides: Partial<HistorySheetPayload> = {}): HistorySheetPayload {
  return {
    passageYearLabel: 'AD 47',
    biblicalAxis: [node('event-2811', 47, 'Call to Macedonia')],
    worldAxis: [
      {
        id: 'ruler-348',
        label: 'Claudius, Emperor of Roman Empire',
        yearLabel: 'AD 41 to AD 54',
        sortYear: 41,
      },
      {
        id: 'ruler-379',
        label: 'Tiberius Julius Alexander, Procurator of Judaea',
        yearLabel: 'AD 46 to AD 48',
        sortYear: 46,
      },
    ],
    rationale: 'Dated from the Theographic event Mission to Phrygia, Galatia and Asia (AD 47).',
    datingOrigin: 'sourced',
    ...overrides,
  };
}

describe('parseYearLabel', () => {
  it.each([
    ['AD 47', 47],
    ['47 AD', 47],
    ['c. AD 33', 33],
    ['33 BC', -33],
    ['BC 586', -586],
  ])('reads %s as %i', (label, expected) => {
    expect(parseYearLabel(label)).toBe(expected);
  });

  it('refuses a reign span, which is not a single year', () => {
    expect(parseYearLabel('AD 41 to AD 54')).toBeUndefined();
  });

  it('refuses a label it does not recognise rather than guessing', () => {
    expect(parseYearLabel('mid-1st century')).toBeUndefined();
    expect(parseYearLabel('unrecorded')).toBeUndefined();
  });
});

describe('passageSortYear', () => {
  it('reads the passage year out of its own label', () => {
    expect(passageSortYear(payload())).toBe(47);
  });

  it('is undefined when the label is not a single year', () => {
    expect(passageSortYear(payload({ passageYearLabel: 'mid-1st century' }))).toBeUndefined();
  });
});

describe('buildTimelineRows', () => {
  it('gives one row per year either axis mentions, earliest first', () => {
    expect(buildTimelineRows(payload()).map((row) => row.sortYear)).toEqual([41, 46, 47]);
  });

  it('puts a ruler and an event of the same year on one row', () => {
    const rows = buildTimelineRows(
      payload({ worldAxis: [node('ruler-1', 47, 'Claudius, Emperor of Roman Empire')] }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.world).toHaveLength(1);
    expect(rows[0]?.biblical).toHaveLength(1);
  });

  it('marks only the row the passage is dated to', () => {
    const marked = buildTimelineRows(payload()).filter((row) => row.isPassageYear);

    expect(marked.map((row) => row.sortYear)).toEqual([47]);
  });

  it('marks nothing when the passage year cannot be parsed', () => {
    const rows = buildTimelineRows(payload({ passageYearLabel: 'mid-1st century' }));

    expect(hasPassageMarker(rows)).toBe(false);
  });

  it('keeps every node of a year that has several', () => {
    const rows = buildTimelineRows(
      payload({
        biblicalAxis: [node('a', 47, 'Timothy joins Paul'), node('b', 47, 'Call to Macedonia')],
        worldAxis: [],
      }),
    );

    expect(rows[0]?.biblical.map((event) => event.id)).toEqual(['a', 'b']);
  });

  it('is empty when neither axis carries anything', () => {
    expect(buildTimelineRows(payload({ biblicalAxis: [], worldAxis: [] }))).toEqual([]);
  });
});

describe('hasTimeline', () => {
  it('is false only when both axes are empty', () => {
    expect(hasTimeline(payload())).toBe(true);
    expect(hasTimeline(payload({ worldAxis: [] }))).toBe(true);
    expect(hasTimeline(payload({ biblicalAxis: [], worldAxis: [] }))).toBe(false);
  });
});

describe('nodeDetail', () => {
  it('drops a detail the label already contains', () => {
    expect(
      nodeDetail({
        id: 'ruler-348',
        label: 'Claudius, Emperor of Roman Empire',
        yearLabel: 'AD 41 to AD 54',
        sortYear: 41,
        detail: 'Roman Empire',
      }),
    ).toBeUndefined();
  });

  it('keeps a detail that adds something', () => {
    expect(
      nodeDetail({
        id: 'event-2811',
        label: 'Call to Macedonia',
        yearLabel: 'AD 47',
        sortYear: 47,
        detail: 'Second Missionary Journey',
      }),
    ).toBe('Second Missionary Journey');
  });

  it('treats a blank detail as none', () => {
    expect(
      nodeDetail({ id: 'x', label: 'A', yearLabel: 'AD 1', sortYear: 1, detail: '  ' }),
    ).toBeUndefined();
  });
});
