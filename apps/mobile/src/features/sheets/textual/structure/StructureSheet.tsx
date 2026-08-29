/**
 * StructureSheet — the `[Structure]` badge's sheet body.
 *
 * Purpose
 *   The Poetic Chiasm / literary-shape sheet: the passage's form (`literaryType`), and its
 *   nodes in reading order with each one's mirror shown alongside it, so a reader can see
 *   the symmetry (A → B → C → B′ → A′) without a drawn graph.
 *
 * Responsibilities
 *   - Owns: the order of the sections and the badge's hue.
 *   - Does NOT own: the pairing logic — see `structure-nodes.ts`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/surface/Card';
import { metadataText, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { SheetHeading } from '../chrome/SheetHeading';
import { SheetSection } from '../chrome/SheetSection';
import { SourceStrip } from '../chrome/SourceStrip';
import type { SheetChrome } from '../model/sheet-chrome';
import type { StructureSheetBadge } from '../model/textual-payloads';
import { verseLabel } from '../model/verse-target';
import { mirrorLine } from './structure-nodes';

/** Inputs to {@link StructureSheet}. */
export interface StructureSheetProps {
  /** The badge, envelope and payload. */
  readonly badge: StructureSheetBadge;
  /** `full` (the default) draws the heading and the source strip; `body` omits both. */
  readonly chrome?: SheetChrome;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * The `[Structure]` sheet body.
 *
 * @param props - See {@link StructureSheetProps}.
 * @returns The sheet's content, top to bottom.
 *
 * Side effects: none.
 */
export function StructureSheet({
  badge,
  chrome = 'full',
  testID,
}: StructureSheetProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const tint = theme.badge.structure.tint;
  const { payload, anchor } = badge;

  return (
    <View style={sheetStyles.sheet} testID={testID ?? 'structure-sheet'}>
      {chrome === 'body' ? null : (
        <SheetHeading
          eyebrow="Structure"
          tint={tint}
          title={payload.literaryType}
          reference={verseLabel(anchor.verse)}
          summary={payload.summary}
        />
      )}

      <SheetSection
        eyebrow="Reading order"
        badgeTint={tint}
        caption={`${String(payload.nodes.length)} nodes`}
        testID="structure-nodes"
      >
        <View style={styles.nodeList}>
          {payload.nodes.map((node) => {
            const mirror = mirrorLine(node, payload.nodes);

            return (
              <Card key={node.id} style={styles.nodeCard} testID={`structure-node-${node.id}`}>
                <View style={styles.nodeHeader}>
                  <Text style={[styles.symmetryLabel, { color: tint }]}>{node.symmetryLabel}</Text>
                  <Text style={styles.depth}>{`depth ${String(node.depth)}`}</Text>
                </View>
                <Text style={styles.nodeText}>{node.text}</Text>
                {mirror === undefined ? null : (
                  <Text style={[styles.mirror, { color: theme.ink.secondary }]}>{mirror}</Text>
                )}
              </Card>
            );
          })}
        </View>
      </SheetSection>

      {chrome === 'body' ? null : (
        <SourceStrip sources={badge.sources} testID="structure-sources" />
      )}
    </View>
  );
}

const sheetStyles = StyleSheet.create({ sheet: { gap: spacing.xl } });

const useStyles = createThemedStyles((theme: Theme) => ({
  nodeList: { gap: spacing.md },
  nodeCard: { padding: spacing.md, gap: spacing.xs },
  nodeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  symmetryLabel: metadataText('md', 'bold'),
  depth: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
  nodeText: uiText('sm'),
  mirror: uiText('xs'),
}));
