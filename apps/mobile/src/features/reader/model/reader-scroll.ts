/**
 * Scroll arithmetic for the reading canvas.
 *
 * Purpose
 *   Two behaviours from `flutter-port-map.md` §7.2, both of which a naive rewrite loses:
 *
 *   1. **Conditional auto-pin.** Content that grows scrolls itself into view *only if the
 *      reader was already near the bottom*. A reader who scrolled up to re-read is never
 *      yanked. The prototype used 220 px in the Ask view and 160 px in the reader chat;
 *      both thresholds are named here rather than typed at a call site.
 *   2. **Scroll-to-verse at 18 % of the viewport.** Focusing a verse lands it a fifth of
 *      the way down the screen, not jammed against the top edge, so the reader keeps the
 *      lines above it as context.
 *
 * What this module deliberately does not do
 *   `smooth_scroll.dart` is the port map's negative lesson: the prototype built custom
 *   wheel easing, shipped it, and removed it because it fought trackpads. No scroll
 *   physics is implemented or imported anywhere in this feature.
 *
 * Dependencies
 *   None. Pure arithmetic, unit-testable without a renderer.
 */

/** Distance from the bottom, in dp, within which the reader counts as "still at the bottom". */
export const AUTO_PIN_THRESHOLD_PX = {
  /** 160 — the reader-side threshold (`reader_chat.dart:46`). Tighter: verses are short. */
  reader: 160,
  /** 220 — the conversation threshold (`ask_view.dart:159`). Looser: answers are long. */
  conversation: 220,
} as const;

/** Which threshold a surface uses. */
export type AutoPinSurface = keyof typeof AUTO_PIN_THRESHOLD_PX;

/**
 * Where a scroll view is, in the shape React Native's `onScroll` reports it.
 *
 * Named locally rather than imported from `react-native` so this module stays free of
 * framework imports and runs under a plain Node test.
 */
export interface ScrollMetrics {
  /** Current vertical offset, in dp. */
  readonly offsetY: number;
  /** Total scrollable content height, in dp. */
  readonly contentHeight: number;
  /** Visible height of the scroll view, in dp. */
  readonly viewportHeight: number;
}

/**
 * How far the reader is from the end of the content.
 *
 * @param metrics - The latest scroll position.
 * @returns Distance in dp, clamped at 0 so an over-scroll bounce cannot report a negative.
 *   Side effects: none.
 */
export function distanceFromBottom(metrics: ScrollMetrics): number {
  const remaining = metrics.contentHeight - metrics.viewportHeight - metrics.offsetY;
  return Math.max(0, remaining);
}

/**
 * Whether newly arrived content may scroll itself into view.
 *
 * @param metrics - The latest scroll position.
 * @param surface - Which threshold applies. Defaults to the reader's 160 px.
 * @returns True only when the reader is already near the bottom. Side effects: none.
 */
export function shouldAutoPin(metrics: ScrollMetrics, surface: AutoPinSurface = 'reader'): boolean {
  return distanceFromBottom(metrics) <= AUTO_PIN_THRESHOLD_PX[surface];
}

/**
 * Where a focused verse sits vertically once scrolled to.
 *
 * 0.18 is the prototype's `Scrollable.ensureVisible(alignment: 0.18)`
 * (`screens/reader_screen.dart:119-138`).
 */
export const VERSE_FOCUS_VIEWPORT_POSITION = 0.18;

/**
 * The scroll offset that puts a verse 18 % down the viewport.
 *
 * @param verseTop - The verse's top edge, in dp from the top of the content.
 * @param metrics - The scroll view's geometry.
 * @returns An offset clamped to the scrollable range, so the first and last verses do not
 *   ask for an offset the view cannot honour. Side effects: none.
 */
export function offsetToFocusVerse(verseTop: number, metrics: ScrollMetrics): number {
  const desired = verseTop - metrics.viewportHeight * VERSE_FOCUS_VIEWPORT_POSITION;
  const maximum = Math.max(0, metrics.contentHeight - metrics.viewportHeight);
  return Math.min(Math.max(0, desired), maximum);
}
