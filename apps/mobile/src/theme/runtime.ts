/**
 * The design system's React layer.
 *
 * Purpose
 *   Everything in `@/theme` that needs React or React Native to exist: the theme provider
 *   and its hooks, the themed-`StyleSheet` helper, the responsive and reduced-motion
 *   hooks, the loaded font faces, and the bundled texture tiles.
 *
 * Why it is a second barrel and not part of `./index`
 *   `@/theme` is imported by pure modules that are unit-tested under Node, and
 *   `react-native` 0.86 ships Flow source that Vitest's node environment cannot evaluate
 *   (the reasoning is measured out in `vitest.config.ts`'s header). One barrel that pulls
 *   in React Native would take every one of those tests down. Splitting the import path is
 *   the cheapest honest fix: the token half stays testable, and the React half is exercised
 *   by component tests and by the Playwright walkthrough.
 *
 * Deliberately not re-exported: `./fonts`
 *   It imports `expo-font`, which imports `expo-modules-core`, which reads Metro's `__DEV__`
 *   and the native `expo` global at module scope. Anything that touched this barrel would
 *   then need Expo's whole runtime present — including the jsdom component tests, which have
 *   no reason to. Fonts are loaded in exactly one place, `app/_layout.tsx`, and that one
 *   place imports `@/theme/fonts` directly.
 *
 * Usage
 *   ```tsx
 *   import { radius, spacing } from '@/theme';
 *   import { createThemedStyles, useTheme } from '@/theme/runtime';
 *   ```
 */

export { ThemeProvider, useTheme, useThemeController } from './theme-context';
export type { ThemeController, ThemeProviderProps } from './theme-context';

export { ABSOLUTE_FILL, createThemedStyles } from './themed-styles';
export type { ThemedStyleSheet } from './themed-styles';

export { useFormFactor, useResponsiveLayout } from './use-form-factor';
export type { ResponsiveLayout } from './use-form-factor';

export { useIsReduceMotionEnabled, useMotion } from './use-reduced-motion';

export { useDocumentBackground } from './use-document-background';

export { textureSource } from './texture-source';
