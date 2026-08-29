/**
 * LineageSheet — the `[Lineage]` badge's sheet body.
 *
 * Purpose
 *   `docs/product/mockups/image4.png`'s family tree, delivered as three plain-language
 *   sections rather than the mockup's drawn graph: who is in the line, how they connect,
 *   and which of them a messianic prophecy names. See `lineage-rows.ts` for why a list
 *   stands in for the tree this pass.
 *
 * Responsibilities
 *   - Owns: the order of the sections, the badge's hue, and the choice of heading.
 *   - Does NOT own: the sheet chrome, or the wording of a relation sentence — see
 *     `lineage-rows.ts`.
 *
 * The empty prophecy case is real
 *   Most lineages in Acts carry no messianic link at all; that renders as a sentence, not
 *   as a missing section, per `flutter-port-map.md` §7.4.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { ReferenceRow } from '../chrome/ReferenceRow';
import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { LineageSheetBadge } from '../model/textual-payloads';
import { osisTarget, verseLabel, type VerseTarget } from '../model/verse-target';
import { personById, personCaption, relationSentence } from './lineage-rows';

/** Shown when a lineage carries no connection to messianic prophecy. */
const NO_PROPHECY_COPY =
  'No messianic prophecy is linked to this line. Nothing is shown rather than reaching for a connection the sources do not make.';

/** Inputs to {@link LineageSheet}. */
export interface LineageSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: LineageSheetBadge;
  /** Open a passage in the reader. Omitted, the rows are readable but not pressable. */
  readonly onOpenVerse?: ((target: VerseTarget) => void) | undefined;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Lineage]` sheet body.
 *
 * @param props - See {@link LineageSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none beyond `onOpenVerse`.
 */
export function LineageSheet({
  badge,
  onOpenVerse,
  chrome = 'full',
  testID,
}: LineageSheetProps): JSX.Element {
  const theme = useTheme();
  const tint = theme.badge.lineage.tint;
  const { payload, anchor } = badge;
  const focusPerson = personById(payload.people, payload.focusPersonId);
  const sentences = payload.relations
    .map((relation) => relationSentence(relation, payload.people))
    .filter((sentence): sentence is string => sentence !== undefined);

  return (
    <View style={styles.sheet} testID={testID ?? 'lineage-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Lineage"
          tint={tint}
          title={focusPerson?.name ?? 'Family tree'}
          reference={verseLabel(anchor.verse)}
          summary={focusPerson === undefined ? undefined : personCaption(focusPerson)}
        />
      )}

      <SheetSection
        eyebrow="People in this line"
        badgeTint={tint}
        caption={`${String(payload.people.length)} figures`}
        testID="lineage-people"
      >
        {payload.people.map((person) => {
          const destination =
            person.introducedAtOsis === undefined
              ? undefined
              : osisTarget(person.introducedAtOsis, person.name);

          return (
            <ReferenceRow
              key={person.id}
              testID={`lineage-person-${person.id}`}
              reference={person.name}
              text={personCaption(person)}
              onPress={
                onOpenVerse === undefined || destination === undefined
                  ? undefined
                  : () => {
                      onOpenVerse(destination);
                    }
              }
              accessibilityLabel={
                destination === undefined ? person.name : `Open ${destination.label}`
              }
            />
          );
        })}
      </SheetSection>

      <SheetSection eyebrow="How they connect" badgeTint={tint} testID="lineage-relations">
        {sentences.length === 0 ? (
          <Text style={[styles.empty, { color: theme.ink.secondary }]} testID="lineage-relations-empty">
            No relationships are recorded for this line.
          </Text>
        ) : (
          sentences.map((sentence) => (
            <Text key={sentence} style={[styles.sentence, { color: theme.ink.primary }]}>
              {sentence}
            </Text>
          ))
        )}
      </SheetSection>

      <SheetSection
        eyebrow="Prophetic fulfillment"
        badgeTint={tint}
        testID="lineage-prophecy"
      >
        {payload.messianicLinks.length === 0 ? (
          <Text style={[styles.empty, { color: theme.ink.secondary }]} testID="lineage-prophecy-empty">
            {NO_PROPHECY_COPY}
          </Text>
        ) : (
          payload.messianicLinks.map((link) => {
            const person = personById(payload.people, link.personId);
            const destination = osisTarget(link.prophecyOsis);

            return (
              <ReferenceRow
                key={`${link.personId}-${link.prophecyOsis}`}
                testID={`lineage-prophecy-${link.personId}`}
                reference={destination?.label ?? link.prophecyOsis}
                text={link.note}
                note={person === undefined ? undefined : `Concerning ${person.name}`}
                onPress={
                  onOpenVerse === undefined || destination === undefined
                    ? undefined
                    : () => {
                        onOpenVerse(destination);
                      }
                }
              />
            );
          })
        )}
      </SheetSection>

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="lineage-sources" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { gap: spacing.xl },
  empty: uiText('sm'),
  sentence: { ...uiText('sm'), marginBottom: spacing.xs },
});
