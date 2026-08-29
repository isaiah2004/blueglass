/**
 * Verse selection and highlighting — the state half.
 *
 * Purpose
 *   `flutter-port-map.md` §7.3 calls verse selection "the single most carefully built
 *   thing in the app", and the part worth porting is the *tri-state*: a verse can be
 *   selected, highlighted, or both, and "both" is its own appearance rather than one
 *   state winning. This module owns that logic as pure data so the row component can be
 *   a dumb renderer of a tone.
 *
 * Key responsibilities
 *   - Hold which verse is open and which verses the reader has highlighted.
 *   - Answer, for one verse, which of the four tones it is in.
 *   - Keep every transition immutable, so React re-renders on identity as it expects.
 *
 * What lives elsewhere on purpose
 *   Colour is `../styles/verse-state-style`; persistence is the API layer. This file
 *   knows nothing about either, which is why it can be exhaustively tested in Node.
 *
 * Dependencies
 *   None. No React, no React Native, no I/O.
 */

/**
 * How a verse currently reads.
 *
 * `both` exists because the prototype proved that letting selection simply override a
 * highlight loses information the reader put there (`flutter-port-map.md` §7.3).
 */
export type VerseTone = 'rest' | 'selected' | 'highlighted' | 'both';

/**
 * Everything the reader has done to the verses of the open chapter.
 *
 * `selected` is `null` rather than optional so the type stays exact under
 * `exactOptionalPropertyTypes`: "no verse is open" is a value, not an absent key.
 */
export interface VerseSelection {
  /** The one open verse, or `null`. Only one verse is open at a time. */
  readonly selected: number | null;
  /** Every highlighted verse number in the open chapter. */
  readonly highlighted: ReadonlySet<number>;
}

/** A chapter nobody has touched yet. */
export const EMPTY_SELECTION: VerseSelection = Object.freeze({
  selected: null,
  highlighted: Object.freeze(new Set<number>()),
});

/**
 * Opens a verse, or closes it if it is already open.
 *
 * Toggle semantics match the prototype: tapping the open verse closes the panel rather
 * than re-opening it (`state.dart:435-438`).
 *
 * @param selection - Current state.
 * @param verse - The 1-based verse number that was tapped.
 * @returns The next state, or the same object when nothing changed. Side effects: none.
 */
export function toggleSelectedVerse(selection: VerseSelection, verse: number): VerseSelection {
  const next = selection.selected === verse ? null : verse;
  if (next === selection.selected) {
    return selection;
  }
  return { selected: next, highlighted: selection.highlighted };
}

/**
 * Closes whatever verse is open.
 *
 * @param selection - Current state.
 * @returns The same object when no verse is open, so a stray tap costs no render.
 *   Side effects: none.
 */
export function clearSelectedVerse(selection: VerseSelection): VerseSelection {
  if (selection.selected === null) {
    return selection;
  }
  return { selected: null, highlighted: selection.highlighted };
}

/**
 * Adds or removes a highlight.
 *
 * The caller applies this *before* the network write and never rolls it back on failure —
 * `flutter-port-map.md` §7.3, "optimistic highlight". Losing one highlight to a dead
 * backend costs less than a highlight that lags a tap.
 *
 * @param selection - Current state.
 * @param verse - The 1-based verse number to toggle.
 * @returns The next state with a fresh, frozen set. Side effects: none.
 */
export function toggleHighlightedVerse(selection: VerseSelection, verse: number): VerseSelection {
  const highlighted = new Set(selection.highlighted);
  if (!highlighted.delete(verse)) {
    highlighted.add(verse);
  }
  return { selected: selection.selected, highlighted };
}

/**
 * Replaces the highlight set wholesale — what a load from the server does.
 *
 * @param selection - Current state.
 * @param verses - Every highlighted verse number for the open chapter.
 * @returns The next state. Side effects: none.
 */
export function withHighlightedVerses(
  selection: VerseSelection,
  verses: Iterable<number>,
): VerseSelection {
  return { selected: selection.selected, highlighted: new Set(verses) };
}

/**
 * The tone one verse should render in.
 *
 * @param selection - Current state.
 * @param verse - The 1-based verse number.
 * @returns Which of the four appearances applies. Side effects: none.
 */
export function verseTone(selection: VerseSelection, verse: number): VerseTone {
  const isSelected = selection.selected === verse;
  const isHighlighted = selection.highlighted.has(verse);

  if (isSelected && isHighlighted) {
    return 'both';
  }
  if (isSelected) {
    return 'selected';
  }
  return isHighlighted ? 'highlighted' : 'rest';
}

/**
 * Whether a tone is any kind of active state.
 *
 * The verse number gains weight for all three active tones (`flutter-port-map.md` §7.3),
 * and asking this question in one place stops that rule being restated per component.
 *
 * @param tone - The tone to test.
 * @returns True for anything but `rest`. Side effects: none.
 */
export function isActiveTone(tone: VerseTone): boolean {
  return tone !== 'rest';
}
