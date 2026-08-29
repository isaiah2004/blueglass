/**
 * The web build's root HTML document.
 *
 * Purpose
 *   Expo Router renders this once, at export time, to produce the shell every web page is
 *   served inside. It exists here for one reason: to paint the document **before** any
 *   JavaScript runs. Without it the browser shows its own white until the bundle hydrates,
 *   which on a dark-by-default app is a full-screen flash on every cold load — and is the
 *   first thing a reader sees.
 *
 * Why the colour is `darkTheme`'s and not the reader's
 *   Nothing here can know the reader's preference: this markup is generated once, and the
 *   preference lives in their browser's storage. Dark is the default (`D-01`), so dark is
 *   the honest guess. `useDocumentBackground`, mounted in `app/_layout.tsx`, repaints the
 *   document the moment the real theme resolves.
 *
 * Web only — this file is never bundled for a device.
 *
 * Related
 *   `apps/mobile/src/theme/use-document-background.ts`, the runtime half.
 */

import { ScrollViewStyleReset } from 'expo-router/html';
import type { JSX, ReactNode } from 'react';

import { darkTheme } from '@/theme';

/**
 * The initial document paint, as a stylesheet rather than an inline attribute so it also
 * covers the overscroll area on iOS Safari and the space around a short page.
 */
const INITIAL_BACKGROUND = `
  html, body, #root {
    background-color: ${darkTheme.background.canvas};
  }
`;

/**
 * Render the root document.
 *
 * @param props - The rendered app, supplied by Expo Router.
 * @returns The HTML shell.
 */
export default function Root({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Expo Router's own reset: stops the body scrolling behind a React Native
            `ScrollView`, which otherwise produces two scrollbars on the web. */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: INITIAL_BACKGROUND }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
