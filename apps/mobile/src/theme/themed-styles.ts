/**
 * Styles that follow the active theme.
 *
 * Purpose
 *   `StyleSheet.create` at module scope reads whatever colour the module constant held at
 *   evaluation time, which is why the scaffold's `colors` export could never deliver
 *   decision `D-01`. This module is the replacement: a factory takes the theme and
 *   returns the sheet, and the result is cached per theme so a re-render costs a `Map`
 *   lookup rather than a fresh `StyleSheet.create`.
 *
 * Key responsibilities
 *   - Turn a `(theme) => styles` function into a `(theme) => styles` *memoised* function.
 *   - Keep the cache keyed on the theme object itself, so it can never go stale: a new
 *     palette is a new object and therefore a new entry.
 *
 * Why not `useMemo`
 *   `useMemo` caches per component instance. Twenty rendered rows would build twenty
 *   identical sheets. The cache here is per style factory, so all twenty share one.
 *
 * Usage
 *   ```tsx
 *   const useStyles = createThemedStyles((theme) => ({
 *     card: { backgroundColor: theme.background.card },
 *   }));
 *
 *   function Card(): JSX.Element {
 *     const styles = useStyles(useTheme());
 *     return <View style={styles.card} />;
 *   }
 *   ```
 */

import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { spacing } from './spacing';
import type { Theme } from './theme-contract';

/**
 * An absolutely-positioned layer filling its parent, as a spreadable object.
 *
 * `StyleSheet.absoluteFill` is a *registered* style id, so it can be put in a style array
 * but not spread into a style that also needs `opacity` or `pointerEvents`; and React
 * Native 0.86 no longer types `StyleSheet.absoluteFillObject`. Every decorative layer in
 * the app — the ambient glow, the card gradient, the surface textures — needs exactly this
 * shape, so it is written once, from tokens.
 */
export const ABSOLUTE_FILL = {
  position: 'absolute',
  top: spacing.none,
  left: spacing.none,
  right: spacing.none,
  bottom: spacing.none,
} as const satisfies ViewStyle;

/** The shape `StyleSheet.create` accepts: a flat record of named styles. */
export type ThemedStyleSheet = Record<string, ImageStyle | TextStyle | ViewStyle>;

/**
 * Build a theme-aware style sheet.
 *
 * @param factory - Produces the raw style object for one theme. Called at most once per
 *   theme, so it may be as expensive as it needs to be.
 * @returns A function from theme to a registered `StyleSheet`. Calling it twice with the
 *   same theme returns the identical object, which keeps React's style prop referentially
 *   stable and lets `React.memo` do its job.
 */
export function createThemedStyles<T extends ThemedStyleSheet>(
  factory: (theme: Theme) => T,
): (theme: Theme) => T {
  const cache = new Map<Theme, T>();

  return (theme: Theme): T => {
    const cached = cache.get(theme);
    if (cached !== undefined) return cached;

    const created = StyleSheet.create(factory(theme));
    cache.set(theme, created);
    return created;
  };
}
