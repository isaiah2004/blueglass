/**
 * Font loading.
 *
 * Purpose
 *   `typography.ts` names eight faces; nothing loaded them, so every `fontFamily` in the
 *   app resolved to the platform default and `D-03`'s Source Serif 4 was a string in a
 *   token file rather than something a reader could see. This module is the other half:
 *   the eight faces, registered under exactly the names `typography.ts` uses.
 *
 * Why the names must match exactly
 *   React Native looks a font up by the string in `fontFamily`. `expo-font` registers a
 *   face under whatever key it is given. If the two drift, nothing errors — the text
 *   simply renders in the system font, which looks *almost* right and is the single
 *   easiest way to ship a Bible app that is not set in a serif. {@link ATLAS_FONT_FACES} is
 *   therefore keyed by computed member names taken straight off `fontFamily`, so the two
 *   cannot drift: renaming a face in the token module renames the registration with it.
 *
 * Why these three families
 *   `D-03`: Source Serif 4 for scripture (the Flutter prototype's serif, chosen over a
 *   mockup match), Inter for UI, JetBrains Mono for metadata. All three are SIL OFL.
 *   Vendored as packages rather than fetched at runtime — port-map risk #8: the prototype
 *   used `google_fonts`' runtime fetch, which reflows scripture on first paint.
 *
 * Dependencies
 *   `expo-font`, and the three `@expo-google-fonts` packages.
 */

import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono/700Bold';
import { SourceSerif4_400Regular } from '@expo-google-fonts/source-serif-4/400Regular';
import { SourceSerif4_600SemiBold } from '@expo-google-fonts/source-serif-4/600SemiBold';
import { useFonts } from 'expo-font';

import { fontFamily } from './typography';

/**
 * The eight faces, keyed by the family name `typography.ts` emits.
 *
 * Computed from `fontFamily` rather than typed out, so a rename in the token module moves
 * the registration key with it instead of silently orphaning a face.
 */
export const ATLAS_FONT_FACES = {
  [fontFamily.scripture.regular]: SourceSerif4_400Regular,
  [fontFamily.scripture.semiBold]: SourceSerif4_600SemiBold,
  [fontFamily.ui.regular]: Inter_400Regular,
  [fontFamily.ui.medium]: Inter_500Medium,
  [fontFamily.ui.semiBold]: Inter_600SemiBold,
  [fontFamily.ui.bold]: Inter_700Bold,
  [fontFamily.metadata.medium]: JetBrainsMono_500Medium,
  [fontFamily.metadata.bold]: JetBrainsMono_700Bold,
} as const;

/**
 * Load every face the design system names.
 *
 * @returns `[isLoaded, error]`. The root layout holds the splash screen until `isLoaded`,
 *   so scripture never paints in the system font and then reflow into the serif.
 *   An `error` is not fatal: the app renders in fallback faces rather than not at all.
 *
 * Side effects: registers eight fonts with the platform, once per app launch.
 */
export function useAtlasFonts(): readonly [boolean, Error | null] {
  return useFonts(ATLAS_FONT_FACES);
}
