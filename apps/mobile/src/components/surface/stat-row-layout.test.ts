/**
 * Tests for the stat strip's column rule.
 *
 * The widths below are measured, not invented: the context rail is clamped to 232 dp on a
 * 768 dp tablet and the sheet content inside it comes out near 200 dp, which is where three
 * cells stopped fitting and the captions started breaking mid-word.
 */

import { describe, expect, it } from 'vitest';

import { statColumns, statRows } from './stat-row-layout';

/** The minimum a cell may be. Mirrors `size.statCell`. */
const MIN_CELL = 96;

/** Content width inside the 232 dp context rail at tablet width. */
const RAIL_WIDTH = 200;

/** Content width of the phone bottom sheet at 375 dp. */
const PHONE_SHEET_WIDTH = 343;

describe('statColumns', () => {
  it('keeps all three cells on a row when there is room for them', () => {
    expect(statColumns(PHONE_SHEET_WIDTH, 3, MIN_CELL)).toBe(3);
  });

  it('drops the rail to two cells rather than breaking a caption in half', () => {
    expect(statColumns(RAIL_WIDTH, 3, MIN_CELL)).toBe(2);
  });

  it('never returns more cells than there are statistics', () => {
    expect(statColumns(1280, 2, MIN_CELL)).toBe(2);
  });

  it('always returns at least one, however narrow the strip', () => {
    expect(statColumns(10, 3, MIN_CELL)).toBe(1);
    expect(statColumns(0, 3, MIN_CELL)).toBe(1);
  });

  it('assumes everything fits before layout has measured the strip', () => {
    // The first render has no width. Rendering one cell per row and then widening would
    // be a visible reflow on every sheet at every width; assuming the old behaviour and
    // narrowing once is the smaller move.
    expect(statColumns(null, 3, MIN_CELL)).toBe(3);
  });

  it('has no rows to lay out when there are no statistics', () => {
    expect(statColumns(RAIL_WIDTH, 0, MIN_CELL)).toBe(0);
  });
});

describe('statRows', () => {
  it('leaves a strip that fits as a single row', () => {
    expect(statRows(['a', 'b', 'c'], 3)).toEqual([['a', 'b', 'c']]);
  });

  it('wraps the remainder onto a second row, in order', () => {
    expect(statRows(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
  });

  it('gives every statistic its own row when only one fits', () => {
    expect(statRows(['a', 'b'], 1)).toEqual([['a'], ['b']]);
  });

  it('yields no rows at all rather than one empty row', () => {
    expect(statRows([], 3)).toEqual([]);
    expect(statRows(['a'], 0)).toEqual([]);
  });
});
