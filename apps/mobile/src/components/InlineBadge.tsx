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
 * Theming
 *   The hue comes from `useTheme()`, not from the module-scope `colors` table. Reading the
 *   table directly is what made the pill keep its dark hues under the light palette, which
 *   `D-01` does not allow: light mode actually ships, and every component is verified in both.
 *
 * The glyph
 *   A vector path stroked in the badge's hue (`./BadgeGlyph`, assumption `Q-021`), not an
 *   emoji. §5 asks for "text and icon in the full hue" and the OS paints an emoji in its own
 *   palette, so the spike's placeholder could never satisfy it. The pill is already a row, so
 *   the glyph is simply a third child between the two halves of the bracketed mark.
 *
 * Dependencies
 *   `@/theme` for every dimension, `@/theme/runtime` for the active palette, `./BadgeGlyph`
 *   for the icon, `./InlineBadge.geometry` for the arithmetic, `./InlineBadge.types` for the
 *   props and the mark.
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

import { borderWidth, fontFamily, radius, size } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { BADGE_ICON_GAP_RATIO, BADGE_ICON_SIZE_RATIO } from './badge-icons';
import { BadgeGlyph } from './BadgeGlyph';
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
  const palette = useTheme().badge[kind];
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
      // The test id belongs to the outermost node, which is the `Pressable` when the badge is
      // tappable: that is the element a reader touches and the element the walkthrough's tap
      // audit measures.
      {...(onPress === undefined ? { testID } : {})}
    >
      <Text style={[style.label, { color: palette.tint }]} numberOfLines={1}>
        {mark.lead}
      </Text>
      <BadgeGlyph kind={kind} size={style.glyphSize} color={palette.tint} />
      <Text style={[style.label, style.word, { color: palette.tint }]} numberOfLines={1}>
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
      {...pressableRole(`${mark.lead}${mark.word}${mark.tail}`)}
      // §5 fixes the pill at 22-24 pt so it cannot disturb the line rhythm, which is well
      // under the 44 dp minimum. The slop makes the *touch* area meet it without changing a
      // pixel of what is painted.
      hitSlop={style.hitSlop}
      style={style.nudge}
      testID={testID}
    >
      {body}
    </Pressable>
  );
}

/**
 * The accessibility props of a tappable pill, which differ by platform on purpose.
 *
 * A badge always sits inside a verse row, and that row is itself a control. On the web,
 * react-native-web renders anything with `accessibilityRole="button"` as a real `<button>`
 * element, and a `<button>` inside a `<button>` is invalid HTML: React logs it on every
 * chapter and the dev LogBox covers the tab bar. So on the web the pill keeps its label and
 * its tap target but not the role, and the **chapter-end badge summary list is the
 * keyboard-reachable route to every badge** — which is what that list is for
 * (`design-language.md` §5). On native there is no DOM and no nesting rule, so the role
 * stays and TalkBack announces the pill as a button.
 *
 * Queued as `Q-024`; this is the recommendation, recorded in `ASSUMPTIONS.md`.
 *
 * @param label - The badge's mark, e.g. `[Route]`.
 * @returns Props to spread onto the pill's `Pressable`. Side effects: none.
 */
function pressableRole(label: string): {
  readonly accessibilityRole?: 'button';
  readonly accessibilityLabel: string;
} {
  return Platform.OS === 'web'
    ? { accessibilityLabel: label }
    : { accessibilityRole: 'button', accessibilityLabel: label };
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
  readonly word: TextStyle;
  readonly nudge: ViewStyle;
  readonly glyphSize: number;
  readonly hitSlop: number;
} {
  const geometry = badgeGeometry(step);
  return {
    // Grow the touch area to the 44 dp minimum from whatever §5's pill height leaves.
    hitSlop: Math.max(0, Math.ceil((size.tapTarget - geometry.height) / 2)),
    // The glyph is sized to the label's own cap band rather than to the pill, so it reads as
    // one word with the text beside it at every reading size.
    glyphSize: Math.round(geometry.labelFontSize * BADGE_ICON_SIZE_RATIO),
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
    // The gap the emoji's trailing space used to provide, now that the glyph is a view.
    word: { marginLeft: Math.round(geometry.labelFontSize * BADGE_ICON_GAP_RATIO) },
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
