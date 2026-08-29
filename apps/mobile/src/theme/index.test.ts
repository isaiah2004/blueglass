/**
 * Tests for the design-token public API.
 *
 * `@/theme` is the single import path every component uses, so its surface is a contract.
 * These tests assert what it offers and — just as importantly — what it withholds: the raw
 * palettes stay private, because a component that imported a hue directly would be locked
 * to one theme forever, and **nothing here may import React or React Native**, because pure
 * modules import this barrel and are unit-tested under Node. The React layer — the provider,
 * the hooks, the themed-`StyleSheet` helper, the font faces, the texture assets — lives
 * behind `@/theme/runtime` for exactly that reason.
 */

import { describe, expect, it } from 'vitest';

import * as theme from './index';

/** Everything `@/theme` exports at runtime. Types are erased and cannot appear here. */
const PUBLIC_API = [
  // Colour values and derivation.
  'InvalidColorError',
  'flattenOver',
  'toRgbaChannels',
  'withAlpha',
  'withOpacity',
  // Theme.
  'colors',
  'darkTheme',
  'lightTheme',
  'themeFor',
  'themes',
  'badgeKinds',
  // Theme selection (`D-01`). The provider and hooks are in `@/theme/runtime`, not here:
  // this barrel must stay loadable under plain Node, because pure modules import it and are
  // unit-tested there.
  'DEFAULT_THEME_NAME',
  'DEFAULT_THEME_PREFERENCE',
  'isThemePreference',
  'nextThemePreference',
  'parseThemePreference',
  'resolveThemeName',
  'themePreferenceLabel',
  'themePreferences',
  // Responsive layout (`Q-006`).
  'breakpoint',
  'contextRailMinimum',
  'formFactorFor',
  'layout',
  'readingMeasure',
  'scriptureStepByFormFactor',
  'usesNavigationRail',
  'usesSplitPane',
  // Surface textures (`D-05`).
  'MAX_TEXTURE_OPACITY',
  'textureFor',
  'textureNames',
  'textureRoles',
  // Contrast.
  'CONTRAST_MINIMUM',
  'contrastRatio',
  'meetsContrast',
  'relativeLuminance',
  // Typography.
  'fontFamily',
  'metadataSize',
  'metadataText',
  'scriptureSize',
  'scriptureText',
  'uiSize',
  'uiText',
  // Layout.
  'size',
  'spacing',
  'borderWidth',
  'radius',
  // Motion.
  'motion',
  'motionFor',
  'reducedMotion',
] as const;

describe('the @/theme surface', () => {
  it('exports exactly the documented API', () => {
    expect(Object.keys(theme).sort()).toEqual([...PUBLIC_API].sort());
  });

  it('keeps the raw palette and the audit-only surface list private', () => {
    expect(Object.keys(theme)).not.toContain('PALETTE');
    expect(Object.keys(theme)).not.toContain('auditableSurfaces');
  });

  it('gives a component everything a styled element needs from one import', () => {
    const style = {
      ...theme.scriptureText('md'),
      color: theme.colors.ink.primary,
      backgroundColor: theme.colors.background.card,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.card,
      borderWidth: theme.borderWidth.hairline,
      borderColor: theme.colors.line.hairline,
    };

    expect(style).toEqual({
      fontFamily: 'SourceSerif4-Regular',
      fontSize: 20,
      fontWeight: '400',
      lineHeight: 32,
      letterSpacing: 0,
      color: '#E8EDF5',
      backgroundColor: '#0E141E',
      padding: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    });
  });
});
