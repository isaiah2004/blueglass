/**
 * The four colours one verse row wears, per tone and per theme.
 *
 * Purpose
 *   `flutter-port-map.md` §7.3 documents two techniques that make verse selection feel
 *   like a light coming on rather than a layout reflow. Both are implemented here, as pure
 *   functions of a theme, so they are asserted by tests instead of eyeballed.
 *
 *   1. **Constant footprint.** Every verse always reserves its left bar and its padding.
 *      The resting bar is not absent, it is transparent — so selecting a verse changes
 *      four colours and moves nothing. Text never shifts sideways under the reader.
 *
 *   2. **Fade through paper, never through grey.** The transparent state is the *canvas
 *      colour at zero alpha*, never the string `transparent`. `transparent` is transparent
 *      black in every renderer; animating a warm paper fill towards it passes through a
 *      muddy grey on the way. The prototype hit this and fixed it with `Color(0x00FBF9F5)`
 *      (`screens/reader_screen.dart`), and the same fix is why {@link clearOn} exists.
 *
 * Why gold, where the prototype used green and amber
 *   The prototype's palette is not this app's. `design-language.md` §8.2 is explicit that
 *   gold means "you" and cyan means "the system"; both selection and highlighting are the
 *   reader's own acts, so both are gold, and they are told apart by *weight* — a neutral
 *   selection wash versus a gold highlight, with `both` as the strongest gold. Using cyan
 *   for either would say the machine did it.
 *
 * Dependencies
 *   `@/theme` for the theme contract, `./tint` for alpha over a token, and the reader's
 *   tone union. No React, no React Native — the result is a plain colour record.
 */

import type { Color, Theme } from '@/theme';

import type { VerseTone } from '../model/verse-selection';

import { clearOn, tint } from './tint';

/** The colours a verse row paints for one tone. */
export interface VerseToneColors {
  /** Fill behind the whole row. */
  readonly background: Color;
  /** The 2 px bar in the left margin — always present, sometimes invisible. */
  readonly bar: Color;
  /** The verse number in the gutter. */
  readonly number: Color;
  /** The scripture itself. Never changes with tone: legibility is not a state. */
  readonly text: Color;
}

/** Alpha of the neutral wash behind a selected verse. */
const SELECTED_FILL_ALPHA = 0.06;

/** Alpha of the gold wash behind a highlighted verse. */
const HIGHLIGHT_FILL_ALPHA = 0.12;

/** Alpha of the gold wash behind a verse that is both selected and highlighted. */
const BOTH_FILL_ALPHA = 0.2;

/** Alpha of the bar beside a selected verse. */
const SELECTED_BAR_ALPHA = 0.35;

/**
 * Every colour a verse row needs, for one tone under one theme.
 *
 * @param theme - The theme in force.
 * @param tone - Which of the four appearances the verse is in.
 * @returns The row's four colours. Side effects: none.
 */
export function verseToneColors(theme: Theme, tone: VerseTone): VerseToneColors {
  const clear = clearOn(theme.background.canvas);
  const text = theme.ink.primary;

  switch (tone) {
    case 'selected':
      return {
        background: tint(theme.ink.primary, SELECTED_FILL_ALPHA),
        bar: tint(theme.accent.gold, SELECTED_BAR_ALPHA),
        number: theme.accent.gold,
        text,
      };
    case 'highlighted':
      return {
        background: tint(theme.accent.gold, HIGHLIGHT_FILL_ALPHA),
        bar: theme.accent.goldDim,
        number: theme.accent.gold,
        text,
      };
    case 'both':
      return {
        background: tint(theme.accent.gold, BOTH_FILL_ALPHA),
        bar: theme.accent.gold,
        number: theme.accent.gold,
        text,
      };
    case 'rest':
      return { background: clear, bar: clear, number: theme.accent.gold, text };
  }
}
