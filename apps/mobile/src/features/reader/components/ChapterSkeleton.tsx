/**
 * What the canvas shows while a chapter is on its way.
 *
 * Purpose
 *   `flutter-port-map.md` §7.1 records the rule the prototype got right: skeleton first,
 *   then text, with **no layout jump** when the real content lands. The bars below are
 *   therefore laid out on the same grid a verse row uses — the same left bar, the same
 *   verse-number gutter, the same line height — so the page does not reflow at the moment
 *   the scripture arrives.
 *
 * Why the bars have uneven widths
 *   A skeleton of identical full-width bars reads as a table. Varying the last line of
 *   each verse reads as prose, which is what is actually coming.
 *
 * Motion
 *   A single opacity pulse, not a sweeping gradient: `design-language.md` §6 asks for a
 *   quiet 150 ms vocabulary, and under reduced motion the pulse stops entirely rather than
 *   slowing down.
 *
 * Dependencies
 *   Reanimated, the reader's theme hook, and the spacing, size and motion tokens.
 */

import { useEffect, type JSX } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { borderWidth, motionFor, radius, scriptureText, size, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { tint } from '../styles/tint';

/** What the skeleton needs. */
export interface ChapterSkeletonProps {
  /** How many verse placeholders to draw. */
  readonly verseCount?: number;
  readonly reduceMotion: boolean;
}

/** Fraction of the column each placeholder verse's last line fills, cycled. */
const LAST_LINE_WIDTHS = ['82%', '64%', '91%', '73%'] as const;

/** How many full-width lines a placeholder verse gets before its short last line. */
const FULL_LINES_PER_VERSE = 2;

/** Opacity the pulse travels between. */
const PULSE: { readonly min: number; readonly max: number } = { min: 0.35, max: 0.7 };

/** Opacity of a skeleton bar against the canvas. */
const BAR_ALPHA = 0.1;

/**
 * Render the loading canvas.
 *
 * @param props - See {@link ChapterSkeletonProps}.
 * @returns Placeholder verses on the reading grid.
 *
 * Side effects: starts one looping animation while mounted.
 */
export function ChapterSkeleton({
  verseCount = 6,
  reduceMotion,
}: ChapterSkeletonProps): JSX.Element {
  const theme = useTheme();
  const opacity = useSharedValue(PULSE.max);
  const duration = motionFor(reduceMotion).loop.shimmer;

  useEffect(() => {
    if (duration === 0) {
      opacity.value = PULSE.max;
      return;
    }
    opacity.value = withRepeat(withTiming(PULSE.min, { duration: duration / 2 }), -1, true);
  }, [duration, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const barColor = tint(theme.ink.primary, BAR_ALPHA);

  return (
    <Animated.View
      style={[styles.root, pulse]}
      testID="chapter-skeleton"
      accessibilityRole="progressbar"
      accessibilityLabel="Loading passage"
    >
      {/* The chapter title's placeholder. Without it the first verse sits where the
          heading will be, and the whole column jumps down when the text lands — the one
          thing `flutter-port-map.md` §7.1 says a skeleton exists to prevent. */}
      <View style={[styles.heading, { backgroundColor: barColor }]} />

      {Array.from({ length: verseCount }, (_unused, index) => (
        <SkeletonVerse key={index} color={barColor} index={index} />
      ))}
    </Animated.View>
  );
}

/**
 * One placeholder verse, on the same grid a real one uses.
 *
 * @param props.color - The bar colour, derived once by the parent so twenty rows share it.
 * @param props.index - Which verse this is; picks the last line's width so the block reads
 *   as prose rather than as a table.
 * @returns The placeholder. Side effects: none.
 */
function SkeletonVerse({
  color,
  index,
}: {
  readonly color: string;
  readonly index: number;
}): JSX.Element {
  return (
    <View style={styles.verse}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <View style={[styles.gutter, styles.line, { backgroundColor: color }]} />
      <View style={styles.body}>
        {Array.from({ length: FULL_LINES_PER_VERSE }, (_unused, line) => (
          <View key={line} style={[styles.line, styles.fullLine, { backgroundColor: color }]} />
        ))}
        <View
          style={[
            styles.line,
            { backgroundColor: color, width: LAST_LINE_WIDTHS[index % LAST_LINE_WIDTHS.length] },
          ]}
        />
      </View>
    </View>
  );
}

/** Height of one placeholder line: the serif's own line height, so nothing jumps. */
const LINE_HEIGHT = scriptureText('md').lineHeight;

/** Thickness of a placeholder line. */
const LINE_THICKNESS = 10;

const styles = StyleSheet.create({
  root: { paddingTop: spacing.lg, gap: spacing.lg },
  heading: {
    // The serif title's own cap height and its rule below, reserved as one block.
    width: '46%',
    height: scriptureText('title').lineHeight,
    borderRadius: radius.control,
    marginBottom: spacing.md,
  },
  verse: { flexDirection: 'row', alignItems: 'flex-start' },
  bar: { width: borderWidth.focus, alignSelf: 'stretch', borderRadius: borderWidth.focus },
  gutter: { width: size.verseNumberGutter - spacing.sm, marginLeft: spacing.sm },
  body: { flex: 1, paddingLeft: spacing.sm, gap: LINE_HEIGHT - LINE_THICKNESS },
  line: { height: LINE_THICKNESS, borderRadius: radius.pill },
  fullLine: { width: '100%' },
});
