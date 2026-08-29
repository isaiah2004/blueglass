/**
 * The `[3D City]` sheet — an honest site sheet, not a reconstruction.
 *
 * Purpose
 *   `Q-008` and `dataset-validation.md` §4.3 record a confirmed negative: no openly-licensed
 *   3D reconstruction of any biblical city exists, and the nearest candidate is CC BY-NC-ND,
 *   which fails on NonCommercial and again on NoDerivatives. So this sheet does not fake
 *   one. It shows the site: where it is, what modern place it is identified with, how sure
 *   that identification is, how much of the canon names it, and where this chapter does.
 *   Every line of it is a column of the OpenBible gazetteer.
 *
 * The seam
 *   `model/reconstruction.ts` is the interface a commissioned model drops into. When one
 *   exists, `resolveReconstruction` returns it, the sheet renders it above the map, and
 *   nothing else here changes — including the requirement that the model carry its own
 *   attribution, because a 3D reconstruction is an interpretation and `AI-05` does not stop
 *   applying because a claim is made in geometry.
 *
 * The disclosure that is not a footnote
 *   `hasReconstruction` being false is stated in the sheet, in a sentence, not left implied
 *   by the absence of a model. A reader who taps a badge called "3D City" and is shown a
 *   flat map deserves to be told why, and telling them is cheaper than the alternative,
 *   which is them assuming the app is broken.
 *
 * Dependencies
 *   The city view model, the reconstruction seam, `CitySiteMap`, `StatRow`.
 */

import { useMemo, type JSX } from 'react';
import { Text, View } from 'react-native';

import { StatRow } from '@/components/surface/StatRow';
import { radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useIsReduceMotionEnabled, useTheme } from '@/theme/runtime';

import { toCityView } from '../model/city-view';
import {
  NO_RECONSTRUCTIONS,
  resolveReconstruction,
  type CityReconstructionRegistry,
} from '../model/reconstruction';
import type {
  CitySheetPayload,
  SheetChrome,
  SpatialSheetSources,
} from '../model/spatial-payload.types';

import { CitySiteMap } from './CitySiteMap';
import { SheetHeading } from './SheetHeading';
import { SpatialSourceStrip } from './SpatialSourceStrip';

/** Inputs to {@link CitySiteSheet}. */
export interface CitySiteSheetProps extends SpatialSheetSources {
  /** The badge's payload, straight from the envelope. */
  readonly payload: CitySheetPayload;
  /**
   * Where to look for a 3D reconstruction. Defaults to the empty registry M2 ships, which
   * is the truth; a future build passes a populated one and this component does not change.
   */
  readonly reconstructions?: CityReconstructionRegistry;
  /**
   * `full` (the default) draws the heading and the source strip; `body` omits both, for a
   * host such as `BadgeDetail` that already draws them. See {@link SheetChrome}.
   */
  readonly chrome?: SheetChrome;
}

/** The eyebrow above the title, naming the badge kind. */
const EYEBROW = 'SITE';

/** Stated in the sheet when no reconstruction exists. See the module header. */
const NO_MODEL_NOTE =
  'No openly licensed 3D reconstruction of this site exists, so this sheet shows the ' +
  'gazetteer record rather than a model of the city.';

/** Heading above the list of verses in this chapter that name the place. */
const MENTIONS_HEADING = 'Named in this chapter at';

/**
 * Render the site sheet's content.
 *
 * @param props - See {@link CitySiteSheetProps}.
 * @returns The sheet body.
 *
 * Side effects: none.
 */
export function CitySiteSheet({
  payload,
  sources,
  reconstructions = NO_RECONSTRUCTIONS,
  chrome = 'full',
}: CitySiteSheetProps): JSX.Element {
  const styles = useStyles(useTheme());
  const isReduceMotionEnabled = useIsReduceMotionEnabled();
  const view = useMemo(() => toCityView(payload), [payload]);
  const model = resolveReconstruction(
    reconstructions,
    payload.location.placeId,
    payload.hasReconstruction,
  );

  return (
    <View style={styles.sheet} testID="spatial-city-sheet">
      {chrome === 'full' ? (
        <SheetHeading eyebrow={EYEBROW} title={view.title} subtitle={view.modernLabel} />
      ) : null}
      {model === null ? null : (
        <View style={styles.map} testID="spatial-city-reconstruction">
          <model.render placeId={payload.location.placeId} reducedMotion={isReduceMotionEnabled} />
        </View>
      )}
      <CitySiteMap
        coordinates={view.location.coordinates}
        name={view.title}
        featureType={view.location.featureType}
        style={styles.map}
      />
      <StatRow stats={view.stats} />
      <View style={styles.facts}>
        <Text style={styles.coordinates}>{view.coordinateLabel}</Text>
        {view.sharedNameNote === null ? null : (
          <Text style={styles.note} testID="spatial-city-shared-name">
            {view.sharedNameNote}
          </Text>
        )}
        <Text style={styles.note}>{view.precisionNote}</Text>
        {model === null ? <Text style={styles.note}>{NO_MODEL_NOTE}</Text> : null}
      </View>
      {view.mentions.length === 0 ? null : (
        <View style={styles.facts}>
          <Text style={styles.mentionsHeading}>{MENTIONS_HEADING}</Text>
          <Text style={styles.mentions}>{view.mentions.join(' · ')}</Text>
        </View>
      )}
      {chrome === 'full' ? <SpatialSourceStrip sources={sources} /> : null}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  sheet: { gap: spacing.lg },
  map: { borderRadius: radius.card, overflow: 'hidden' },
  facts: { gap: spacing.xs },
  // Gold marks the place itself, matching the pin on the map above it (§8, and
  // `theme/map-palette.ts`).
  coordinates: { ...uiText('sm', 'medium'), color: theme.accent.gold },
  note: { ...uiText('sm'), color: theme.ink.secondary },
  mentionsHeading: { ...uiText('sm', 'medium'), color: theme.ink.primary },
  mentions: { ...uiText('sm'), color: theme.ink.secondary },
}));
