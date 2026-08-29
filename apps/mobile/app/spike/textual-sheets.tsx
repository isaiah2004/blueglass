/**
 * Route: /spike/textual-sheets — the textual badge sheets, in a browser.
 *
 * Purpose
 *   Gives `[Root]`, `[History]` and `[Cross-Ref]` a real URL so they can be opened at every
 *   breakpoint, in both themes, and by a future Playwright spec — before the reader host
 *   that will eventually mount them exists. The screen itself is
 *   `@/features/sheets/textual/gallery/TextualSheetGallery`; this file is only the router
 *   entry, so the diagnostic can be removed by deleting one file and one folder.
 *
 * Lifetime
 *   Delete this route once the reader opens these sheets from real badges and the
 *   walkthrough covers them. It is deliberately not linked from any tab (pillar 1: nothing
 *   clutters the reading canvas), which is the same contract `/spike/badges` runs under.
 */

import type { JSX } from 'react';

import { TextualSheetGallery } from '@/features/sheets/textual/gallery/TextualSheetGallery';

/**
 * Render the gallery.
 *
 * @returns The diagnostic screen.
 */
export default function TextualSheetsRoute(): JSX.Element {
  return <TextualSheetGallery />;
}
