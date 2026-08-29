/**
 * The places a passage names, listed under its map.
 *
 * Purpose
 *   The map declutters — with sixteen pins in Acts 16 it must, or the names cover the
 *   coastline (`label-declutter.ts`). This list is where the dropped names go, so nothing
 *   the payload contains is unreachable. It also answers the question the map cannot: which
 *   verse names each place.
 *
 * Why there is no distance column
 *   There was one, and it printed the great-circle gap from the row above under the heading
 *   `stop 04 Jerusalem, 449 MI`. The rows are the places the chapter NAMES, in the order it
 *   names them, so that figure measured a leg of a journey nobody made — Acts 16:4 names
 *   Jerusalem as where the decisions were taken and Paul does not go there. The number was
 *   arithmetically correct and told the reader something false, which is the exact failure
 *   `AI-05` and pillar 3 forbid. The verse reference took its place: it is the fact the
 *   reader can check against the text on the same screen.
 *
 * Why a list and not a scroll-to-zoom map
 *   Pillar 1: nothing floats over scripture, and pillar 2 says context arrives where the
 *   reader already is. A reader in a bottom sheet with the scripture visible above it
 *   should not have to learn a gesture to read a place name.
 *
 * Dependencies
 *   The route view model and the tokens. No SVG.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { identificationLine } from '../model/identification';
import type { RoutePlace } from '../model/route-view';

/** Inputs to {@link RoutePlaceList}. */
export interface RoutePlaceListProps {
  /** The places, in the order the text names them. */
  readonly places: readonly RoutePlace[];
}

/**
 * List the places.
 *
 * @param props - See {@link RoutePlaceListProps}.
 * @returns One row per place.
 *
 * Side effects: none.
 */
export function RoutePlaceList({ places }: RoutePlaceListProps): JSX.Element {
  const styles = useStyles(useTheme());

  return (
    <View style={styles.list} testID="spatial-place-list">
      {places.map((place) => (
        <View key={place.key} style={styles.row} accessibilityLabel={rowLabel(place)}>
          <Text style={styles.position}>{String(place.position).padStart(2, '0')}</Text>
          <View style={styles.body}>
            <Text style={styles.name}>{place.location.name}</Text>
            <Text style={styles.meta}>{metaLine(place)}</Text>
          </View>
          <Text style={styles.verse}>{place.verseLabel ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * The row's second line: what kind of place it is, and every way it is not the only one.
 *
 * `DECISIONS.md` #10. Nine ancient places are called Ramah and 1,122 of the canon's
 * waypoints carry a shared name; a row that printed only `settlement` presented one of
 * them as the settled identification.
 *
 * The last clause is the other half of the same honesty. 1 Samuel 1 teases "3 places named
 * in this chapter" and the gazetteer pins Ramathaim-zophim and Ramah at one coordinate, so
 * the map has two marks on it. Saying which two names share a site is what makes the count
 * and the picture agree.
 */
function metaLine(place: RoutePlace): string {
  const base = identificationLine(
    place.location.featureType,
    place.location.sharedNameCount,
    place.location.candidateCount,
  );
  if (place.coLocatedWith.length === 0) return base;
  return `${base} · Same site as ${place.coLocatedWith.join(', ')}`;
}

/** One row, read out as a sentence. */
function rowLabel(place: RoutePlace): string {
  const verse = place.verseLabel === null ? '' : `, named in ${place.verseLabel}`;
  return `Place ${String(place.position)}, ${place.location.name}${verse}. ${metaLine(place)}`;
}

const useStyles = createThemedStyles((theme: Theme) => ({
  list: { gap: spacing.none },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: theme.line.hairline,
  },
  // Gold is the reader's own reading (§8), and the numbers are the reading order.
  position: {
    ...metadataText('sm', 'medium'),
    color: theme.accent.gold,
    borderRadius: radius.pill,
  },
  body: { flex: 1, gap: spacing.xs },
  name: { ...uiText('md', 'medium'), color: theme.ink.primary },
  meta: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
  verse: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
}));
