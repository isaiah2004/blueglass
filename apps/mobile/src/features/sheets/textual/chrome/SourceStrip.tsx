/**
 * SourceStrip — the attribution `AI-05` requires at the foot of every sheet.
 *
 * Purpose
 *   Decision `AI-05`: *every badge payload names its source and licence, and the UI
 *   displays the attribution.* This is that display. It is not decoration and it is not
 *   optional: `TextualSheet` refuses to render a payload whose sources cannot be printed,
 *   so if a sheet is on screen, this strip is on screen with it.
 *
 * Responsibilities
 *   - Owns: how an attribution line and its licence identifier are laid out and coloured.
 *   - Does NOT own: whether there is anything to print. `model/provenance` decides that,
 *     and it is called by the sheet, not by this component — a strip that silently rendered
 *     nothing would let an unattributed payload through.
 *
 * Why the attribution line is printed verbatim
 *   `attribution` is the wording the licence obliges us to reproduce. Truncating it,
 *   title-casing it, or replacing it with the dataset's name would be a licence breach
 *   dressed up as a design decision, so it is rendered whole and allowed to wrap.
 *
 * Accessibility
 *   The strip is one `contentinfo` landmark labelled with `provenanceSummary`, so a screen
 *   reader can answer "where did this come from?" in one stop instead of four.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import type { SourceAttribution } from '@atlas/shared';
import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { printableSources, provenanceSummary } from '../model/provenance';

/** Inputs to {@link SourceStrip}. */
export interface SourceStripProps {
  /** Every provenance entry the badge envelope carries. */
  readonly sources: readonly SourceAttribution[];
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** The strip's own label, so the section is findable rather than an unnamed block. */
const STRIP_EYEBROW = 'SOURCES';

/**
 * The attribution strip.
 *
 * @param props - See {@link SourceStripProps}.
 * @returns The strip, or nothing when no entry is printable. A caller that can reach the
 *   empty case has skipped the `hasProvenance` gate and is showing an unattributed claim.
 *
 * Side effects: none.
 */
export function SourceStrip({ sources, testID }: SourceStripProps): JSX.Element | null {
  const styles = useStyles(useTheme());
  const printable = printableSources(sources);

  if (printable.length === 0) {
    return null;
  }

  return (
    <View
      style={styles.strip}
      testID={testID ?? 'textual-sheet-sources'}
      role="contentinfo"
      accessibilityLabel={provenanceSummary(sources)}
    >
      <Text style={styles.eyebrow}>{STRIP_EYEBROW}</Text>
      {printable.map((source) => (
        <View key={source.key} style={styles.entry}>
          <Text style={styles.attribution}>{source.attribution}</Text>
          <View style={styles.licenceRow}>
            <Text style={styles.licence}>{source.license}</Text>
            {source.version === undefined ? null : (
              <Text style={styles.version}>{source.version}</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  strip: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: theme.line.hairline,
  },
  // `ink.tertiary` is allowed here and nowhere else in this file: §3's tracked uppercase
  // label is a rule, not body text, and `Q-017` permits the dim ink for exactly that.
  eyebrow: { ...metadataText('sm', 'bold'), color: theme.ink.tertiary },
  entry: { gap: spacing.xs },
  attribution: { ...uiText('sm'), color: theme.ink.secondary },
  licenceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  licence: {
    ...metadataText('sm', 'medium'),
    color: theme.accent.cyan,
    borderWidth: borderWidth.hairline,
    borderColor: theme.accent.cyanDim,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  version: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
