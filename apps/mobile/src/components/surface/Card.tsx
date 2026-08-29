/**
 * Card.
 *
 * Purpose
 *   The standard raised surface. `docs/product/design-language.md` §4 is precise about it:
 *   a **subtle vertical gradient** from `bg.cardHover` down to `bg.card`, a 1 px hairline,
 *   a 14 dp radius, and *never a flat fill, never a drop shadow*. The gradient is the whole
 *   difference between the design's cards and the flat rectangles a rewrite produces by
 *   default, so it is built into the component rather than left to each call site.
 *
 * Responsibilities
 *   - Owns: the gradient, the hairline, the radius, and the card's own texture.
 *   - Does NOT own: padding or layout of its contents. A card holding a chart and a card
 *     holding a list want different insets, and baking one in makes the other fight it.
 *
 * Why `react-native-svg` for two stops
 *   Same reason as `AppBackground`: it is already a dependency, and `expo-linear-gradient`
 *   would be a second one for a gradient that never animates.
 */

import type { JSX, ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { borderWidth, radius, type Theme } from '@/theme';
import { ABSOLUTE_FILL, createThemedStyles, useTheme } from '@/theme/runtime';

import { TextureOverlay } from './TextureOverlay';

/** Inputs to {@link Card}. */
export interface CardProps {
  /** The card's contents. The card adds no padding — pass your own. */
  readonly children: ReactNode;
  /** Extra layout, e.g. padding, width, or `flex`. Never colours. */
  readonly style?: StyleProp<ViewStyle> | undefined;
  /** Announced by a screen reader as the card's name, when the card is a landmark. */
  readonly accessibilityLabel?: string | undefined;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * A raised surface with the design language's vertical gradient.
 *
 * @param props - See {@link CardProps}.
 * @returns The card.
 *
 * Side effects: none.
 */
export function Card({ children, style, accessibilityLabel, testID }: CardProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const [top, bottom] = theme.cardGradient;

  return (
    <View
      style={[styles.card, style]}
      testID={testID}
      {...(accessibilityLabel === undefined ? {} : { accessibilityLabel })}
    >
      <Svg style={styles.gradient} width="100%" height="100%" aria-hidden>
        <Defs>
          <LinearGradient id="atlas-card" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#atlas-card)" />
      </Svg>
      <TextureOverlay role="card" />
      {children}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  card: {
    borderRadius: radius.card,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    // The gradient and the texture are absolutely positioned children; without clipping,
    // both square off the rounded corners on the web.
    overflow: 'hidden',
    // The flat fill is the fallback the gradient paints over, not the design: it only shows
    // for the frame before the SVG rasterises.
    backgroundColor: theme.background.card,
  },
  // An absolutely-filled `<svg>` is hit-testable on the web; without this the gradient
  // would swallow every press inside the card.
  gradient: { ...ABSOLUTE_FILL, pointerEvents: 'none' },
}));
