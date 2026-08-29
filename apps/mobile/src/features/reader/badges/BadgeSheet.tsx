/**
 * A tapped badge, as a bottom sheet. The phone path.
 *
 * Purpose
 *   `design-language.md` §4: the sheet covers the bottom half and leaves the scripture above
 *   it visible, because "that visible scripture is the whole point of the interaction". Never
 *   a full-screen modal. `ReaderSheet` already is that shape for the navigator, the
 *   translation switcher and the display settings, so a badge opens into the same surface
 *   rather than into a fourth one that would drift from the other three.
 *
 * Only below the rail breakpoint
 *   From 600 dp a badge fills the context rail instead and this component is never mounted.
 *   `ReaderScreen` makes that choice from `contextIsPinned`, which comes from the same rule
 *   the layout itself uses — so the sheet and the rail can never both be showing one badge.
 *
 * Dependencies
 *   `../components/ReaderSheet` for the surface, `BadgeDetail` for the contents.
 */

import type { JSX } from 'react';

import { badgeLabel } from '@/components/InlineBadge.types';

import { ReaderSheet } from '../components/ReaderSheet';

import { themeBadgeKind } from './badge-kinds';

import type { ReaderBadge } from './badge-models';
import type { BadgeSheetTarget } from './badge-sheet-slot';
import { BadgeDetail } from './BadgeDetail';

/** What the sheet needs. */
export interface BadgeSheetProps {
  /** The open badge, or `undefined` when none is. */
  readonly badge: ReaderBadge | undefined;
  readonly onClose: () => void;
  /**
   * Open a passage from inside the badge's body — a cross-reference row, a Root example.
   *
   * The host dismisses the sheet first: on a phone the sheet covers the bottom half of the
   * screen, so navigating underneath it would land the reader on a chapter they cannot see.
   */
  readonly onOpenVerse?: ((target: BadgeSheetTarget) => void) | undefined;
}

/**
 * Render the badge sheet.
 *
 * @param props - See {@link BadgeSheetProps}.
 * @returns The sheet, closed when no badge is open.
 *
 * Side effects: none beyond `onClose`.
 */
export function BadgeSheet({ badge, onClose, onOpenVerse }: BadgeSheetProps): JSX.Element | null {
  if (badge === undefined) {
    return null;
  }

  return (
    <ReaderSheet
      visible
      title={badgeLabel[themeBadgeKind(badge.kind)]}
      onClose={onClose}
      testID="badge-sheet"
    >
      <BadgeDetail badge={badge} onOpenVerse={onOpenVerse} />
    </ReaderSheet>
  );
}
