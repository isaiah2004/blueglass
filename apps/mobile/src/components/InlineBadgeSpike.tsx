/**
 * InlineBadgeSpike — the body of the `/spike/badges` route.
 *
 * Purpose
 *   Renders Acts 16:11-15 four times, once per candidate strategy, plus a size ladder and a
 *   deliberately narrow column that forces a badge onto a line break. This is the screen the
 *   spike's conclusions were read off; `docs/architecture/spike-inline-badges.md` records
 *   what each section looked like on each platform.
 *
 * How to use it
 *   Run `pnpm web` and open `/spike/badges`, or open the route on a device. Compare the
 *   FOUR passages against each other on the SAME platform first, then compare one strategy
 *   across platforms. The web build alone cannot decide this question: `react-native-web`
 *   honours CSS on a nested `<span>`, so strategy A looks correct there and is rectangular
 *   on both native platforms.
 *
 * Not a product screen
 *   Diagnostic only. It is not routed to from anywhere, has no fetch, and must not grow into
 *   a component gallery — the reader screen this feeds is `features/reader/` (see
 *   `docs/architecture/flutter-port-map.md` §9).
 *
 * Dependencies
 *   `@/theme`, the four badge implementations, and the fixture passage.
 */

import { useState, type JSX, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  metadataText,
  scriptureText,
  spacing,
  uiText,
  type ScriptureStep,
} from '@/theme';

import { InlineBadge } from './InlineBadge';
import { badgeBaselineOffset, badgeGeometry } from './InlineBadge.geometry';
import { actsSixteenPassage, openingVerse, type PassageVerse } from './InlineBadge.passage';
import { InlineBadgeFlowRow } from './InlineBadgeFlowRow';
import { InlineBadgeVerse, type InTextStrategy } from './InlineBadgeVerse';

/** The two verses used wherever a whole passage would only add scrolling. */
const SAMPLE = actsSixteenPassage.slice(0, 2);

/**
 * Width of the line-break stress column, as a fraction of the screen.
 *
 * A layout ratio for a diagnostic, not a design value: it is chosen only because it is
 * narrow enough to push a badge onto a wrap at every scripture size on a phone.
 */
const STRESS_COLUMN_FRACTION = '62%';

/** The scripture sizes the ladder walks, smallest first. */
const LADDER: readonly ScriptureStep[] = ['sm', 'md', 'lg', 'title'];

/**
 * Render one titled section of the spike.
 *
 * @param props.title - The section heading.
 * @param props.note - What to look for in this section.
 * @param props.children - The section body.
 * @returns A heading, a note, and the body.
 */
function Section({
  title,
  note,
  children,
}: {
  readonly title: string;
  readonly note: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
      {children}
    </View>
  );
}

/**
 * Render the passage with one in-text strategy.
 *
 * @param props.strategy - Which badge implementation.
 * @param props.verses - Which verses to show.
 * @returns The rendered verses.
 */
function Passage({
  strategy,
  verses = actsSixteenPassage,
}: {
  readonly strategy: InTextStrategy;
  readonly verses?: readonly PassageVerse[];
}): JSX.Element {
  return (
    <>
      {verses.map((verse) => (
        <InlineBadgeVerse key={verse.number} verse={verse} strategy={strategy} />
      ))}
    </>
  );
}

/**
 * The measurements the screen reports about itself, so an observation can be written down
 * with the numbers that produced it rather than from memory.
 *
 * @returns A one-line readout of platform, pill height, and the applied baseline nudge.
 */
function readout(): string {
  const geometry = badgeGeometry('md');
  const attached = badgeBaselineOffset('textAttachment', Platform.OS === 'web' ? 'web' : 'android');
  return `${Platform.OS} · pill ${String(geometry.height)}pt · nudge ${String(attached)}pt`;
}

/**
 * The one interactive section: a badge that must still be hit-testable inside a `<Text>`.
 *
 * @returns A pressable badge and a tap counter.
 *
 * Side effects: holds a counter in local state.
 */
function TapTest(): JSX.Element {
  const [taps, setTaps] = useState(0);
  return (
    <Section
      title="Tap test (strategy B)"
      note="An inline view has to stay hit-testable inside a <Text>, or the badge cannot open its sheet. Tap the pill; the counter must advance."
    >
      <Text style={[scriptureText('md'), styles.tapLine]} testID="spike-tap-line">
        One who heard us was a woman named Lydia
        <InlineBadge
          kind="root"
          label="Tap me"
          onPress={() => {
            setTaps((previous) => previous + 1);
          }}
          testID="spike-tap-badge"
        />
        , a seller of purple.
      </Text>
      <Text style={styles.readout} testID="spike-tap-count">{`taps: ${String(taps)}`}</Text>
    </Section>
  );
}

/**
 * The four strategies rendering the same passage.
 *
 * @returns One section per strategy, recommended first.
 */
function StrategySections(): JSX.Element {
  return (
    <>
      <Section
        title="B · inline View (recommended)"
        note="A real <View> inside the verse <Text>. Rounded, padded, and bordered on every platform; wraps as one atom."
      >
        <Passage strategy="inlineView" />
      </Section>

      <Section
        title="A · nested Text"
        note="backgroundColor + borderRadius + padding on a nested <Text>. Rounded here on the web; a bare rectangle with no padding on iOS and Android."
      >
        <Passage strategy="nestedText" verses={SAMPLE} />
      </Section>

      <Section
        title="C · react-native-svg pill"
        note="Same inline-view flow as B, but the shape is an SVG <Rect rx>. Costs one measure pass per badge."
      >
        <Passage strategy="svg" verses={SAMPLE} />
      </Section>

      <Section
        title="D · flex-wrap row of words"
        note="No text nesting at all. Identical on every platform, but the paragraph stops being text: no selection, no real spaces, punctuation detaches."
      >
        {SAMPLE.map((verse) => (
          <InlineBadgeFlowRow key={verse.number} segments={verse.segments} />
        ))}
      </Section>
    </>
  );
}

/**
 * The two sections that stress the recommended strategy rather than compare strategies.
 *
 * @returns The size ladder and the two narrow-column line-break tests.
 */
function DiagnosticSections(): JSX.Element {
  return (
    <>
      <Section
        title="Size ladder (strategy B)"
        note="19 / 20 / 21 / 26 pt scripture. The pill must keep its proportion and never disturb the line rhythm."
      >
        {LADDER.map((step) => (
          <View key={step} style={styles.ladderRow}>
            <Text style={styles.note}>{step}</Text>
            <InlineBadgeVerse verse={openingVerse} strategy="inlineView" scriptureStep={step} />
          </View>
        ))}
      </Section>

      <Section
        title="Line-break stress (strategy B)"
        note="A narrow column, so a badge lands at a wrap. It must move whole to the next line, never split."
      >
        <View style={styles.stressColumn}>
          <Passage strategy="inlineView" verses={SAMPLE} />
        </View>
      </Section>

      <Section
        title="Line-break stress (strategy A)"
        note="The same column with nested-Text badges. On the web CSS slices the box at the wrap and the pill grows square inner corners."
      >
        <View style={styles.stressColumn}>
          <Passage strategy="nestedText" verses={SAMPLE} />
        </View>
      </Section>
    </>
  );
}

/**
 * Render the whole spike screen.
 *
 * @returns A scroll view holding every section.
 *
 * Side effects: none.
 */
export function InlineBadgeSpike(): JSX.Element {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Inline badge spike</Text>
      <Text style={styles.readout}>{readout()}</Text>
      <TapTest />
      <StrategySections />
      <DiagnosticSections />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background.canvas,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    ...scriptureText('title'),
    color: colors.ink.primary,
  },
  section: {
    gap: spacing.sm,
    paddingTop: spacing.xl,
  },
  heading: {
    ...uiText('lg', 'semiBold'),
    color: colors.accent.cyan,
  },
  note: {
    ...uiText('sm'),
    color: colors.ink.secondary,
  },
  readout: {
    ...metadataText('sm'),
    color: colors.accent.gold,
  },
  ladderRow: {
    gap: spacing.xs,
  },
  tapLine: {
    color: colors.ink.primary,
  },
  stressColumn: {
    maxWidth: STRESS_COLUMN_FRACTION,
    borderLeftWidth: borderWidth.focus,
    borderLeftColor: colors.line.hairline,
    paddingLeft: spacing.sm,
  },
});
