/**
 * One verse of the reading canvas.
 *
 * Purpose
 *   The most carefully built component in the app, and the one the port map singles out
 *   (`flutter-port-map.md` §7.3). Two techniques are ported here deliberately:
 *
 *   1. **Constant footprint.** The left bar and both gutters are rendered in *every*
 *      state, at the same size, with only their colour changing. Selecting a verse
 *      therefore recolours four things and moves none of them — the text does not shift
 *      sideways, the line breaks do not change, and the row below does not jump. This is
 *      what makes selection read as a light coming on rather than as a reflow.
 *
 *   2. **Fade through paper.** The resting colours are the canvas at zero alpha, never
 *      `'transparent'` — see `styles/verse-state-style.ts`. Every animated endpoint here
 *      comes from that module, so no interpolation can pass through a muddy grey.
 *
 * Motion
 *   Colour transitions run on the UI thread through Reanimated and collapse to an instant
 *   swap under `prefers-reduced-motion` (`design-language.md` §6, via `motionFor`).
 *
 * Dependencies
 *   Reanimated, the reader's theme hook, its tone model and its tone colours, and
 *   `VerseText`. No data fetching, no navigation.
 */

import type { JSX } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type TextStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import {
  borderWidth,
  motionFor,
  scriptureText,
  size,
  spacing,
  type Color,
  type ScriptureStep,
} from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { VerseBadgeAnchor } from '../model/verse-badges';
import type { VerseTone } from '../model/verse-selection';
import { verseToneColors, type VerseToneColors } from '../styles/verse-state-style';

import { VerseText } from './VerseText';

/** What one verse row needs. */
export interface VerseRowProps {
  readonly verseNumber: number;
  readonly text: string;
  readonly tone: VerseTone;
  readonly scriptureStep: ScriptureStep;
  readonly anchors?: readonly VerseBadgeAnchor[];
  /** True when the OS asks for reduced motion; collapses the fade to a swap. */
  readonly reduceMotion: boolean;
  /** Tapping the verse opens or closes it. */
  readonly onPress: (verseNumber: number) => void;
  /** Holding the verse highlights or un-highlights it. */
  readonly onLongPress: (verseNumber: number) => void;
  /** Reports the row's top edge so the canvas can scroll a verse into view. */
  readonly onLayoutTop?: (verseNumber: number, top: number) => void;
}

/**
 * Render one verse.
 *
 * @param props - See {@link VerseRowProps}.
 * @returns A row whose geometry never changes with its state.
 *
 * Side effects: none beyond the callbacks it is given.
 */
export function VerseRow({
  verseNumber,
  text,
  tone,
  scriptureStep,
  anchors,
  reduceMotion,
  onPress,
  onLongPress,
  onLayoutTop,
}: VerseRowProps): JSX.Element {
  const paint = verseToneColors(useTheme(), tone);
  const { rowStyle, barStyle } = useToneFade(paint, reduceMotion);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Verse ${String(verseNumber)}`}
      accessibilityState={{ selected: tone === 'selected' || tone === 'both' }}
      // A verse is a toggle: pressing it opens the verse, pressing it again closes it.
      // `aria-pressed` is the valid ARIA for that on a button, and react-native-web does
      // not derive it from `accessibilityState` — see the same note on `OptionRow`.
      aria-pressed={tone === 'selected' || tone === 'both'}
      testID={`verse-row-${String(verseNumber)}`}
      {...verseHandlers({ verseNumber, onPress, onLongPress, onLayoutTop })}
    >
      <Animated.View style={[styles.row, rowStyle]}>
        {/* Always rendered, sometimes invisible: this is the constant footprint. */}
        <Animated.View testID={`verse-bar-${String(verseNumber)}`} style={[styles.bar, barStyle]} />
        <VerseNumber
          verseNumber={verseNumber}
          scriptureStep={scriptureStep}
          color={paint.number}
          active={tone !== 'rest'}
        />
        <View style={styles.body}>
          <VerseText
            text={text}
            {...(anchors === undefined ? {} : { anchors })}
            scriptureStep={scriptureStep}
            style={{ ...scriptureText(scriptureStep), color: paint.text }}
          />
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The row's three callbacks, bound to its verse number.
 *
 * Extracted so the `Pressable` reads as a description of what it is rather than as three
 * inline closures — and so the binding of a verse number to its handlers happens once.
 *
 * @param props - The verse number and the three callbacks.
 * @returns Props to spread onto the `Pressable`. Side effects: none.
 */
function verseHandlers({
  verseNumber,
  onPress,
  onLongPress,
  onLayoutTop,
}: {
  readonly verseNumber: number;
  readonly onPress: (verseNumber: number) => void;
  readonly onLongPress: (verseNumber: number) => void;
  readonly onLayoutTop: ((verseNumber: number, top: number) => void) | undefined;
}): {
  readonly onPress: () => void;
  readonly onLongPress: () => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
} {
  return {
    onPress: () => {
      onPress(verseNumber);
    },
    onLongPress: () => {
      onLongPress(verseNumber);
    },
    onLayout: (event: LayoutChangeEvent) => {
      onLayoutTop?.(verseNumber, event.nativeEvent.layout.y);
    },
  };
}

/**
 * A Reanimated style handle, as `useAnimatedStyle` returns it. Named rather than written
 * inline because its type is generated by the library and unpleasant to restate.
 */
type ToneStyle = ReturnType<typeof useAnimatedStyle<{ backgroundColor: Color }>>;

/**
 * Cross-fades the row's two painted surfaces between tones.
 *
 * Both endpoints come from `verseToneColors`, which never returns `'transparent'` — that
 * is what stops an interpolation travelling through transparent black and flashing grey
 * (`flutter-port-map.md` §7.3). Under reduced motion the duration collapses and the change
 * becomes an instant swap.
 *
 * @param paint - The tone's colours.
 * @param reduceMotion - The reader's OS preference.
 * @returns Animated styles for the row and its left bar. Side effects: none.
 */
function useToneFade(
  paint: VerseToneColors,
  reduceMotion: boolean,
): { readonly rowStyle: ToneStyle; readonly barStyle: ToneStyle } {
  const duration = motionFor(reduceMotion).duration.medium;
  const rowStyle = useAnimatedStyle(
    () => ({ backgroundColor: withTiming(paint.background, { duration }) }),
    [paint.background, duration],
  );
  const barStyle = useAnimatedStyle(
    () => ({ backgroundColor: withTiming(paint.bar, { duration }) }),
    [paint.bar, duration],
  );
  return { rowStyle, barStyle };
}

/**
 * The verse number in its fixed gutter.
 *
 * Split out so `VerseRow` stays a description of three boxes. The gutter's width never
 * changes with the tone — that is the constant footprint — so only the colour and the
 * weight are props.
 *
 * @param props.verseNumber - The 1-based verse number.
 * @param props.scriptureStep - The reading size the number scales against.
 * @param props.color - The tone's number colour.
 * @param props.active - True for any tone but `rest`; adds the semi-bold weight §7.3 asks
 *   for.
 * @returns The gutter. Side effects: none.
 */
function VerseNumber({
  verseNumber,
  scriptureStep,
  color,
  active,
}: {
  readonly verseNumber: number;
  readonly scriptureStep: ScriptureStep;
  readonly color: string;
  readonly active: boolean;
}): JSX.Element {
  return (
    <View testID={`verse-gutter-${String(verseNumber)}`} style={styles.gutter}>
      <Text
        style={[
          verseNumberStyle(scriptureStep),
          { color },
          active ? styles.numberActive : undefined,
        ]}
      >
        {verseNumber}
      </Text>
    </View>
  );
}

/**
 * The verse number's size as a fraction of the scripture around it.
 *
 * 0.62 lands the number in the 9-11 pt metadata band at every reading size, which is what
 * makes it read as the superscript `design-language.md` §3 asks for rather than as a
 * second column of body text.
 */
const NUMBER_SCALE = 0.62;

/**
 * The verse number's type style at one reading size.
 *
 * It shares the body's line height on purpose: that is what puts the number on the same
 * first baseline as the verse, in the fixed gutter, without a manual nudge.
 *
 * @param step - The reading size in force.
 * @returns A text style for the gutter. Side effects: none.
 */
function verseNumberStyle(step: ScriptureStep): TextStyle {
  const body = scriptureText(step);
  return {
    fontFamily: body.fontFamily,
    fontSize: Math.round(body.fontSize * NUMBER_SCALE),
    lineHeight: body.lineHeight,
    fontVariant: ['tabular-nums'],
  };
}

const styles = StyleSheet.create({
  // The whole row is the control, so the whole row is the tap target. A single-line verse
  // measured 42 dp tall on a desktop, which is under the 44 dp minimum for a control the
  // reader is meant to tap to open its context.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: size.tapTarget,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  bar: {
    width: borderWidth.focus,
    alignSelf: 'stretch',
    borderRadius: borderWidth.focus,
  },
  gutter: {
    width: size.verseNumberGutter,
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
  },
  numberActive: { fontWeight: '600' },
  body: { flex: 1, paddingLeft: spacing.sm },
});
