/**
 * Tests for verse selection and highlighting.
 *
 * The tri-state is the point: `both` must survive every ordering of the two toggles, and
 * neither toggle may ever mutate the state handed to it.
 */

import { describe, expect, it } from 'vitest';

import {
  clearSelectedVerse,
  EMPTY_SELECTION,
  isActiveTone,
  toggleHighlightedVerse,
  toggleSelectedVerse,
  verseTone,
  withHighlightedVerses,
} from './verse-selection';

describe('selection', () => {
  it('opens a verse and closes it on a second tap', () => {
    const opened = toggleSelectedVerse(EMPTY_SELECTION, 5);
    expect(opened.selected).toBe(5);
    expect(toggleSelectedVerse(opened, 5).selected).toBeNull();
  });

  it('moves the open verse rather than opening two', () => {
    const first = toggleSelectedVerse(EMPTY_SELECTION, 5);
    expect(toggleSelectedVerse(first, 9).selected).toBe(9);
  });

  it('returns the same object when clearing an already-closed chapter', () => {
    expect(clearSelectedVerse(EMPTY_SELECTION)).toBe(EMPTY_SELECTION);
  });

  it('clears the open verse but keeps highlights', () => {
    const state = clearSelectedVerse(
      toggleSelectedVerse(toggleHighlightedVerse(EMPTY_SELECTION, 5), 5),
    );
    expect(state.selected).toBeNull();
    expect(state.highlighted.has(5)).toBe(true);
  });
});

describe('highlighting', () => {
  it('adds then removes', () => {
    const on = toggleHighlightedVerse(EMPTY_SELECTION, 3);
    expect(on.highlighted.has(3)).toBe(true);
    expect(toggleHighlightedVerse(on, 3).highlighted.has(3)).toBe(false);
  });

  it('never mutates the state it was given', () => {
    const before = toggleHighlightedVerse(EMPTY_SELECTION, 3);
    toggleHighlightedVerse(before, 4);
    expect([...before.highlighted]).toEqual([3]);
  });

  it('replaces the whole set on a server load, keeping the open verse', () => {
    const state = withHighlightedVerses(toggleSelectedVerse(EMPTY_SELECTION, 2), [7, 8]);
    expect([...state.highlighted]).toEqual([7, 8]);
    expect(state.selected).toBe(2);
  });
});

describe('verseTone', () => {
  it('reports rest for an untouched verse', () => {
    expect(verseTone(EMPTY_SELECTION, 1)).toBe('rest');
  });

  it('reports selected, highlighted, and both', () => {
    const selected = toggleSelectedVerse(EMPTY_SELECTION, 1);
    expect(verseTone(selected, 1)).toBe('selected');

    const highlighted = toggleHighlightedVerse(EMPTY_SELECTION, 1);
    expect(verseTone(highlighted, 1)).toBe('highlighted');

    expect(verseTone(toggleHighlightedVerse(selected, 1), 1)).toBe('both');
  });

  it('reaches both from either direction', () => {
    const selectThenHighlight = toggleHighlightedVerse(toggleSelectedVerse(EMPTY_SELECTION, 4), 4);
    const highlightThenSelect = toggleSelectedVerse(toggleHighlightedVerse(EMPTY_SELECTION, 4), 4);
    expect(verseTone(selectThenHighlight, 4)).toBe('both');
    expect(verseTone(highlightThenSelect, 4)).toBe('both');
  });

  it('does not leak a tone onto a neighbouring verse', () => {
    const state = toggleHighlightedVerse(toggleSelectedVerse(EMPTY_SELECTION, 4), 4);
    expect(verseTone(state, 3)).toBe('rest');
    expect(verseTone(state, 5)).toBe('rest');
  });

  it('calls every tone but rest active', () => {
    expect(isActiveTone('rest')).toBe(false);
    for (const tone of ['selected', 'highlighted', 'both'] as const) {
      expect(isActiveTone(tone)).toBe(true);
    }
  });
});
