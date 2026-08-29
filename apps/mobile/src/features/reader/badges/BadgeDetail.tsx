/**
 * One badge, as a sheet body or a rail body — the same component either way.
 *
 * Purpose
 *   Below 600 dp a tapped badge opens a sheet over the bottom half of the screen; from 600 dp
 *   it fills the context rail beside the scripture (`Q-006`). Those are two containers, not
 *   two designs, so the contents are built once here and the container is chosen by
 *   `ReaderScreen`. That is the same discipline `VerseDetail` already applies to a tapped
 *   verse, and it is what stops the phone and the desktop saying different things.
 *
 * What this component owns, and what it does not
 *   It owns the chrome every badge shares: the mark, the reference, the teaser, its
 *   attribution when the teaser is somebody's reading (`Q-015`), any evidence the source
 *   strip cannot carry, and the strip itself (`AI-05`). It does not own the body — the map,
 *   the timeline, the lexicon entry — which arrives through `badge-sheet-slot.tsx` from
 *   whoever built it. With no body registered, what remains is still a complete and honest
 *   surface; with one registered, the body is what the reader actually came for.
 *
 * Navigation is passed through, not performed
 *   A `[Cross-Ref]` body's whole purpose is to take the reader to the linked passage, and a
 *   `[Root]` example row does the same. Neither may import a navigator — both render in a
 *   gallery and in tests with no router above them — so the command arrives as a prop and is
 *   handed to the body through the slot's `actions`.
 *
 * Pillar 1
 *   Nothing here floats over scripture. The sheet is a surface the reader opened by tapping a
 *   pill, and the rail sits beside the text rather than on it.
 *
 * Dependencies
 *   The theme, this folder's models and slot, `BadgePill`, `BadgeClaimMark`, `BadgeEvidence`
 *   and `BadgeAttribution`.
 */

import { useMemo, type JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { metadataText, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { attributedTeaserLabel, interpretiveClaimOf } from './badge-claim';
import { themeBadgeKind } from './badge-kinds';
import type { ReaderBadge } from './badge-models';
import { badgeReference } from './badge-reference';
import {
  NO_BADGE_SHEET_ACTIONS,
  useBadgeSheetRenderer,
  type BadgeSheetTarget,
} from './badge-sheet-slot';
import { BadgeAttribution } from './BadgeAttribution';
import { BadgeClaimMark } from './BadgeClaimMark';
import { BadgeEvidence } from './BadgeEvidence';
import { BadgePill } from './BadgePill';

/** What the detail needs. */
export interface BadgeDetailProps {
  readonly badge: ReaderBadge;
  /**
   * Open a passage in the reader, from a control inside the badge's body.
   *
   * Omitted, the body's rows stay readable but inert — which is what a gallery and a
   * component test want, and what the reader must never ship.
   */
  readonly onOpenVerse?: ((target: BadgeSheetTarget) => void) | undefined;
}

/**
 * Render one badge's full context.
 *
 * @param props - See {@link BadgeDetailProps}.
 * @returns The heading, the teaser and its attribution, the registered body if there is one,
 *   any evidence beyond the sources, and the sources. Side effects: none beyond `onOpenVerse`.
 */
export function BadgeDetail({ badge, onOpenVerse }: BadgeDetailProps): JSX.Element {
  const theme = useTheme();
  const hue = themeBadgeKind(badge.kind);
  const renderBody = useBadgeSheetRenderer(hue);
  const reference = badgeReference(badge.anchor.verse);
  const claim = interpretiveClaimOf(badge);

  // Memoised so a body registered through the slot is not handed a new `actions` object on
  // every render, which would defeat any memoisation the body itself applies.
  const actions = useMemo(
    () => (onOpenVerse === undefined ? NO_BADGE_SHEET_ACTIONS : { openVerse: onOpenVerse }),
    [onOpenVerse],
  );

  return (
    <View testID={`badge-detail-${badge.id}`} style={styles.detail}>
      <View style={styles.heading}>
        <BadgePill kind={hue} testID={`badge-detail-pill-${hue}`} />
        <Text style={[styles.reference, { color: theme.ink.tertiary }]}>
          {reference} · {badge.anchor.text}
        </Text>
      </View>

      <View style={styles.claim}>
        <Text
          testID="badge-detail-teaser"
          accessibilityLabel={attributedTeaserLabel(badge.teaser, claim)}
          style={[styles.teaser, { color: theme.ink.primary }]}
        >
          {badge.teaser}
        </Text>
        {claim === undefined ? null : (
          <BadgeClaimMark claim={claim} testID={`badge-claim-${badge.id}`} />
        )}
      </View>

      {renderBody === undefined ? null : (
        <View style={styles.body}>{renderBody(badge, actions)}</View>
      )}

      <BadgeEvidence
        citations={badge.citations}
        sources={badge.sources}
        testID={`badge-evidence-${badge.id}`}
      />
      <BadgeAttribution sources={badge.sources} testID={`badge-sources-${badge.id}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  reference: metadataText('sm'),
  // The mark sits beside the claim rather than under it, and wraps to its own line when the
  // surface is too narrow to hold both — `Q-015` asks for inline, not for a second block.
  claim: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  teaser: { ...uiText('md'), flexShrink: 1, minWidth: 0 },
  body: { gap: spacing.md },
});
