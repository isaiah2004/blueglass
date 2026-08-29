/**
 * AppBackground.
 *
 * Purpose
 *   The canvas every screen sits on: the base surface, the two ambient radial glows
 *   `docs/product/design-language.md` §2 calls for, and the woven cross-hatch texture
 *   `D-05` asked to bring back. Ports `glass.dart`'s `AppBackground`, which did the same
 *   three things in the same order.
 *
 * Why the glows are an `<Svg>` and not a gradient library
 *   §2 is specific: *two large, very low-opacity radial gradients — gold from the top-left,
 *   cyan from the top-right. Never a linear gradient across a surface.* React Native has no
 *   radial gradient primitive and `expo-linear-gradient` is, as named, linear.
 *   `react-native-svg` is already a dependency for the badge glyphs and draws a real
 *   `<RadialGradient>` on every platform. The two circles are static, so the whole thing
 *   rasterises once.
 *
 * Why there is no blur here
 *   `D-05`: *"No excessive glass stuff."* Port-map risk #7 gives the engineering half of the
 *   same instruction — the Flutter code found that animating geometry over a backdrop blur
 *   re-blurs every frame. Blur is confined to transient overlays. Always-on chrome, and
 *   this background above all, is a flat token colour with a texture over it.
 *
 * Both themes
 *   The glow colours and the texture ink come from the active theme, so the light build
 *   gets a warm paper with a faint amber and teal cast rather than an inverted night sky.
 */

import type { JSX, ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { toRgbaChannels, type Color, type Theme } from '@/theme';
import { ABSOLUTE_FILL, createThemedStyles, useTheme } from '@/theme/runtime';

import { TextureOverlay } from './TextureOverlay';

/** Inputs to {@link AppBackground}. */
export interface AppBackgroundProps {
  /** What is drawn on the canvas. */
  readonly children: ReactNode;
}

/**
 * The glow's radius as a fraction of the viewport's short side.
 *
 * Large and soft: §2 asks for *ambient depth*, which means the reader should not be able to
 * point at where the light is coming from.
 */
const GLOW_RADIUS = 0.9;

/** The square the glows are drawn in, in SVG user units. Scaled to fill by `preserveAspectRatio`. */
const GLOW_BOX = 100;

/**
 * Split an ambient token into the two attributes SVG actually accepts.
 *
 * SVG 1.1's `stop-color` takes no alpha channel — an `rgba()` there is either ignored or
 * clamped to opaque depending on the renderer, which is how a "very low-opacity" glow ends
 * up as a solid gold quarter-circle. The alpha has to travel separately, on `stop-opacity`.
 *
 * @param color - An ambient token, e.g. `theme.ambient.gold`.
 * @returns The opaque hue and its alpha.
 */
function toStop(color: Color): { hue: string; opacity: number } {
  const { red, green, blue, alpha } = toRgbaChannels(color);
  return { hue: `rgb(${String(red)},${String(green)},${String(blue)})`, opacity: alpha };
}

/**
 * Paint the app canvas behind `children`.
 *
 * @param props - See {@link AppBackgroundProps}.
 * @returns A full-bleed canvas: base colour, two ambient glows, one texture, then content.
 *
 * Side effects: none.
 */
export function AppBackground({ children }: AppBackgroundProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const gold = toStop(theme.ambient.gold);
  const cyan = toStop(theme.ambient.cyan);

  return (
    <View style={styles.canvas}>
      <Svg
        style={styles.glow}
        width="100%"
        height="100%"
        viewBox={`0 0 ${String(GLOW_BOX)} ${String(GLOW_BOX)}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <Defs>
          <RadialGradient id="atlas-glow-gold" cx="0" cy="0" r="1">
            <Stop offset="0" stopColor={gold.hue} stopOpacity={gold.opacity} />
            <Stop offset="1" stopColor={gold.hue} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="atlas-glow-cyan" cx="1" cy="0" r="1">
            <Stop offset="0" stopColor={cyan.hue} stopOpacity={cyan.opacity} />
            <Stop offset="1" stopColor={cyan.hue} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx="0" cy="0" r={GLOW_BOX * GLOW_RADIUS} fill="url(#atlas-glow-gold)" />
        <Circle cx={GLOW_BOX} cy="0" r={GLOW_BOX * GLOW_RADIUS} fill="url(#atlas-glow-cyan)" />
      </Svg>
      <TextureOverlay role="canvas" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  canvas: {
    flex: 1,
    backgroundColor: theme.background.canvas,
    overflow: 'hidden',
  },
  // `pointerEvents: 'none'` is not decoration: an absolutely-filled `<svg>` is hit-testable
  // on the web and would swallow every tap on the screen behind it.
  glow: { ...ABSOLUTE_FILL, pointerEvents: 'none' },
  content: { flex: 1 },
}));
