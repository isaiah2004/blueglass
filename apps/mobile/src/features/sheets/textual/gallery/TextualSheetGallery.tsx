/**
 * TextualSheetGallery — the three textual sheets, on a real screen, in a real browser.
 *
 * Purpose
 *   The definition of done in this repo is "proven by clicking through the real UI"
 *   (`DECISIONS.md` §1.5), and these three sheet bodies have two homes that do not exist
 *   yet: the phone bottom sheet and the context rail. This screen renders them at the
 *   widths those homes will hand them, in both palettes, so the layout, the Greek, the
 *   Hebrew and the attribution can all be *looked at* before the host is wired.
 *
 * Why the width is a control and not the window
 *   The three real widths are not three window sizes. A desktop's context rail can be
 *   dragged narrower than a phone's sheet, so resizing the browser does not exercise the
 *   cases that matter. The segmented control sets the container to each of them directly.
 *
 * What it renders
 *   Every badge here is a fixture captured verbatim from `GET /badges/chapters/BSB/Acts/16`,
 *   plus two deliberate diagnostics: a synthetic Hebrew root, because no Hebrew badge exists
 *   in the corpus and right-to-left layout otherwise has no example to check; and a badge
 *   with its provenance removed, which must show none of its content (`AI-05`).
 *
 * Lifetime
 *   A diagnostic, reached only by its URL and linked from nothing (pillar 1: nothing
 *   clutters the reading canvas). It can go once the reader host renders these sheets from
 *   live data and the walkthrough covers them.
 */

import { useState, type JSX } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/controls/SegmentedControl';
import { ThemeToggleButton } from '@/components/controls/ThemeToggleButton';
import { metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import type { TextualBadge } from '../model/textual-payloads';
import { textualSheetTitle } from '../model/sheet-title';
import {
  ACTS_16_14_TEXT,
  CROSS_REF_BADGE,
  HEBREW_ROOT_PROBE,
  HISTORY_BADGE,
  ROOT_BADGE,
} from '../testing/fixtures';
import { TextualSheet } from '../TextualSheet';

/** The three widths the sheets are actually handed, in dp. */
const WIDTHS = { phone: 375, rail: 340, wide: 560 } as const;

/** Which width the gallery is showing. */
type WidthName = keyof typeof WIDTHS;

/** The width options, labelled by the home each one stands for. */
const WIDTH_OPTIONS: readonly SegmentOption<WidthName>[] = [
  { value: 'phone', label: 'Phone sheet' },
  { value: 'rail', label: 'Tablet rail' },
  { value: 'wide', label: 'Wide rail' },
];

/** One card in the gallery: a badge and the note explaining why it is here. */
interface GalleryEntry {
  readonly key: string;
  readonly badge: TextualBadge;
  readonly note: string;
  readonly verseText?: string;
}

/** The badge fixtures, in the order they are most useful to look at. */
const ENTRIES: readonly GalleryEntry[] = [
  {
    key: 'root',
    badge: ROOT_BADGE,
    note: 'Acts 16:14. A word occurring once in the whole New Testament.',
    verseText: ACTS_16_14_TEXT,
  },
  {
    key: 'root-hebrew',
    badge: HEBREW_ROOT_PROBE,
    note: 'SYNTHETIC. No Hebrew root badge exists in the corpus; this exists to check right-to-left layout and that the glyphs render at all.',
  },
  {
    key: 'history',
    badge: HISTORY_BADGE,
    note: 'Acts 16:6-10, dated AD 47. Claudius on the left axis, scripture on the right.',
  },
  {
    key: 'cross-ref',
    badge: CROSS_REF_BADGE,
    note: 'Acts 16:31. Six links, ranked by community votes, with the scripture on the row.',
  },
  {
    key: 'unattributed',
    badge: { ...ROOT_BADGE, sources: [] },
    note: 'AI-05 check. The same Root badge with its provenance removed: it must show none of its content.',
  },
];

/**
 * The gallery screen.
 *
 * @returns The three sheets at a chosen width, in the active palette.
 *
 * Side effects: none beyond the width the reader picks and the theme toggle.
 */
export function TextualSheetGallery(): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const [width, setWidth] = useState<WidthName>('phone');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="textual-sheet-gallery"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Diagnostic</Text>
          <Text style={styles.title} accessibilityRole="header">
            Textual badge sheets
          </Text>
        </View>
        <ThemeToggleButton />
      </View>

      <SegmentedControl
        options={WIDTH_OPTIONS}
        value={width}
        onChange={setWidth}
        accessibilityLabel="Container width"
        testID="gallery-width"
      />

      {ENTRIES.map((entry) => (
        <GalleryCard key={entry.key} entry={entry} width={WIDTHS[width]} />
      ))}
    </ScrollView>
  );
}

/**
 * One sheet in the gallery, boxed to the width its real home would give it.
 *
 * @param props.entry - The badge and its note.
 * @param props.width - The container width in dp.
 * @returns The card.
 *
 * Side effects: none.
 */
function GalleryCard({
  entry,
  width,
}: {
  readonly entry: GalleryEntry;
  readonly width: number;
}): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.card} testID={`gallery-${entry.key}`}>
      <Text style={styles.cardTitle}>{textualSheetTitle(entry.badge)}</Text>
      <Text style={styles.cardNote}>{entry.note}</Text>
      <View style={[styles.box, { width }]}>
        <TextualSheet
          badge={entry.badge}
          verseText={entry.verseText}
          onOpenVerse={NO_NAVIGATION}
          testID={`gallery-sheet-${entry.key}`}
        />
      </View>
    </View>
  );
}

/**
 * The gallery has no reader to navigate, so a tap does nothing.
 *
 * Passing a handler rather than omitting it is deliberate: it is what makes the rows
 * pressable, which is what lets the pressed state be looked at in a browser.
 *
 * @returns Nothing. Side effects: none.
 */
function NO_NAVIGATION(): void {
  return undefined;
}

const useStyles = createThemedStyles((theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.background.canvas },
  content: { padding: spacing.xl, gap: spacing.xxl, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: { ...metadataText('md', 'bold'), color: theme.accent.cyan },
  title: { ...uiText('xxl', 'semiBold'), color: theme.ink.primary },
  card: { gap: spacing.sm },
  cardTitle: { ...uiText('lg', 'semiBold'), color: theme.ink.primary },
  cardNote: { ...uiText('sm'), color: theme.ink.secondary },
  box: {
    maxWidth: '100%',
    padding: spacing.lg,
    backgroundColor: theme.background.elevated,
    borderRadius: radius.sheet,
  },
}));
