/**
 * SpatialSheetGallery — the two spatial sheets, on a real screen, in a real browser.
 *
 * Purpose
 *   The definition of done in this repo is "proven by clicking through the real UI"
 *   (`DECISIONS.md` §1.5). These sheet bodies have two homes that do not exist yet — the
 *   phone bottom sheet and the context rail — and a drawn map is the one thing in the app
 *   that cannot be judged from a test assertion. This screen renders both sheets at the
 *   widths those homes will hand them, in both palettes, so the coastline, the route line,
 *   the pins and the label decluttering can all be *looked at*.
 *
 * Why the width is a control and not the window
 *   The three real widths are not three window sizes: a desktop's context rail can be
 *   dragged narrower than a phone's sheet. Resizing the browser would not exercise the
 *   cases that matter, so the segmented control sets the container directly — and the map's
 *   `onLayout` measurement means changing it re-fits the camera, which is the interesting
 *   half of the test.
 *
 * What it renders
 *   Badges captured verbatim from `GET /badges/chapters/BSB/Acts/16`, plus two deliberate
 *   diagnostics: a two-stop route cut from the same payload, because the twenty-stop chapter
 *   route hides how a short voyage looks; and a badge with its provenance removed, which
 *   must show none of its content (`AI-05`).
 *
 * Lifetime
 *   A diagnostic, reached only by its URL and linked from nothing (pillar 1: nothing
 *   clutters the reading canvas), which is the same contract `/spike/badges` and
 *   `/spike/textual-sheets` run under. It can go once the reader host renders these sheets
 *   from live data and the walkthrough covers them.
 */

import { useState, type JSX } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/controls/SegmentedControl';
import { ThemeToggleButton } from '@/components/controls/ThemeToggleButton';
import { metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { SpatialSheet, type SpatialBadge } from '../components/SpatialSheet';
import { ACTS_16_ROUTE, JERUSALEM_CITY, LYSTRA_CITY, OPENBIBLE_SOURCE } from '../testing/fixtures';

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

/**
 * The Acts 16:11-12 voyage alone — Troas, Samothrace, Neapolis, Philippi.
 *
 * Selected by NAME, not by index. It used to be `waypoints.slice(14, 18)`, and when 0.17.5
 * dropped the unsupported names from the route the window slid off the end of the list: the
 * card silently became a single pin over an empty field. A diagnostic that quietly stops
 * diagnosing is worse than no diagnostic.
 */
const VOYAGE_PLACES: readonly string[] = ['Troas', 'Samothrace', 'Neapolis', 'Philippi'];

const VOYAGE_BADGE: SpatialBadge = {
  sources: [OPENBIBLE_SOURCE],
  payload: {
    ...ACTS_16_ROUTE,
    title: 'Troas to Philippi',
    waypoints: ACTS_16_ROUTE.waypoints.filter((waypoint) => VOYAGE_PLACES.includes(waypoint.name)),
    passage: { startKey: 44016011, endKey: 44016012 },
  },
};

/** One card in the gallery: a badge and the note explaining why it is here. */
interface GalleryEntry {
  readonly key: string;
  readonly badge: SpatialBadge;
  readonly note: string;
}

/** The badge fixtures, in the order they are most useful to look at. */
const ENTRIES: readonly GalleryEntry[] = [
  {
    key: 'voyage',
    badge: VOYAGE_BADGE,
    note: 'Acts 16:11-12, the voyage image1.png draws. Four stops across the Aegean, one of them an island — the case the 1:50m coastline was chosen for.',
  },
  {
    key: 'chapter-route',
    badge: { payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] },
    note: 'The whole chapter: twenty stops, three of them repeats, spanning Anatolia to Macedonia. This is what the label declutterer is for.',
  },
  {
    key: 'city-small',
    badge: { payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] },
    note: 'Lystra. A small site, pinned to a tel, named in six verses of the whole canon.',
  },
  {
    key: 'city-large',
    badge: { payload: JERUSALEM_CITY, sources: [OPENBIBLE_SOURCE] },
    note: 'Jerusalem. The other extreme: 955 verses of the canon name it, and the pin is a modern settlement rather than an excavation.',
  },
  {
    key: 'unattributed',
    badge: { payload: ACTS_16_ROUTE, sources: [] },
    note: 'AI-05 check. The same route badge with its provenance removed: it must show none of its content.',
  },
];

/**
 * The gallery screen.
 *
 * @returns Both sheets at a chosen width, in the active palette.
 *
 * Side effects: none beyond the width the reader picks and the theme toggle.
 */
export function SpatialSheetGallery(): JSX.Element {
  const styles = useStyles(useTheme());
  const [width, setWidth] = useState<WidthName>('phone');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      testID="spatial-sheet-gallery"
    >
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Diagnostic</Text>
          <Text style={styles.title} accessibilityRole="header">
            Spatial badge sheets
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
        <View key={entry.key} style={styles.card} testID={`gallery-${entry.key}`}>
          <Text style={styles.cardNote}>{entry.note}</Text>
          <View style={[styles.box, { width: WIDTHS[width] }]}>
            <SpatialSheet badge={entry.badge} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  screen: { flex: 1, backgroundColor: theme.background.canvas },
  content: { padding: spacing.xl, gap: spacing.xxl, paddingBottom: spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  eyebrow: { ...metadataText('md', 'bold'), color: theme.accent.cyan },
  title: { ...uiText('xxl', 'semiBold'), color: theme.ink.primary },
  card: { gap: spacing.sm },
  cardNote: { ...uiText('sm'), color: theme.ink.secondary },
  box: {
    maxWidth: '100%',
    padding: spacing.lg,
    backgroundColor: theme.background.elevated,
    borderRadius: radius.sheet,
  },
}));
