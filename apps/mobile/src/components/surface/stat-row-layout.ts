/**
 * How many statistics fit across one row, and how they are dealt out.
 *
 * Purpose
 *   `StatRow` divides its width equally between its cells. That is right at sheet width and
 *   wrong in the 232 dp context rail, where three `flex: 1` cells left about 60 px each and
 *   the browser's default `overflow-wrap: break-word` broke the captions *inside* a word —
 *   `STRAIGHT LINE` rendered as `STRAIGH` / `T LINE`, and each figure was split from its
 *   unit. A caption may wrap; a word may not be cut in half.
 *
 * The rule
 *   Give every cell at least `minCellWidth`. Fit as many as that allows, never more than
 *   there are and never fewer than one, then deal the statistics into rows of that many. A
 *   strip too narrow for three cells becomes two rows rather than three broken words.
 *
 * Why a pure module
 *   The alternative fix — a web-only CSS override — cannot be tested here, would not apply
 *   on a device, and would hide the real problem, which is that the cells were too narrow
 *   for what they held. This rule is asserted at the three widths `Q-006` names.
 *
 * Dependencies
 *   None. No React.
 */

/**
 * How many cells fit across one row.
 *
 * @param availableWidth - The measured width of the strip, or `null` before the first
 *   layout pass — in which case every statistic is assumed to fit, which is what the strip
 *   rendered before it could measure itself and is correct at every width but the narrowest.
 * @param count - How many statistics there are.
 * @param minCellWidth - The narrowest a cell may be before its caption would break.
 * @returns At least 1, at most `count`. Side effects: none.
 */
export function statColumns(
  availableWidth: number | null,
  count: number,
  minCellWidth: number,
): number {
  if (count <= 0) return 0;
  if (availableWidth === null || minCellWidth <= 0) return count;
  const fits = Math.floor(availableWidth / minCellWidth);
  return Math.max(1, Math.min(count, fits));
}

/**
 * Deal the statistics into rows.
 *
 * @param stats - The statistics, in order.
 * @param columns - How many fit across, from {@link statColumns}.
 * @returns One array per row, each holding at most `columns` items and the last holding
 *   the remainder. An empty input yields no rows rather than one empty row. Side effects:
 *   none.
 */
export function statRows<T>(stats: readonly T[], columns: number): readonly (readonly T[])[] {
  if (stats.length === 0 || columns <= 0) return [];
  const rows: T[][] = [];
  for (let index = 0; index < stats.length; index += columns) {
    rows.push(stats.slice(index, index + columns));
  }
  return rows;
}
