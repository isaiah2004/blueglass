/**
 * The attribution strip. Decision `AI-05`, made visible.
 *
 * Purpose
 *   "Every claim carries a source anchor or is not shown." The decoder enforces the *or is
 *   not shown* half by dropping any badge that arrives without provenance; this component is
 *   the other half. Wherever an enrichment claim appears — a sheet, the rail, the chapter-end
 *   summary — the licences behind it appear with it.
 *
 * The string is the source's, not ours
 *   Each line is the `attribution` field verbatim, because that is the text the licence
 *   obliges us to print. The client never composes, shortens or prettifies it.
 *
 * The licence is stated once
 *   Most notices name their own licence in their own words — "Cross-references ©
 *   OpenBible.info, CC BY 4.0" — and this strip printed `CC-BY-4.0` again directly beneath,
 *   where the desktop rail broke it after the first hyphen into `CC-` / `BY-4.0`. So the
 *   chip appears only when the sentence does NOT already carry the identifier, and when it
 *   does appear its hyphens cannot be broken (`licenceChip`, `@atlas/shared`). The
 *   share-alike marker is not a repetition — no notice states it — so it is always printed
 *   for a copyleft source.
 *
 * Why it never collapses behind a disclosure
 *   A citation the reader has to go looking for is a citation most readers never see, which
 *   is functionally the same as not having one. It is small, quiet metadata type — but it is
 *   on the page.
 *
 * One line per obligation, not one per source
 *   Two datasets of one project share one attribution sentence. Printing it twice satisfies
 *   nothing and lengthens the tallest block on the page, so `attribution-lines.ts` folds them
 *   — and carries the share-alike flag across the fold, which is the one thing that fold
 *   could have lost.
 *
 * Dependencies
 *   The theme and the metadata typography. No data fetching.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { attributionLines, type AttributionLine } from './attribution-lines';
import type { SourceAttribution } from './badge-models';

/** What the strip needs. */
export interface BadgeAttributionProps {
  /** The sources behind whatever is above it. An empty list renders nothing. */
  readonly sources: readonly SourceAttribution[];
  readonly testID?: string | undefined;
}

/** The heading above the list, in the metadata band (`design-language.md` §3). */
const HEADING = 'Sources';

/** What a copyleft source is marked with. No licensor's notice states this. */
const SHARE_ALIKE = 'share-alike';

/** Between the licence identifier and the share-alike marker, when both are printed. */
const SEPARATOR = ' · ';

/**
 * Render the sources behind a claim.
 *
 * @param props - See {@link BadgeAttributionProps}.
 * @returns The strip, or `null` when there is nothing to attribute — which should never
 *   happen for a rendered badge, and renders as nothing rather than as an empty box if it
 *   does. Side effects: none.
 */
export function BadgeAttribution({ sources, testID }: BadgeAttributionProps): JSX.Element | null {
  const theme = useTheme();

  if (sources.length === 0) {
    return null;
  }

  return (
    <View testID={testID} style={[styles.strip, { borderTopColor: theme.line.hairline }]}>
      <Text style={[styles.heading, { color: theme.ink.tertiary }]}>{HEADING}</Text>
      {attributionLines(sources).map((line) => (
        <AttributionRow key={line.key} line={line} />
      ))}
    </View>
  );
}

/**
 * One notice, with whatever qualifier it still needs.
 *
 * @param props.line - One folded obligation.
 * @returns The verbatim notice, followed by the licence identifier and the share-alike
 *   marker where those add something the notice does not already say. Side effects: none.
 */
function AttributionRow({ line }: { readonly line: AttributionLine }): JSX.Element {
  const theme = useTheme();
  const suffix = qualifier(line);

  return (
    <Text style={[styles.attribution, { color: theme.ink.secondary }]}>
      {line.attribution}
      {suffix === null ? null : (
        <Text style={[styles.licence, { color: theme.ink.tertiary }]}>{` ${suffix}`}</Text>
      )}
    </Text>
  );
}

/**
 * What, if anything, is printed after the notice.
 *
 * @param line - One folded obligation.
 * @returns The licence identifier, the share-alike marker, both, or `null` when the notice
 *   already said everything there is to say. Side effects: none.
 */
function qualifier(line: AttributionLine): string | null {
  const parts = [line.licenseChip, line.shareAlike ? SHARE_ALIKE : null].filter(
    (part): part is string => part !== null,
  );
  return parts.length === 0 ? null : parts.join(SEPARATOR);
}

const styles = StyleSheet.create({
  strip: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: borderWidth.hairline,
    gap: spacing.xs,
  },
  // `ink.tertiary` is allowed here: `Q-017` restricts it to large text, icons and rules, and
  // a section rule's own label is part of the rule.
  heading: metadataText('sm'),
  // Small metadata takes `ink.secondary`, not `ink.tertiary`, which measures 3.36:1 on
  // `bg.card` and fails AA at this size (`DECISIONS.md` C-3, `Q-017`).
  attribution: uiText('xs'),
  licence: metadataText('xs'),
});
