/**
 * What a tapped verse opens.
 *
 * Purpose
 *   Pillar 2 — point-of-need intelligence — has no delivery surface until a verse can be
 *   opened. Tapping one used to highlight it and nothing else: the selection was real, the
 *   store held it, and the reader was shown no consequence. This is that consequence, and
 *   it is deliberately the *same body* in both of its homes, so the phone sheet and the
 *   tablet rail cannot drift.
 *
 * What it does not do
 *   It does not invent context. Maps, roots, variants and structure are enrichment the
 *   server has not delivered yet (`Q-007`: enrichment is server-side, never bundled), and
 *   pillar 3 says an uncited claim is not rendered. So the panel shows the reference, the
 *   verse as it stands, and an honest sentence about what will arrive here — never a
 *   placeholder dressed as a finding.
 *
 * It does not scroll itself
 *   Both of its homes already scroll — `ReaderSheet`'s body and the rail's own `ScrollView`.
 *   A second scroller nested inside either one measures zero height inside a scroll content
 *   container, which is a blank sheet that looks like a missing feature.
 *
 * Dependencies
 *   `@/theme`, the reader's theme hook, and `ReaderButton`. No queries, no navigation.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { metadataText, scriptureText, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { ReaderButton } from './ReaderButton';

/** What the detail surface shows. */
export interface VerseDetailProps {
  /** The full reference, e.g. `Acts 1:8`. */
  readonly reference: string;
  /** The verse itself, as the API sent it. */
  readonly text: string;
  /** Close the surface and clear the selection. */
  readonly onClose: () => void;
}

/** The one sentence this panel is allowed to say about enrichment it does not have. */
const PENDING_CONTEXT =
  'Maps, word roots, manuscript variants and literary structure arrive here, beside the verse. Nothing is shown until it carries a citation.';

/**
 * Render the verse detail body.
 *
 * @param props - See {@link VerseDetailProps}.
 * @returns The panel. Side effects: none beyond `onClose`.
 */
export function VerseDetail({ reference, text, onClose }: VerseDetailProps): JSX.Element {
  const theme = useTheme();

  return (
    <View testID="verse-sheet" style={styles.root}>
      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text style={[styles.eyebrow, { color: theme.accent.cyan }]}>Verse</Text>
          <Text
            testID="verse-sheet-reference"
            accessibilityRole="header"
            style={[styles.reference, { color: theme.ink.primary }]}
          >
            {reference}
          </Text>
        </View>
        <ReaderButton
          label="Close"
          onPress={onClose}
          testID="verse-sheet-close"
          accessibilityLabel={`Close ${reference}`}
        />
      </View>

      <Text style={[styles.verse, { color: theme.ink.primary }]}>{text}</Text>
      <Text style={[styles.pending, { color: theme.ink.secondary }]}>{PENDING_CONTEXT}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  heading: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headingText: { flex: 1, minWidth: 0, gap: spacing.xs },
  eyebrow: metadataText('md', 'medium'),
  reference: uiText('xl', 'semiBold'),
  verse: scriptureText('sm'),
  pending: uiText('sm'),
});
