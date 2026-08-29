/**
 * The human reference for a badge's anchor.
 *
 * Purpose
 *   A sheet heading needs `Acts 16:11`, and a badge carries a resolved `VerseKey`. Formatting
 *   it is one call, but it is a call both the sheet and the rail make, and doing it here means
 *   the two can never head the same badge differently.
 *
 * Why there is no failure arm
 *   The packed integer was resolved at the decode boundary (`badge-wire-leaves.ts`), and a key
 *   the versification table does not recognise dropped the badge there. By the time a badge
 *   exists, its reference is formattable — which is the point of doing the validation once, at
 *   the edge, instead of in every component that wants to print it.
 *
 * Dependencies
 *   `@atlas/shared` only. No React, no I/O.
 */

import { formatVerseReference, toVerseReference, type VerseKey } from '@atlas/shared';

/**
 * Format one resolved verse key.
 *
 * @param verse - The badge anchor's verse.
 * @returns The reference, e.g. `Acts 16:11`. Side effects: none.
 */
export function badgeReference(verse: VerseKey): string {
  return formatVerseReference(toVerseReference(verse));
}
