/**
 * Splicing inline badges into a verse without disturbing its text.
 *
 * Purpose
 *   The signature interaction of Atlas Bible is a badge pill sitting *inside* flowing
 *   scripture, immediately after the word it annotates, with that word tinted in the
 *   badge's hue (`docs/product/design-language.md` §5). The rendering half of that is
 *   solved — `components/InlineBadge.tsx`, architecture decision A-1. The half this
 *   module owns is the text arithmetic: turning one verse plus a list of anchors into an
 *   ordered run of segments the renderer walks.
 *
 * Why it is pure
 *   Anchor matching is exactly where an off-by-one silently corrupts scripture — a
 *   dropped space, a duplicated clause, a badge attached to the wrong occurrence of a
 *   common word. Keeping it framework-free means every one of those cases has a test that
 *   runs in milliseconds without a renderer.
 *
 * M2 note
 *   Anchors are server-delivered enrichment (`Q-007`: the database is never redistributed).
 *   M1 wires no source, so a verse simply renders as one text segment. Nothing about the
 *   contract changes when the source arrives.
 *
 * Dependencies
 *   `@/theme` for the `BadgeKind` union. No React, no React Native, no I/O.
 */

import type { BadgeKind } from '@/theme';

/** One badge to place inside one verse. */
export interface VerseBadgeAnchor {
  /** Which of the badge types this is; decides the hue and the glyph. */
  readonly kind: BadgeKind;
  /** The exact word or phrase in the verse the badge annotates. */
  readonly word: string;
  /**
   * Which occurrence of that word to annotate, 1-based. Defaults to the first.
   * "Jesus" appears four times in some verses, and the badge belongs to one of them.
   */
  readonly occurrence?: number;
  /** Optional pill label. Defaults to the badge kind's own label. */
  readonly label?: string;
}

/** A run of plain scripture. */
export interface VerseTextSegment {
  readonly type: 'text';
  readonly text: string;
}

/** The annotated word itself, tinted in the badge's hue (§5). */
export interface VerseWordSegment {
  readonly type: 'word';
  readonly text: string;
  readonly kind: BadgeKind;
}

/** The pill that follows the annotated word. */
export interface VerseBadgeSegment {
  readonly type: 'badge';
  readonly kind: BadgeKind;
  readonly label: string | undefined;
  /** Stable key for the renderer, unique within one verse. */
  readonly id: string;
}

/** One piece of a segmented verse, in reading order. */
export type VerseSegment = VerseTextSegment | VerseWordSegment | VerseBadgeSegment;

/** A resolved anchor: where in the verse it starts and ends. */
interface AnchorSpan {
  readonly anchor: VerseBadgeAnchor;
  readonly start: number;
  readonly end: number;
}

/**
 * Finds the nth occurrence of a word in a verse.
 *
 * Matching is case-sensitive and literal. Scripture text is fixed, and the anchor is
 * authored against that exact text, so a fuzzy match here would only hide a bad anchor.
 *
 * @param text - The verse text.
 * @param word - The word or phrase to find.
 * @param occurrence - 1-based occurrence to return.
 * @returns The index of the match, or -1 when there is no such occurrence.
 *   Side effects: none.
 */
function indexOfOccurrence(text: string, word: string, occurrence: number): number {
  if (word === '' || occurrence < 1) {
    return -1;
  }
  let index = -1;
  for (let found = 0; found < occurrence; found += 1) {
    index = text.indexOf(word, index + 1);
    if (index === -1) {
      return -1;
    }
  }
  return index;
}

/**
 * Resolves anchors to spans, dropping any that do not match or that overlap an earlier one.
 *
 * Dropping rather than throwing is deliberate: a bad anchor must never stop a verse from
 * rendering. Pillar 1 is that the scripture canvas is pristine, and an enrichment record
 * that has drifted from the text is the enrichment's problem, not the reader's.
 *
 * @param text - The verse text.
 * @param anchors - The anchors to place.
 * @returns Non-overlapping spans in reading order. Side effects: none.
 */
function resolveSpans(text: string, anchors: readonly VerseBadgeAnchor[]): readonly AnchorSpan[] {
  const found: AnchorSpan[] = [];

  for (const anchor of anchors) {
    const start = indexOfOccurrence(text, anchor.word, anchor.occurrence ?? 1);
    if (start === -1) {
      continue;
    }
    found.push({ anchor, start, end: start + anchor.word.length });
  }

  found.sort((left, right) => left.start - right.start);

  const kept: AnchorSpan[] = [];
  let consumedTo = 0;
  for (const span of found) {
    if (span.start >= consumedTo) {
      kept.push(span);
      consumedTo = span.end;
    }
  }
  return kept;
}

/**
 * Splits a verse into the runs a renderer walks.
 *
 * @param text - The verse text, exactly as the API delivered it.
 * @param anchors - Badges to place inside it. An empty list returns the verse unsplit.
 * @returns Segments in reading order. Concatenating every `text` and `word` segment
 *   reproduces the input exactly — the property the tests assert. Side effects: none.
 */
export function segmentVerse(
  text: string,
  anchors: readonly VerseBadgeAnchor[] = [],
): readonly VerseSegment[] {
  const spans = resolveSpans(text, anchors);
  if (spans.length === 0) {
    return [{ type: 'text', text }];
  }

  const segments: VerseSegment[] = [];
  let cursor = 0;

  spans.forEach((span, index) => {
    if (span.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, span.start) });
    }
    segments.push({
      type: 'word',
      text: text.slice(span.start, span.end),
      kind: span.anchor.kind,
    });
    segments.push({
      type: 'badge',
      kind: span.anchor.kind,
      label: span.anchor.label,
      id: `${span.anchor.kind}-${String(index)}-${String(span.start)}`,
    });
    cursor = span.end;
  });

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }
  return segments;
}
