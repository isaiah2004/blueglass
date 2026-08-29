/**
 * What the host puts in the sheet's own title bar.
 *
 * Purpose
 *   The sheet body owns its heading; the *chrome* around it — `ReaderSheet`'s title on a
 *   phone, the context rail's panel title above 600 dp — is the host's, and the host needs
 *   a string before it has rendered anything. Deriving it here means the two homes cannot
 *   title the same badge differently.
 *
 * Key responsibilities
 *   - Name each of the three badges the way the design language names them.
 *   - Answer whether a badge kind belongs to this folder at all, so a host can route
 *     without a `switch` it has to keep in step with three files.
 *
 * Dependencies
 *   The folder's payload types. Pure — no React, Node-testable.
 */

import type { TextualBadge, TextualBadgeKind } from './textual-payloads';

/** The three kinds this folder renders. */
const TEXTUAL_KINDS: readonly TextualBadgeKind[] = ['root', 'history', 'cross-ref'];

/** How each badge is titled in the sheet's chrome. */
const SHEET_TITLE: Record<TextualBadgeKind, string> = {
  root: 'Word root',
  history: 'History',
  'cross-ref': 'Cross-references',
};

/**
 * Whether a badge kind is one this folder renders.
 *
 * @param kind - Any badge kind from the chapter payload.
 * @returns True for `root`, `history` and `cross-ref`. Side effects: none.
 */
export function isTextualBadgeKind(kind: string): kind is TextualBadgeKind {
  return (TEXTUAL_KINDS as readonly string[]).includes(kind);
}

/**
 * The title for a badge's sheet chrome.
 *
 * @param badge - The badge about to be rendered.
 * @returns The title, e.g. `Word root`. Side effects: none.
 */
export function textualSheetTitle(badge: TextualBadge): string {
  return SHEET_TITLE[badge.kind];
}
