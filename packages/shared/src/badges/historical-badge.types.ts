/**
 * Payloads for the three background badges: History, Cultural, and Context.
 *
 * Purpose
 *   These three answer "what was going on around this verse?" from different angles —
 *   the History sheet with a dual-axis timeline (`docs/product/prd.md` "Tab 2": biblical
 *   events on top, parallel Roman and world history below), the Cultural sheet with an
 *   ancient custom explained, and the Studio Context sheet with a dual-host audio
 *   overview and a grounded chat box.
 *
 * Key responsibilities
 *   - Type the two axes of the timeline as the same event shape, so the graph component
 *     renders one function twice instead of two near-duplicates.
 *   - Carry the grounding-confidence signal on the one badge whose content is generated.
 *
 * Dependencies
 *   `../citation`, `./badge-envelope.types`. Pure types.
 *
 * Dating convention
 *   Years are strings, not numbers: the sources give `50 AD`, `c. 33 AD`, and
 *   `mid-1st century`, and forcing those into an integer would fabricate a precision the
 *   evidence does not have. Sorting is the pipeline's job, via `sortYear`.
 */

import type { GroundingConfidence } from '../citation';
import type { InlineBadgeBase } from './badge-envelope.types';

/** One dated event on either axis of the timeline. */
export interface TimelineEvent {
  /** Stable identifier within the badge. */
  readonly id: string;
  /** What happened, in a few words. */
  readonly label: string;
  /** The date as the sources express it, e.g. `50 AD`, `c. 33 AD`. */
  readonly yearLabel: string;
  /**
   * Signed year for ordering only — negative for BC. Never rendered; `yearLabel` is what
   * the reader sees, because this number hides the uncertainty that label carries.
   */
  readonly sortYear: number;
  /** One sentence of detail, shown when the node is tapped. */
  readonly detail?: string;
}

/**
 * Sheet content for `[⏳ History]` — the dual-axis timeline.
 *
 * EXTENDED FOR M2 with the honesty fields the real data forced.
 *   `rationale` and `confidence` exist because a passage's date is inherited from an
 *   event that narrates only PART of it ("...which narrates about 60% of this passage"),
 *   and a reader entitled to the date is entitled to that caveat.
 *   `datingOrigin` distinguishes "a dataset says" from "a model wrote this"; every row
 *   M2 ships is `sourced`.
 *   `passageTitle`, `interpretiveClaim` and `attributedTo` travel together or not at
 *   all: the title is Hajime Murai's division of the text, and decision `Q-015` requires
 *   it to render as "Murai's reading" and never as settled fact.
 */
export interface HistoryBadgePayload {
  /** The date of the passage itself, as the sources express it. */
  readonly passageYearLabel: string;
  /** Events from scripture's own narrative. The upper axis. */
  readonly biblicalAxis: readonly TimelineEvent[];
  /** Contemporary Roman and world events. The lower axis. */
  readonly worldAxis: readonly TimelineEvent[];
  /** Why this passage carries this date. Shown, not hidden. */
  readonly rationale: string;
  /** `sourced`, `generated`, or `authored`. M2 emits only `sourced`. */
  readonly datingOrigin: 'sourced' | 'generated' | 'authored';
  /** How much of the passage the dating event actually narrates, 0–1. */
  readonly confidence?: number;
  /** Who was on the throne, when a source names them, e.g. `Claudius`. */
  readonly rulerName?: string;
  /** The pericope heading. One scholar's reading — render it with `attributedTo`. */
  readonly passageTitle?: string;
  /** How to label that reading, e.g. `Murai's reading` (`Q-015`). */
  readonly interpretiveClaim?: string;
  /** The scholar the reading belongs to, e.g. `Hajime Murai`. */
  readonly attributedTo?: string;
}

/** Which cultural world a custom belongs to. */
export type CulturalWorld = 'ancient-near-east' | 'second-temple-judaism' | 'greco-roman';

/** Sheet content for `[⚖️ Cultural]` — an ancient custom explained. */
export interface CulturalBadgePayload {
  /** The custom, law, or practice being explained, e.g. `Purple cloth trade`. */
  readonly custom: string;
  /** Which world it belongs to. Drives the sheet's framing, not just a label. */
  readonly world: CulturalWorld;
  /** The explanation itself, one to three paragraphs. */
  readonly explanation: string;
  /**
   * An optional present-day comparison. Kept separate from `explanation` so the sheet
   * can mark it as interpretation rather than evidence.
   */
  readonly modernParallel?: string;
}

/** A pre-rendered audio overview, served from the CDN rather than generated live. */
export interface AudioOverview {
  /** Where the pre-rendered file lives. Fetched by the player, never by this layer. */
  readonly audioUrl: string;
  /** Length in seconds, for the scrubber and the 5-minute habit-loop budget. */
  readonly durationSeconds: number;
  /** The two synthetic host voices, in speaking order. */
  readonly hostNames: readonly string[];
  /** Time-aligned transcript cues, for the synchronised glowing lyrics. */
  readonly transcriptUrl?: string;
}

/** Sheet content for `[🎙️ Context]` — the Studio sheet's grounded background. */
export interface ContextBadgePayload {
  /** The background a reader needs before this verse makes sense. */
  readonly summary: string;
  /** The dual-host podcast overview, when one has been rendered for this passage. */
  readonly audioOverview?: AudioOverview;
  /**
   * How well grounded `summary` is. The sheet renders this as the Grounding Confidence
   * meter and must say so out loud when it is `low` (`design-language.md` §8.3).
   */
  readonly groundingConfidence: GroundingConfidence;
  /** Questions to seed the grounded chat box with, so the reader is not facing a blank. */
  readonly suggestedQuestions: readonly string[];
}

/** The `[⏳ History]` badge, ready to render. */
export type HistoryBadge = InlineBadgeBase<'history', HistoryBadgePayload>;

/** The `[⚖️ Cultural]` badge, ready to render. */
export type CulturalBadge = InlineBadgeBase<'cultural', CulturalBadgePayload>;

/** The `[🎙️ Context]` badge, ready to render. */
export type ContextBadge = InlineBadgeBase<'context', ContextBadgePayload>;
