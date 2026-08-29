/**
 * The reader's context rail, and what it holds when nothing is open.
 *
 * Purpose
 *   At and above 600 dp a selected verse — or a tapped badge — opens *beside* the scripture
 *   rather than over it: `Q-006`'s parity, and the shortest possible route from "I am reading
 *   this" to "tell me about it" (pillar 2). Below that width the same bodies are sheets;
 *   `VerseDetail` and `BadgeDetail` are shared so the two paths can never say different
 *   things.
 *
 * A badge outranks a verse
 *   Both can be open at once — tapping a pill inside a verse selects neither of them
 *   exclusively — and the rail has one slot. The badge wins, because it is the more specific
 *   thing the reader asked for and because it is the newer of the two actions. Closing it
 *   falls back to the verse rather than to the resting state, so the reader lands where they
 *   were rather than at the beginning.
 *
 * The resting state is a real state
 *   An empty rail reads as a broken rail. When nothing is open the panel says what the space
 *   is for and how to fill it — `flutter-port-map.md` §7.4's rule that loading, empty and
 *   error are three different screens applies to a rail as much as to a canvas.
 *
 * The list ends deliberately
 *   The rail scrolls, and its content container carries a bottom inset so the last line stops
 *   short of the window edge rather than being sliced through the middle.
 *
 * Dependencies
 *   `@/components/split/RailPanel` for the resting surface, `VerseDetail` and the badge
 *   layer's `BadgeDetail` for the two bodies.
 */

import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { badgeLabel } from '@/components/InlineBadge.types';
import { RailPanel } from '@/components/split/RailPanel';
import { metadataText, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { BadgeDetail, themeBadgeKind, type BadgeSheetTarget, type ReaderBadge } from '../badges';

import { ReaderButton } from './ReaderButton';
import { VerseDetail } from './VerseDetail';

/** What the rail needs. */
export interface ContextPanelProps {
  /** The open verse's reference, or `undefined` when no verse is open. */
  readonly reference: string | undefined;
  /** The open verse's text. */
  readonly text: string | undefined;
  /** Clear the verse selection. */
  readonly onClose: () => void;
  /** The open badge, or `undefined` when none is. Takes the rail when present. */
  readonly badge?: ReaderBadge | undefined;
  /** Close the badge, leaving any open verse in place. */
  readonly onCloseBadge?: (() => void) | undefined;
  /**
   * Open a passage from inside the badge's body.
   *
   * The rail does NOT dismiss first: it sits beside the scripture rather than over it, so a
   * reader who follows a cross-reference can see where they landed with the link that took
   * them there still open. That is the difference `verse-target.ts` leaves to the host.
   */
  readonly onOpenBadgeVerse?: ((target: BadgeSheetTarget) => void) | undefined;
}

/** What the rail says before the reader has opened anything. */
const RESTING_COPY =
  'Tap any verse to open it here, beside the text you are reading. Tap a badge inside a verse for its map, timeline, word root or cross-references.';

/**
 * The badge body, headed and closable.
 *
 * Split out so {@link ContextPanel} stays a choice between three states rather than a
 * rendering of one of them.
 *
 * @param props.badge - The open badge.
 * @param props.onClose - Close it.
 * @returns The rail's badge body. Side effects: none beyond `onClose`.
 */
function RailBadge({
  badge,
  onClose,
  onOpenVerse,
}: {
  readonly badge: ReaderBadge;
  readonly onClose: () => void;
  readonly onOpenVerse?: ((target: BadgeSheetTarget) => void) | undefined;
}): JSX.Element {
  const theme = useTheme();
  const title = badgeLabel[themeBadgeKind(badge.kind)];

  return (
    <View testID="reader-context-badge" style={styles.badge}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={[styles.eyebrow, { color: theme.accent.cyan }]}>Context</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.ink.primary }]}>
            {title}
          </Text>
        </View>
        <ReaderButton
          label="Close"
          onPress={onClose}
          testID="badge-rail-close"
          accessibilityLabel={`Close ${title}`}
        />
      </View>
      <BadgeDetail badge={badge} onOpenVerse={onOpenVerse} />
    </View>
  );
}

/**
 * Render the context rail's contents.
 *
 * @param props - See {@link ContextPanelProps}.
 * @returns The badge body, the verse detail, or the resting state — in that order of
 *   precedence. Side effects: none beyond its callbacks.
 */
export function ContextPanel({
  reference,
  text,
  onClose,
  badge,
  onCloseBadge,
  onOpenBadgeVerse,
}: ContextPanelProps): JSX.Element {
  const theme = useTheme();

  if (badge !== undefined && onCloseBadge !== undefined) {
    return (
      <View style={styles.panel}>
        <ScrollView contentContainerStyle={styles.content}>
          <RailBadge badge={badge} onClose={onCloseBadge} onOpenVerse={onOpenBadgeVerse} />
        </ScrollView>
      </View>
    );
  }

  if (reference === undefined || text === undefined) {
    return (
      <RailPanel eyebrow="Context" title="Beside the text" testID="reader-context-resting">
        <Text style={[styles.restingCopy, { color: theme.ink.secondary }]}>{RESTING_COPY}</Text>
      </RailPanel>
    );
  }

  return (
    <View style={styles.panel}>
      <ScrollView contentContainerStyle={styles.content}>
        <VerseDetail reference={reference} text={text} onClose={onClose} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  restingCopy: uiText('sm'),
  badge: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingText: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: metadataText('md', 'medium'),
  title: uiText('xl', 'semiBold'),
});
