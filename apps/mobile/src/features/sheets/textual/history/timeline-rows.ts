/**
 * Aligning the two axes of the History timeline by year.
 *
 * Purpose
 *   `docs/product/mockups/image5.png` sets Rome down one side, Judea down the other, and a
 *   year spine between them, so a reader can see at a glance who was on the throne while a
 *   passage was happening. That alignment is arithmetic over two lists, and it is the one
 *   part of the sheet that can be quietly wrong — an axis sorted independently of the other
 *   looks perfectly plausible and says something false.
 *
 * Key responsibilities
 *   - Merge the two axes into rows keyed by year, so a ruler and an event in the same year
 *     land on the same line.
 *   - Mark the row the reader's passage sits in, so "you are here" is a fact about the data
 *     rather than a decoration.
 *
 * `sortYear` is used and never printed
 *   The wire says so explicitly (`TimelineEventOut.sort_year`: *"Ordering only. Never
 *   render this."*), and the reason is that the number hides the uncertainty its label
 *   carries — an event the sources date "c. 33 AD" sorts at 33 and must not print as
 *   "AD 33". So this module groups on `sortYear` and every string a row shows comes from
 *   `yearLabel`.
 *
 * Why the passage's year is parsed rather than sent
 *   `HistoryPayloadOut` carries `passage_year_label` ("AD 47") but no numeric year. Parsing
 *   the label is the only way to place the marker, so the parser is conservative: anything
 *   it does not recognise yields no marker at all, and the timeline renders without one
 *   rather than putting the reader in the wrong decade.
 *
 * Dependencies
 *   The folder's payload types. Pure — no React, no I/O, Node-testable.
 */

import type { HistorySheetPayload, TimelineEvent } from '../model/textual-payloads';

/** One line of the timeline: everything both axes place in the same year. */
export interface TimelineRow {
  /** Stable React key. */
  readonly key: string;
  /** The year the row groups on. Ordering only — never rendered. */
  readonly sortYear: number;
  /** Rulers and world events in this year. */
  readonly world: readonly TimelineEvent[];
  /** Scripture's own events in this year. */
  readonly biblical: readonly TimelineEvent[];
  /** True on the row the reader's passage is dated to. */
  readonly isPassageYear: boolean;
}

/** `AD 47`, `47 AD`, `c. AD 47`, `47 BC`, `BC 47` — the forms the sources use. */
const YEAR_LABEL = /^(?:c\.\s*)?(?:(AD|BC)\s*(\d{1,4})|(\d{1,4})\s*(AD|BC))$/i;

/**
 * Read a year out of a source's own date label.
 *
 * @param label - The label as the source expresses it, e.g. `AD 47`.
 * @returns The signed year — negative for BC — or `undefined` when the label is not a
 *   single year. `AD 41 to AD 54` deliberately yields `undefined`: it is a span, and
 *   placing a span on one line of the spine would misrepresent it. Side effects: none.
 *
 * @example
 * parseYearLabel('AD 47');  // 47
 * parseYearLabel('47 BC');  // -47
 * parseYearLabel('AD 41 to AD 54'); // undefined
 */
export function parseYearLabel(label: string): number | undefined {
  const match = YEAR_LABEL.exec(label.trim());
  if (match === null) {
    return undefined;
  }
  const era = (match[1] ?? match[4] ?? '').toUpperCase();
  const digits = match[2] ?? match[3];
  if (digits === undefined) {
    return undefined;
  }
  const year = Number(digits);

  return era === 'BC' ? -year : year;
}

/**
 * The year the reader's passage is dated to.
 *
 * @param payload - The `[History]` payload.
 * @returns The signed year, or `undefined` when the label is not a single year.
 *   Side effects: none.
 */
export function passageSortYear(payload: HistorySheetPayload): number | undefined {
  return parseYearLabel(payload.passageYearLabel);
}

/**
 * Collect the years both axes mention, in ascending order.
 *
 * @param payload - The `[History]` payload.
 * @returns Distinct years, earliest first. Side effects: none.
 */
function yearsInPlay(payload: HistorySheetPayload): readonly number[] {
  const years = new Set<number>();
  for (const event of [...payload.worldAxis, ...payload.biblicalAxis]) {
    years.add(event.sortYear);
  }

  return [...years].sort((left, right) => left - right);
}

/**
 * Merge the two axes into aligned rows.
 *
 * @param payload - The `[History]` payload.
 * @returns One row per year either axis mentions, earliest first. Empty when neither axis
 *   carries anything, which the sheet renders as an honest empty state rather than as a
 *   blank spine. Side effects: none.
 */
export function buildTimelineRows(payload: HistorySheetPayload): readonly TimelineRow[] {
  const passageYear = passageSortYear(payload);

  return yearsInPlay(payload).map((year) => ({
    key: `year-${String(year)}`,
    sortYear: year,
    world: payload.worldAxis.filter((event) => event.sortYear === year),
    biblical: payload.biblicalAxis.filter((event) => event.sortYear === year),
    isPassageYear: passageYear !== undefined && passageYear === year,
  }));
}

/**
 * Whether the timeline has anything to draw.
 *
 * @param payload - The `[History]` payload.
 * @returns True when at least one axis carries a node. Side effects: none.
 */
export function hasTimeline(payload: HistorySheetPayload): boolean {
  return payload.worldAxis.length > 0 || payload.biblicalAxis.length > 0;
}

/**
 * Whether the marker for the reader's passage will appear on a row.
 *
 * The sheet uses this to decide whether to print the passage's year as a standalone line
 * instead. A date that is real but off the drawn range must still be shown; silently
 * dropping it would leave the sheet dated to nothing.
 *
 * @param rows - The merged rows.
 * @returns True when one of the rows is the passage's own year. Side effects: none.
 */
export function hasPassageMarker(rows: readonly TimelineRow[]): boolean {
  return rows.some((row) => row.isPassageYear);
}

/**
 * The extra line under a node's label, when it adds anything.
 *
 * The world axis's label is built as "Claudius, Emperor of Roman Empire" and its detail is
 * "Roman Empire" — the realm, already inside the label. Printing both puts the same words
 * on screen twice and makes the node look like a rendering fault. The biblical axis's
 * detail ("Second Missionary Journey") is genuinely new, and is kept.
 *
 * @param event - One axis node.
 * @returns The detail, or `undefined` when it repeats what the label already said.
 *   Side effects: none.
 */
export function nodeDetail(event: TimelineEvent): string | undefined {
  const detail = event.detail?.trim();
  if (detail === undefined || detail === '') {
    return undefined;
  }

  return event.label.includes(detail) ? undefined : detail;
}
