/**
 * InlineBadgeSvg — strategy C of the inline-badge spike. NOT RECOMMENDED as the default.
 *
 * Purpose
 *   Draws the pill's shape with `react-native-svg` instead of with React Native's own border
 *   renderer, to find out whether the shape survives on a platform where a 1 px translucent
 *   border over a translucent fill can seam or alias at the corners.
 *
 * What it changes and what it does not
 *   The SHAPE moves to a `<Rect rx>` painted on the SVG canvas. The FLOW does not: an `<Svg>`
 *   is a view, so this is still the inline-attachment mechanism `InlineBadge` uses, with the
 *   same baseline arithmetic. Anything that breaks inline views breaks this too — it is a
 *   fallback for corner quality, never for layout.
 *
 * The cost
 *   SVG has no intrinsic layout, so the rectangle cannot be drawn until the label has been
 *   measured. That is one `onLayout` round trip and one extra render per badge, on a screen
 *   that may hold thirty of them. `InlineBadge` needs neither.
 *
 * Dependencies
 *   `react-native-svg` (already a dependency of `@atlas/mobile`), `@/theme`,
 *   `./InlineBadge.geometry`, `./InlineBadge.types`.
 */

import { useState, type JSX } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { borderWidth, colors, fontFamily, type BadgeKind } from '@/theme';

import { badgeBaselineOffset, badgeGeometry } from './InlineBadge.geometry';
import { splitBadgeMark, type InlineBadgeProps } from './InlineBadge.types';

/** Width before the first measurement lands. Zero, so nothing flashes at the wrong size. */
const UNMEASURED = 0;

/** What {@link PillBackground} needs to draw one pill. */
interface PillBackgroundProps {
  /** Measured pill width. `UNMEASURED` until the first layout pass lands. */
  readonly width: number;
  /** Pill height, from `badgeGeometry`. */
  readonly height: number;
  /** Corner radius, from `badgeGeometry`. */
  readonly radius: number;
  /** Surface, border, and tint for this badge kind. */
  readonly palette: (typeof colors.badge)[BadgeKind];
}

/**
 * Draw the pill itself.
 *
 * Extracted so the badge component stays inside rule 5.4.3's 50-line limit, and so the
 * "nothing to draw until we have been measured" rule lives in one place.
 *
 * @param props See {@link PillBackgroundProps}.
 * @returns The rounded rectangle, or `null` before the first measurement.
 */
function PillBackground({
  width,
  height,
  radius,
  palette,
}: PillBackgroundProps): JSX.Element | null {
  if (width <= UNMEASURED) return null;

  // The stroke straddles the path, so insetting by half its width keeps the whole border
  // inside the measured box instead of bleeding half a hairline past it.
  const inset = borderWidth.hairline / 2;

  return (
    <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
      <Rect
        x={inset}
        y={inset}
        width={Math.max(UNMEASURED, width - borderWidth.hairline)}
        height={Math.max(UNMEASURED, height - borderWidth.hairline)}
        rx={radius}
        fill={palette.surface}
        stroke={palette.border}
        strokeWidth={borderWidth.hairline}
      />
    </Svg>
  );
}

/**
 * Render one badge whose pill is an SVG rounded rectangle.
 *
 * @param props - See `InlineBadgeProps`. `onPress` is not supported here: adding a
 *   `Pressable` would change the view tree being measured, which is the thing under test.
 * @returns An inline view holding an absolutely-filled SVG behind the label.
 *
 * Side effects: sets state once per badge, on first layout.
 */
export function InlineBadgeSvg({
  kind,
  label,
  scriptureStep = 'md',
  testID,
}: InlineBadgeProps): JSX.Element {
  const palette = colors.badge[kind];
  const geometry = badgeGeometry(scriptureStep);
  const mark = splitBadgeMark(kind, label);
  const [measuredWidth, setMeasuredWidth] = useState(UNMEASURED);

  const onLayout = (event: LayoutChangeEvent): void => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  };

  const labelStyle = {
    color: palette.tint,
    fontSize: geometry.labelFontSize,
    lineHeight: geometry.labelLineHeight,
  };
  const boxStyle = {
    height: geometry.height,
    paddingHorizontal: geometry.paddingHorizontal,
    transform: [{ translateY: badgeBaselineOffset('textAttachment', 'web', scriptureStep) }],
  };

  return (
    <View testID={testID} onLayout={onLayout} style={[styles.pill, boxStyle]}>
      <PillBackground
        width={measuredWidth}
        height={geometry.height}
        radius={geometry.borderRadius}
        palette={palette}
      />
      <Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {mark.lead}
        {mark.word}
        {mark.tail}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    fontFamily: fontFamily.ui.semiBold,
    fontWeight: '600',
  },
});
