/**
 * Public API of the design-token layer.
 *
 * Purpose
 *   One import path for every design token. Components import from `@/theme`; they never
 *   reach into an individual token module, and they never write a raw colour, size, or
 *   spacing value (CLAUDE.md, "Where this project overrides ControlSight").
 *
 * Key responsibilities
 *   - Re-export the tokens and the two helper functions components legitimately need.
 *   - Keep the palette itself private. `colors` is the theme in force; the raw hues behind
 *     it are unreachable, so a component cannot become theme-locked.
 *
 * What is deliberately not exported
 *   The `PALETTE` constants in `colors.ts` and `light-colors.ts`, and the two
 *   `auditableSurfaces` tables, which exist for the contrast audit rather than for
 *   rendering.
 *
 *   **Nor anything that imports React or React Native.** This barrel must stay loadable
 *   under plain Node, because pure modules such as `components/InlineBadge.geometry.ts`
 *   import it and are unit-tested there — `react-native` 0.86 ships Flow source that
 *   Vitest's node environment cannot evaluate (see the header of `vitest.config.ts`). The
 *   provider, the hooks, the themed-`StyleSheet` helper, the font faces and the bundled
 *   texture PNGs therefore live in `./runtime`, which components import instead:
 *
 *   ```ts
 *   import { colors, radius, spacing } from '@/theme';          // tokens, Node-safe
 *   import { useTheme, createThemedStyles } from '@/theme/runtime'; // React layer
 *   ```
 *
 * Usage
 *   ```ts
 *   import { colors, radius, scriptureText, spacing } from '@/theme';
 *
 *   const styles = StyleSheet.create({
 *     verse: { ...scriptureText('md'), color: colors.ink.primary },
 *     card: { backgroundColor: colors.background.card, padding: spacing.lg, borderRadius: radius.card },
 *   });
 *   ```
 */

// Colour values and derivation. `withAlpha` may only be called on a token, never a literal.
export {
  InvalidColorError,
  flattenOver,
  toRgbaChannels,
  withAlpha,
  withOpacity,
} from './color-math';
export type { Color, HexColor, RgbaChannels, RgbaColor } from './color-math';

// The two palettes. `colors` is the dark theme as a module constant and is retained only
// for the components written before the provider existed; new code reads `useTheme()`.
export { colors, darkTheme } from './colors';
export { lightTheme } from './light-colors';
export { themeFor, themes } from './themes';
export { badgeKinds } from './theme-contract';
export type {
  AccentColors,
  AmbientColors,
  BackgroundColors,
  BadgeColors,
  BadgeKind,
  InkColors,
  LineColors,
  OverlayColors,
  StateColors,
  Theme,
  ThemeName,
} from './theme-contract';

// Theme selection, as pure logic. The provider and hooks live in `./runtime`.
export {
  DEFAULT_THEME_NAME,
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  nextThemePreference,
  parseThemePreference,
  resolveThemeName,
  themePreferenceLabel,
  themePreferences,
} from './theme-preference';
export type { ThemePreference } from './theme-preference';

// Responsive layout rules. `Q-006` put phone, tablet and desktop all in scope.
export {
  breakpoint,
  contextRailMinimum,
  formFactorFor,
  layout,
  readingMeasure,
  scriptureStepByFormFactor,
  usesNavigationRail,
  usesSplitPane,
} from './breakpoints';
export type { FormFactor } from './breakpoints';

// Surface texture tokens (`D-05`). The bundled tiles are in `./runtime`.
export { MAX_TEXTURE_OPACITY, textureFor, textureNames, textureRoles } from './texture';
export type { TextureName, TextureRole, TextureToken } from './texture';

// Contrast measurement, so a component test or QA screen can assert legibility.
export { CONTRAST_MINIMUM, contrastRatio, meetsContrast, relativeLuminance } from './contrast';
export type { ContrastLevel } from './contrast';

// Typography. The three factories are the only way to set a font.
export {
  fontFamily,
  metadataSize,
  metadataText,
  scriptureSize,
  scriptureText,
  uiSize,
  uiText,
} from './typography';
export type {
  FontWeightValue,
  MetadataStep,
  MetadataStyleToken,
  MetadataWeight,
  ScriptureStep,
  ScriptureWeight,
  TextStyleToken,
  UiStep,
  UiWeight,
} from './typography';

// Layout.
export { size, spacing } from './spacing';
export type { SpacingStep } from './spacing';
export { borderWidth, radius } from './radius';
export type { BorderWidthStep, RadiusStep } from './radius';

// Motion. Components call `useMotion()` from `./runtime`; these are for pure code.
export { motion, motionFor, reducedMotion } from './motion';
export type {
  DurationName,
  EasingCurve,
  EasingName,
  LoopName,
  MotionTokens,
  SpringConfig,
  SpringName,
  StaggerName,
  TransitionStyle,
} from './motion';
