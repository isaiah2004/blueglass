/**
 * The reader's context rail, and what it holds when nothing is open.
 *
 * Purpose
 *   At and above 600 dp a selected verse opens *beside* the scripture rather than over it —
 *   `Q-006`'s parity, and the shortest possible route from "I am reading this" to "tell me
 *   about it" (pillar 2). Below that width the same body is a sheet; `VerseDetail` is
 *   shared so the two can never say different things.
 *
 * The resting state is a real state
 *   An empty rail reads as a broken rail. When no verse is open the panel says what the
 *   space is for and how to fill it — `flutter-port-map.md` §7.4's rule that loading, empty
 *   and error are three different screens applies to a rail as much as to a canvas.
 *
 * The list ends deliberately
 *   The rail scrolls, and its content container carries a bottom inset so the last line
 *   stops short of the window edge rather than being sliced through the middle.
 *
 * Dependencies
 *   `@/components/split/RailPanel` for the resting surface, `VerseDetail` for the body.
 */

import type { JSX } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RailPanel } from '@/components/split/RailPanel';
import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { VerseDetail } from './VerseDetail';

/** What the rail needs. */
export interface ContextPanelProps {
  /** The open verse's reference, or `undefined` when nothing is open. */
  readonly reference: string | undefined;
  /** The open verse's text. */
  readonly text: string | undefined;
  /** Clear the selection. */
  readonly onClose: () => void;
}

/** What the rail says before the reader has opened anything. */
const RESTING_COPY = 'Tap any verse to open it here, beside the text you are reading.';

/**
 * Render the context rail's contents.
 *
 * @param props - See {@link ContextPanelProps}.
 * @returns The verse detail, or the resting state. Side effects: none beyond `onClose`.
 */
export function ContextPanel({ reference, text, onClose }: ContextPanelProps): JSX.Element {
  const theme = useTheme();

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
});
