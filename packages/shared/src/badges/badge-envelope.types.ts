/**
 * The envelope every inline badge shares, independent of what its sheet shows.
 *
 * Purpose
 *   A badge is two things at once: a mark positioned inside a specific run of scripture,
 *   and the content of the sheet it opens. This module types the first half — the part
 *   the reader renders and the chapter-end summary list iterates — so the eleven payload
 *   shapes only have to describe their own sheet.
 *
 * Key responsibilities
 *   - Anchor a badge to an exact character range in an exact verse, so it can be placed
 *     inline without disturbing the scripture's line rhythm.
 *   - Require a teaser and citations on every badge, whatever its kind.
 *
 * Dependencies
 *   `../citation`, `../scripture`, `./badge-kind`. Pure types.
 *
 * Design constraint honoured here
 *   `docs/product/design-language.md` §5: the annotated word is tinted in the badge's
 *   hue and the badge sits immediately after it. That needs the character offsets below,
 *   not just the word — the same word can occur twice in one verse.
 */

import type { Citation } from '../citation';
import type { VerseKey } from '../scripture';
import type { BadgeKind } from './badge-kind';

/** Where a badge sits in the text. */
export interface BadgeAnchor {
  /** The verse the badge is inside. */
  readonly verse: VerseKey;
  /** The exact word or phrase the badge annotates, e.g. `Troas`. */
  readonly text: string;
  /** 0-based index of the first character of `text` within the verse's text. */
  readonly startOffset: number;
  /** Index one past the last character of `text` within the verse's text. */
  readonly endOffset: number;
}

/**
 * Everything a badge carries regardless of kind.
 *
 * @typeParam TKind - The discriminator this badge answers to.
 * @typeParam TPayload - The sheet content for that kind.
 */
export interface InlineBadgeBase<TKind extends BadgeKind, TPayload> {
  /** Stable identifier, unique within a chapter. Used as the React key and in analytics. */
  readonly id: string;
  /** The discriminant. Narrow the union on this before touching `payload`. */
  readonly kind: TKind;
  /** Where the mark is placed in the scripture text. */
  readonly anchor: BadgeAnchor;
  /**
   * One line of teaser text for the chapter-end badge summary list
   * (`design-language.md` §5 — how a reader who never taps mid-verse still gets context).
   */
  readonly teaser: string;
  /**
   * Evidence for everything in `payload`. Required and non-empty by contract: pillar 3
   * says an uncited claim is not rendered, so a badge with no citations must not ship.
   */
  readonly citations: readonly Citation[];
  /** The sheet content. Shape is determined entirely by `kind`. */
  readonly payload: TPayload;
}
