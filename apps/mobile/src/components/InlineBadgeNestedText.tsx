/**
 * InlineBadgeNestedText — strategy A of the inline-badge spike. NOT RECOMMENDED.
 *
 * Purpose
 *   The obvious implementation: a nested `<Text>` carrying `backgroundColor`, `borderRadius`,
 *   and horizontal padding. Kept in the tree because it is what every RN developer reaches
 *   for first, and because the spike screen has to show side by side what it actually does.
 *
 * What it really renders (read out of React Native 0.86.3's own source, not guessed)
 *   - Android: a nested text becomes a span list, built in `TextLayoutManager.kt:236-347`.
 *     The only background span available is `ReactBackgroundColorSpan`, a plain
 *     `android.text.style.BackgroundColorSpan`. There is no radius span and no padding span,
 *     so the fill is a hard-edged rectangle hugging the glyphs. `borderRadius` on a `<Text>`
 *     is handled only by `ReactTextViewManager.setBorderRadius`, which applies to the ROOT
 *     text view — a nested fragment never reaches it.
 *   - iOS: `RCTTextAttributes.mm:172` maps the colour to `NSBackgroundColorAttributeName`.
 *     TextKit fills a rectangle. Radius and padding have no attribute to map to. The claim
 *     in `flutter-port-map.md` §7.3 that iOS honours this on nested text is wrong.
 *   - Web: `react-native-web` emits a `<span>` and CSS honours all three — which is exactly
 *     why testing this strategy only on the web build would produce a false pass. At a line
 *     break CSS also slices the box, so a wrapped pill grows two square inner corners.
 *
 * Where it is still the right answer
 *   Backgrounds that are supposed to be square: search-hit highlighting and the verse-level
 *   selection tint (`flutter-port-map.md` §8, risk 4).
 *
 * Dependencies
 *   `@/theme`, `./InlineBadge.geometry`, `./InlineBadge.types`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text } from 'react-native';

import { borderWidth, colors, fontFamily, radius, spacing } from '@/theme';

import { badgeGeometry } from './InlineBadge.geometry';
import { composeBadgeMark, type InlineBadgeProps } from './InlineBadge.types';

/**
 * Render one badge as a nested text span.
 *
 * @param props - See `InlineBadgeProps`. `onPress` maps to the text's own press handler,
 *   which is the one thing this strategy does better than an inline view: the touch target
 *   is the glyph run, so it follows the text across a line break.
 * @returns A nested `<Text>`. Rounded on the web, rectangular on both native platforms.
 *
 * Side effects: none.
 */
export function InlineBadgeNestedText({
  kind,
  label,
  scriptureStep = 'md',
  onPress,
  testID,
}: InlineBadgeProps): JSX.Element {
  const palette = colors.badge[kind];
  const geometry = badgeGeometry(scriptureStep);
  return (
    <Text
      testID={testID}
      onPress={onPress}
      suppressHighlighting
      style={[
        styles.span,
        {
          color: palette.tint,
          backgroundColor: palette.surface,
          fontSize: geometry.labelFontSize,
          lineHeight: geometry.labelLineHeight,
        },
      ]}
    >
      {composeBadgeMark(kind, label)}
    </Text>
  );
}

const styles = StyleSheet.create({
  span: {
    fontFamily: fontFamily.ui.semiBold,
    fontWeight: '600',
    // Honoured by react-native-web only. Left in deliberately: the spike screen's whole
    // point is to show one declaration producing different geometry per platform.
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    paddingHorizontal: spacing.sm,
  },
});
