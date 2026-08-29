/**
 * Turning a chapter's badges into the two shapes the canvas renders.
 *
 * Purpose
 *   The server answers with one flat, ordered list. The reading canvas needs it twice over:
 *   as anchors indexed by verse, so `VerseText` can splice pills into the right sentence, and
 *   as an ordered list for the chapter-end summary (`design-language.md` §5, `image9.png`).
 *   Doing both here, purely, means the density rule that protects the reading rhythm is a
 *   tested function rather than a conditional buried in a component.
 *
 * The per-verse cap, applied twice on purpose
 *   The server already caps at two badges per verse (`domain/selection.py`). This module
 *   applies the same ceiling again on the way in. That is not distrust of the server; it is
 *   the recognition that pillar 1 is a *client* property. A ~25-word verse is two lines on a
 *   phone, and a third pill turns the middle of a sentence into a toolbar. If the server's
 *   rule ever loosens, the reading canvas must not loosen with it.
 *
 * Nothing is dropped from the summary
 *   The cap governs what appears *inline*. Every badge the chapter delivered appears in the
 *   summary list at the bottom, which is exactly what that list is for: the reader who does
 *   not want to tap mid-verse still gets everything.
 *
 * Dependencies
 *   This folder's models and the reader's anchor type. No React, no I/O.
 */

import type { VerseBadgeAnchor } from '../model/verse-badges';

import { themeBadgeKind } from './badge-kinds';
import type { ReaderBadge } from './badge-models';

/**
 * Inline badges allowed on one verse.
 *
 * Two, matching the server's own ceiling. Stated as a named constant because it is a product
 * judgement about reading rhythm, not an implementation detail.
 */
export const MAX_INLINE_BADGES_PER_VERSE = 2;

/** Badge anchors for one chapter, keyed by packed `verseKey`. A missing key means none. */
export type VerseBadgeMap = ReadonlyMap<number, readonly VerseBadgeAnchor[]>;

/** A chapter with no enrichment. The shared empty answer, so no caller allocates one. */
export const NO_VERSE_BADGES: VerseBadgeMap = new Map();

/**
 * One badge as the verse segmenter wants it.
 *
 * @param badge - The badge to place.
 * @returns The anchor. Side effects: none.
 */
function toAnchor(badge: ReaderBadge): VerseBadgeAnchor {
  return {
    kind: themeBadgeKind(badge.kind),
    word: badge.anchor.text,
    startOffset: badge.anchor.startOffset,
    badgeId: badge.id,
  };
}

/**
 * Index a chapter's badges by verse, capped.
 *
 * Order within a verse is the server's, which is `P-04`'s listing order — the badges anchored
 * to a proper noun ahead of the ones annotating a whole verse. Taking the first N therefore
 * keeps the most specific pills rather than an arbitrary pair.
 *
 * @param badges - Every badge the chapter delivered, in the server's order.
 * @param maxPerVerse - Ceiling per verse. Defaults to {@link MAX_INLINE_BADGES_PER_VERSE}.
 * @returns Anchors by `verseKey`. Empty when there are none. Side effects: none.
 */
export function anchorsByVerseKey(
  badges: readonly ReaderBadge[],
  maxPerVerse: number = MAX_INLINE_BADGES_PER_VERSE,
): VerseBadgeMap {
  if (badges.length === 0) {
    return NO_VERSE_BADGES;
  }

  const byVerse = new Map<number, VerseBadgeAnchor[]>();
  for (const badge of badges) {
    const existing = byVerse.get(badge.anchor.verse.value);
    if (existing === undefined) {
      byVerse.set(badge.anchor.verse.value, [toAnchor(badge)]);
      continue;
    }
    if (existing.length < maxPerVerse) {
      existing.push(toAnchor(badge));
    }
  }
  return byVerse;
}

/**
 * Index a chapter's badges by id, so a tapped pill can find its own record.
 *
 * @param badges - Every badge the chapter delivered.
 * @returns A lookup from badge id to badge. Side effects: none.
 */
export function badgesById(badges: readonly ReaderBadge[]): ReadonlyMap<string, ReaderBadge> {
  return new Map(badges.map((badge) => [badge.id, badge]));
}

/**
 * How many badges this chapter shows inline, after the cap.
 *
 * Exists so the summary list can say something true about the difference between what the
 * chapter carries and what the reader saw in the text, rather than the component counting
 * map entries itself.
 *
 * @param anchors - The indexed anchors.
 * @returns The total number of pills that will be rendered. Side effects: none.
 */
export function inlineBadgeCount(anchors: VerseBadgeMap): number {
  let total = 0;
  for (const list of anchors.values()) {
    total += list.length;
  }
  return total;
}
