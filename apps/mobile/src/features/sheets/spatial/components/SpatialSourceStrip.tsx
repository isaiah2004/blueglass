/**
 * The attribution strip under every spatial sheet.
 *
 * Purpose
 *   Decision `AI-05`: "every badge payload names its source and licence, and the UI
 *   displays attribution. A badge with no provenance must not render." The second half of
 *   that sentence is this component, and the first half is `model/attribution.ts`, which
 *   this component's parents consult before rendering anything at all.
 *
 * What it prints, and why verbatim
 *   Each line is the source's own `attribution` string, unaltered. CC BY 4.0 obliges us to
 *   keep the notice the licensor supplied; paraphrasing it is a licence breach dressed up
 *   as copy-editing.
 *
 * The licence is stated once
 *   Most of those notices already name their licence — "Place data © OpenBible.info, CC BY
 *   4.0" — so a second line reading `CC-BY-4.0` underneath says nothing new and, in a
 *   narrow rail, breaks after its first hyphen. The identifier is therefore printed only
 *   where the notice does not carry it (Natural Earth names none), and always as an
 *   unbreakable token. The share-alike note is never suppressed: no licensor's notice
 *   states it, and it is the flag `Q-007` turns on.
 *
 * Share-alike
 *   `Q-007` is the decision that we never redistribute the database, which is what keeps
 *   the copyleft sources from obliging us to relicense. A share-alike source is therefore
 *   marked in the strip: it is the flag that says "this row may not be bundled", and having
 *   it visible in the product is cheaper than having it only in a migration.
 *
 * Dependencies
 *   `../model/attribution`, the typography and colour tokens.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { attributionLines, type AttributionLine } from '../model/attribution';
import type { SpatialSheetSources } from '../model/spatial-payload.types';

/** The strip's own heading. */
const HEADING = 'SOURCES';

/** What a copyleft source is marked with. */
const SHARE_ALIKE_NOTE = 'Share-alike · server-delivered only';

/** Between the licence identifier and the share-alike note, when both are printed. */
const SEPARATOR = ' · ';

/**
 * Print the sources a sheet rests on.
 *
 * @param props - The badge's sources; the basemap's own line is added by the model.
 * @returns The strip.
 *
 * Side effects: none.
 */
export function SpatialSourceStrip({ sources }: SpatialSheetSources): JSX.Element {
  const styles = useStyles(useTheme());
  const lines = attributionLines(sources).map((line) => ({ line, suffix: qualifier(line) }));

  return (
    <View style={styles.strip} testID="spatial-source-strip" accessibilityLabel="Sources">
      <Text style={styles.heading}>{HEADING}</Text>
      {lines.map(({ line, suffix }) => (
        <View key={line.key} style={styles.line}>
          <Text style={styles.attribution}>{line.label}</Text>
          {suffix === null ? null : <Text style={styles.licence}>{suffix}</Text>}
        </View>
      ))}
    </View>
  );
}

/**
 * The line printed under a notice, or nothing when the notice said it all.
 *
 * @param line - One source's folded attribution.
 * @returns The unbreakable licence identifier, the share-alike note, both, or `null`.
 *   Side effects: none.
 */
function qualifier(line: AttributionLine): string | null {
  const parts = [line.licenseChip, line.shareAlike ? SHARE_ALIKE_NOTE : null].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(SEPARATOR);
}

const useStyles = createThemedStyles((theme: Theme) => ({
  strip: {
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: theme.line.hairline,
  },
  heading: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
  line: { gap: spacing.xs },
  // `Q-017`: 9-11 pt metadata takes `ink.secondary`, never `ink.tertiary`, which is below
  // AA at that size. The attribution line is body-weight because a licence notice a reader
  // cannot read is not a notice.
  attribution: { ...uiText('sm'), color: theme.ink.secondary },
  licence: { ...metadataText('xs', 'medium'), color: theme.accent.cyan },
}));
