/**
 * TextureOverlay.
 *
 * Purpose
 *   Delivers the "textures would be nice" half of decision `D-05`. Fills its parent with
 *   one of the six baked tiles, repeated, tinted to the theme and painted at the strength
 *   `theme/texture.ts` sets for that class of surface.
 *
 * Why an `<Image resizeMode="repeat">` and not an SVG pattern
 *   Port-map risk #6. The Flutter prototype drew its motifs with a `CustomPainter` and
 *   cached them as an `ImageShader`, which React Native has no equivalent for;
 *   `react-native-svg`'s `<Pattern>` is the obvious substitute and is slow at full-screen
 *   size, because it re-rasterises on every resize. A repeated bitmap is handed to the
 *   platform's own compositor and costs nothing per frame — which matters most on the one
 *   surface that is always on screen, the reading canvas.
 *
 * Why it is absolutely positioned and inert
 *   It is a surface quality, not content. `pointerEvents="none"` keeps it out of every hit
 *   test, and it is hidden from assistive technology, so a screen reader never announces
 *   the wallpaper.
 *
 * Restraint
 *   `theme/texture.ts` caps every strength at 8 %. If a texture is visible as a *pattern*
 *   rather than as a surface, the number is wrong — change it there, not here.
 */

import type { JSX } from 'react';
import { Image, View } from 'react-native';

import { textureFor, type TextureRole } from '@/theme';
import { ABSOLUTE_FILL, createThemedStyles, textureSource, useTheme } from '@/theme/runtime';

/** The inert layer the tile is painted into. */
const useStyles = createThemedStyles(() => ({
  layer: { ...ABSOLUTE_FILL, pointerEvents: 'none', overflow: 'hidden' },
  // Explicit 100 % rather than `absoluteFill`: react-native-web sizes a `repeat` image to
  // the tile's natural size when the style only pins its insets, so a 24 px tile paints a
  // 24 px square in the corner instead of covering the surface. Measured, not assumed.
  tile: { width: '100%', height: '100%' },
}));

/** Inputs to {@link TextureOverlay}. */
export interface TextureOverlayProps {
  /** Which class of surface is being textured. */
  readonly role: TextureRole;
}

/**
 * Paint a repeating texture over the parent.
 *
 * The parent must establish a positioning context and, on the web, clip its overflow —
 * a `View` there does not clip by default and the tile would run past the edge.
 *
 * @param props - See {@link TextureOverlayProps}.
 * @returns An inert, absolutely-positioned tiled image.
 *
 * Side effects: none.
 */
export function TextureOverlay({ role }: TextureOverlayProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const texture = textureFor(role, theme.name);

  return (
    // The wrapper carries the inertness: `Image` takes neither a `pointerEvents` prop nor
    // a `pointerEvents` style, and `aria-hidden` is the one accessibility prop that is
    // correct on both platforms — react-native-web maps it to the DOM attribute, React
    // Native maps it to `accessibilityElementsHidden`. Passing those native-only props
    // directly makes React warn on every render.
    <View style={styles.layer} aria-hidden>
      <Image
        source={textureSource[texture.name]}
        resizeMode="repeat"
        tintColor={texture.tint}
        style={[styles.tile, { opacity: texture.opacity }]}
      />
    </View>
  );
}
