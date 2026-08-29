/**
 * Root layout — the composition root of the Expo client.
 *
 * Purpose
 *   Wraps every route in the providers the app cannot run without, loads the design
 *   system's fonts, and declares the top-level navigator. This is the only place providers
 *   are mounted; feature code consumes them through hooks, never by re-wrapping.
 *
 * Provider order (outermost first) and why
 *   1. `GestureHandlerRootView` — react-native-gesture-handler requires a root host above
 *      anything that uses a gesture, which now includes the reader's resizable split
 *      (`components/split/ResizableSplit.tsx`) as well as `@gorhom/bottom-sheet`.
 *   2. `SafeAreaProvider` — publishes insets; the tab bar, the nav rail and the sheets read
 *      them.
 *   3. `ThemeProvider` — decision `D-01`. Above the navigator, because the navigator's own
 *      screen background is a themed colour and would otherwise be resolved once, at
 *      module load, in whichever palette happened to be the default.
 *   4. `QueryClientProvider` — TanStack Query, the server-state layer (assumption `T-13`).
 *   5. `BadgeSheetHost` — registers the five badge sheet bodies with the reading canvas's
 *      slot (`features/reader/badges/badge-sheet-slot.tsx`). It belongs above the navigator
 *      for the reason the slot exists: a prop would make every route that mounts
 *      `ReaderScreen` name all five sheets, so adding the sixth would edit files that have
 *      nothing to do with it. Mounted once here, a tapped `[Route]` opens onto its map
 *      rather than onto its teaser.
 *
 * The document is painted twice, on purpose
 *   `app/+html.tsx` puts the dark canvas on `<html>` before any JavaScript runs, and
 *   `useDocumentBackground` below repaints it once the reader's real theme resolves. React
 *   Native Web leaves the document transparent, so without both the browser's own white
 *   shows on every cold load.
 *
 * The splash screen holds until the fonts land
 *   Port-map risk #8. `expo-font` registers the eight faces `theme/typography.ts` names;
 *   until it has, every `fontFamily` falls back to the system face and scripture reflows on
 *   first paint. Holding the splash costs a few hundred milliseconds once per cold start
 *   and removes the reflow entirely. A font *error* does not hold it: the app renders in
 *   fallback faces rather than not at all.
 *
 * The query client is the API layer's, not a local one
 *   `src/api/query/query-client.ts` owns retry, staleness and offline behaviour, and it
 *   turns TanStack's own retry **off** because `src/api/client/retry.ts` already retries
 *   with backoff and jitter. A hand-rolled `new QueryClient()` here silently reinstated
 *   TanStack's default of three retries, so one failing chapter fired four ladders of three
 *   requests — twelve — and the reader waited ten seconds for a failure the transport had
 *   settled in under two.
 *
 * Inactive tab screens are detached on the web too
 *   `react-native-screens` only enables itself on iOS and Android, so on the web React
 *   Navigation kept every visited tab mounted, laid out and stacked at `zIndex: -1`. Three
 *   screens meant three theme toggles in the DOM. `enableScreens()` makes the web build
 *   honour `activityState`, which renders an inactive tab `display: none` — the behaviour
 *   the native builds already had, and the behaviour `T-01` ("web is first-class") requires.
 */

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type JSX } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableScreens } from 'react-native-screens';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { createAtlasQueryClient } from '@/api';
import { BadgeSheetHost } from '@/features/sheets/BadgeSheetHost';
import { useAtlasFonts } from '@/theme/fonts';
import { ThemeProvider, useDocumentBackground, useTheme } from '@/theme/runtime';

// Module scope, so it runs once and before the navigator's first render.
enableScreens();

// Held from module load so there is no window in which the splash auto-hides before the
// fonts are registered. Failure is not actionable — the splash simply hides on its own.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

/**
 * Keep the status bar's glyphs legible against the active theme.
 *
 * A separate component because it has to be *inside* `ThemeProvider` to read the theme,
 * and `RootLayout` is what mounts that provider.
 *
 * @returns The themed status bar.
 */
function ThemedStatusBar(): JSX.Element {
  const theme = useTheme();

  // Paints `<html>` and `<body>` too. React Native Web leaves both transparent, so without
  // this the browser's own white shows behind the app — on load, on overscroll, and around
  // any screen that does not fill the viewport. `app/+html.tsx` covers the frames before
  // this runs; this keeps it in step with the reader's choice afterwards.
  useDocumentBackground(theme.background.canvas);

  return <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />;
}

/**
 * Mount the app's providers and the root navigator.
 *
 * @returns The provider tree wrapping a headerless stack.
 *
 * Side effects: creates one `QueryClient` for the lifetime of the app; loads eight fonts;
 * hides the splash screen once they resolve.
 */
export default function RootLayout(): JSX.Element {
  const [queryClient] = useState(createAtlasQueryClient);
  const [fontsLoaded, fontError] = useAtlasFonts();
  const isReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (isReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isReady]);

  if (!isReady) return <GestureHandlerRootView style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <BadgeSheetHost>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false }} />
            </BadgeSheetHost>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
