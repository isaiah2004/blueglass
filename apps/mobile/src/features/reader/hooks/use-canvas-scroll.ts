/**
 * The reading canvas's scroll bookkeeping.
 *
 * Purpose
 *   `ChapterCanvas` has to remember where every verse row landed and what the live scroll
 *   metrics are, so `focusVerse` can place a verse 18 % down the viewport. That is three
 *   refs and an imperative handle — behaviour, not markup — and rule 5.4.3 caps a function
 *   at fifty lines. It lives here, and `ChapterCanvas` becomes the arrangement it claims
 *   to be.
 *
 * It never scrolls on its own
 *   `flutter-port-map.md` §7.2: a reader who scrolled up is never yanked. Nothing here runs
 *   except when a parent calls `focusVerse`.
 *
 * Why refs and not state
 *   Every value here changes during a drag and none of them changes what is drawn. Holding
 *   them in state would re-render the whole chapter sixty times a second for no visible
 *   difference — `DECISIONS.md` A-3, the same rule the badge sheets' draw loop follows.
 *
 * Dependencies
 *   React and the reader's own scroll model. No React Native primitives beyond the types.
 */

import { useImperativeHandle, useRef, type ForwardedRef, type RefObject } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';

import { offsetToFocusVerse, type ScrollMetrics } from '../model/reader-scroll';

/** What a parent may ask the canvas to do. */
export interface ChapterCanvasHandle {
  /**
   * Scroll a verse to 18 % of the viewport.
   *
   * @param verseNumber - The verse to bring into view.
   */
  readonly focusVerse: (verseNumber: number) => void;
}

/** What the canvas wires into its `ScrollView`. */
export interface CanvasScroll {
  /** Attach to the `ScrollView`. Named `scrollRef` so the lint rule can see it is a ref. */
  readonly scrollRef: RefObject<ScrollView | null>;
  /**
   * Record the live scroll metrics.
   *
   * @param event - The `ScrollView`'s own scroll event.
   */
  readonly onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /**
   * Record where one verse row landed.
   *
   * @param verseNumber - Which verse.
   * @param top - Its offset within the scroll content.
   */
  readonly recordVerseTop: (verseNumber: number, top: number) => void;
}

/**
 * Wire up scroll tracking and expose `focusVerse` on the forwarded ref.
 *
 * @param ref - The ref the canvas was given, which this hook fills with the handle.
 * @returns See {@link CanvasScroll}. Side effects: mutates three refs; scrolls only when
 *   `focusVerse` is called.
 */
export function useCanvasScroll(ref: ForwardedRef<ChapterCanvasHandle>): CanvasScroll {
  const scrollRef = useRef<ScrollView>(null);
  const verseTops = useRef(new Map<number, number>());
  const metrics = useRef<ScrollMetrics>({ offsetY: 0, contentHeight: 0, viewportHeight: 0 });

  useImperativeHandle(ref, () => ({
    focusVerse: (verseNumber: number) => {
      const top = verseTops.current.get(verseNumber);
      if (top === undefined) return;
      scrollRef.current?.scrollTo({ y: offsetToFocusVerse(top, metrics.current), animated: true });
    },
  }));

  return {
    scrollRef,
    onScroll: (event) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      metrics.current = {
        offsetY: contentOffset.y,
        contentHeight: contentSize.height,
        viewportHeight: layoutMeasurement.height,
      };
    },
    recordVerseTop: (verseNumber, top) => {
      verseTops.current.set(verseNumber, top);
    },
  };
}
