/**
 * The phone's home for a tapped verse: docked under the canvas, not floating over it.
 *
 * Purpose
 *   Below 600 dp there is no rail to put the verse detail in. The obvious answer is a modal
 *   sheet, and it is the wrong one: a modal takes the scripture's pointer events with it,
 *   so a reader who has opened Acts 1:1 and wants Acts 1:8 has to close the sheet, find the
 *   verse, and tap again. That is a detour, and pillar 2 exists to remove detours.
 *
 * What docking buys
 *   The canvas above keeps its own scroll and stays tappable, so tapping a second verse
 *   simply updates the panel — which is what `design-language.md` §4 means by "that visible
 *   scripture is the whole point of the interaction". It also makes an entire class of bug
 *   impossible: there is no scrim to leave mounted over a chapter the reader can no longer
 *   touch.
 *
 * It still reads as a sheet
 *   Rounded top, hairline, grab handle, elevated surface — the same object the navigator
 *   and the translation switcher use, minus the modality it did not need.
 *
 * Dependencies
 *   `VerseDetail` for the body, shared with the rail so the two cannot drift.
 */

import type { JSX } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { borderWidth, radius, size, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { VerseView } from '../model/verse-view';

import { VerseDetail } from './VerseDetail';

/** What the dock needs. */
export interface VerseDockProps {
  /** The open verse, or `undefined` when nothing is open or a rail is showing it instead. */
  readonly verse: VerseView | undefined;
  /** Clear the selection. */
  readonly onClose: () => void;
}

/**
 * The most of the screen the dock may take.
 *
 * `design-language.md` §4 puts a sheet over "the bottom half"; a docked panel can afford
 * less, because the reader is meant to keep reading while it is open.
 */
const DOCK_MAX_HEIGHT = '45%';

/**
 * Render the docked verse detail.
 *
 * @param props - See {@link VerseDockProps}.
 * @returns The panel, or `null` when no verse is open.
 *
 * Side effects: none beyond `onClose`.
 */
export function VerseDock({ verse, onClose }: VerseDockProps): JSX.Element | null {
  const theme = useTheme();

  if (verse === undefined) return null;

  return (
    <View
      accessibilityViewIsModal={false}
      // `role`, not `accessibilityRole`: React Native's own role list has no
      // `complementary`, and the W3C `role` prop it added in 0.71 does.
      role="complementary"
      style={[
        styles.dock,
        { backgroundColor: theme.background.elevated, borderColor: theme.line.hairline },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.line.strong }]} />
      <ScrollView contentContainerStyle={styles.body}>
        <VerseDetail reference={verse.reference} text={verse.text} onClose={onClose} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    maxHeight: DOCK_MAX_HEIGHT,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderTopWidth: borderWidth.hairline,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    width: size.grabHandle.width,
    height: size.grabHandle.height,
    borderRadius: radius.pill,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  body: { paddingBottom: spacing.xxl },
});
