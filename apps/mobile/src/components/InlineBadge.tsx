/**
 * InlineBadge — the recommended inline-badge implementation.
 *
 * Purpose
 *   The signature component of Atlas Bible: a small rounded pill sitting inside flowing
 *   scripture, immediately after the word it annotates (`docs/product/design-language.md` §5).
 *
 * Strategy
 *   A real `<View>` placed as a child of the verse's `<Text>`. React Native treats it as an
 *   inline attachment, so it flows and wraps with the text while remaining a genuine view —
 *   which is what makes `borderRadius`, `borderWidth`, and padding actually render. The
 *   three rejected strategies are `InlineBadgeNestedText`, `InlineBadgeSvg`, and
 *   `InlineBadgeFlowRow`; `docs/architecture/spike-inline-badges.md` records why.
 *
 * Usage
 *   ```tsx
 *   <Text style={scriptureText('md')}>
 *     Setting sail therefore from Troas<InlineBadge kind="route" />, we made a straight...
 *   </Text>
 *   ```
 *   The badge MUST be a child of a `<Text>`. Rendered inside a `<View>` it becomes a block
 *   and breaks the line — {@link InlineBadgeFlowRow} is the variant for that case.
 *
 * Dependencies
 *   `@/theme` for every colour and dimension, `./InlineBadge.geometry` for the arithmetic,
 *   `./InlineBadge.types` for the props and the mark.
 */

import { useMemo, type JSX } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { borderWidth, colors, fontFamily, radius, spacing } from '@/theme';

import {
  badgeBaselineOffset,
  badgeGeometry,
  type BadgeAlignment,
  type BadgePlatform,
} from './InlineBadge.geometry';
import { splitBadgeMark, type InlineBadgeProps } from './InlineBadge.types';

/**
 * `Platform.OS` narrowed to the three baseline behaviours. Anything that is not the web
 * (iOS, Android, and the desktop out-of-tree platforms) uses the native attachment rule.
 *
 * @returns Which baseline rule applies here.
 */
function currentPlatform(): BadgePlatform {
  return Platform.OS === 'web' ? 'web' : 'android';
}

/**
 * Render one inline badge.
 *
 * @param props - See `InlineBadgeProps`.
 * @returns A pill that flows with the surrounding scripture.
 *
 * Side effects: none. `onPress` is the caller's.
 */
export function InlineBadge({
  kind,
  label,
  scriptureStep = 'md',
  alignment = 'textAttachment',
  onPress,
  testID,
}: InlineBadgeProps): JSX.Element {
  const palette = colors.badge[kind];
  const mark = splitBadgeMark(kind, label);
  const style = useMemo(() => badgeStyle(scriptureStep, alignment), [scriptureStep, alignment]);

  // The nudge belongs on the OUTERMOST node. A transform moves paint, not layout, so if it
  // sat on the inner pill while a `Pressable` wrapped it, the touch target would stay at the
  // uncorrected height and miss the pill it is supposed to be. Measured on the web build:
  // 3.62 pt of offset between the visible pill and its hit box.
  const body = (
    <View
      style={[
        style.pill,
        { backgroundColor: palette.surface, borderColor: palette.border },
        onPress === undefined ? style.nudge : undefined,
      ]}
      testID={testID}
    >
      <Text style={[style.label, { color: palette.tint }]} numberOfLines={1}>
        {mark.lead}
        {mark.word}
        {mark.tail}
      </Text>
    </View>
  );

  if (onPress === undefined) {
    return body;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${mark.lead}${mark.word}${mark.tail}`}
      hitSlop={spacing.sm}
      style={style.nudge}
    >
      {body}
    </Pressable>
  );
}

/**
 * Builds the size-dependent half of the style, which `StyleSheet.create` cannot hold because
 * it varies with the reader's scripture size.
 *
 * @param step - The surrounding scripture size.
 * @param alignment - How the host aligned the pill.
 * @returns The pill, the label, and the baseline nudge as three separate styles.
 */
function badgeStyle(
  step: Parameters<typeof badgeGeometry>[0],
  alignment: BadgeAlignment,
): {
  readonly pill: ViewStyle;
  readonly label: TextStyle;
  readonly nudge: ViewStyle;
} {
  const geometry = badgeGeometry(step);
  return {
    nudge: { transform: [{ translateY: badgeBaselineOffset(alignment, currentPlatform(), step) }] },
    pill: {
      ...staticStyles.pill,
      height: geometry.height,
      borderRadius: Math.min(geometry.borderRadius, radius.pill),
      paddingHorizontal: geometry.paddingHorizontal,
    },
    label: {
      ...staticStyles.label,
      fontSize: geometry.labelFontSize,
      lineHeight: geometry.labelLineHeight,
    },
  };
}

const staticStyles = StyleSheet.create({
  pill: {
    // A row that centres its label vertically is what gives the pill a stable optical
    // centre regardless of the glyph's own metrics.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: borderWidth.hairline,
    // `flexShrink: 0` stops a narrow column from squeezing the pill instead of wrapping it.
    flexShrink: 0,
  },
  label: {
    fontFamily: fontFamily.ui.semiBold,
    fontWeight: '600',
  },
});
