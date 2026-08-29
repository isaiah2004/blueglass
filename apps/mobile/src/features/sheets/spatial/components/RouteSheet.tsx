/**
 * The `[Route]` sheet.
 *
 * Purpose
 *   What a reader sees when they tap the Route badge: the passage's geography — every place
 *   it names, where each one is, and how much of the world they span. It is the interaction
 *   the whole product exists for, so its contract is narrow — a payload in, a rendered sheet
 *   out. It fetches nothing, opens nothing, and knows nothing about whether it is inside a
 *   bottom sheet or a context rail.
 *
 * Where the method line sits, and why that is not cosmetic
 *   `view.schemeLabel` — "Places named in this chapter, in the order the text names them" —
 *   is printed immediately under the heading, ABOVE the map and the figures. It used to sit
 *   below all three, where it qualified nothing a reader had not already read as a journey.
 *   A caveat printed after the claim is not a caveat.
 *
 * Why it does not own its own container
 *   `design-language.md` §4 and `Q-006`: below 600 dp this content is a bottom sheet
 *   covering half the screen; at and above it, the same content renders in the context rail
 *   beside the scripture. Owning a `Modal` here would make the rail impossible. The host
 *   supplies the container; this component supplies the content, and both layouts get the
 *   identical thing.
 *
 * The stat strip's honesty
 *   `PLACES` counts the pins; `SPAN` is how far apart the two furthest-apart of them are,
 *   which is order-independent and therefore cannot be read as a distance anyone covered.
 *   There is no duration and no path length. `model/route-view.ts` has the reasoning.
 *
 * Dependencies
 *   The route view model, `RouteMap`, `StatRow`, `RoutePlaceList`, `SpatialSourceStrip`.
 */

import { useMemo, type JSX } from 'react';
import { Text, View } from 'react-native';

import { StatRow } from '@/components/surface/StatRow';
import { radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { toRouteView } from '../model/route-view';
import type {
  RouteSheetPayload,
  SheetChrome,
  SpatialSheetSources,
} from '../model/spatial-payload.types';

import { RouteMap } from './RouteMap';
import { RoutePlaceList } from './RoutePlaceList';
import { SheetHeading } from './SheetHeading';
import { SpatialSourceStrip } from './SpatialSourceStrip';

/** Inputs to {@link RouteSheet}. */
export interface RouteSheetProps extends SpatialSheetSources {
  /** The badge's payload, straight from the envelope. */
  readonly payload: RouteSheetPayload;
  /**
   * `full` (the default) draws the heading and the source strip; `body` omits both, for a
   * host such as `BadgeDetail` that already draws them. See {@link SheetChrome}.
   */
  readonly chrome?: SheetChrome;
}

/** The eyebrow above the title, naming the badge kind. */
const EYEBROW = 'ROUTE';

/**
 * Render the Route sheet's content.
 *
 * @param props - See {@link RouteSheetProps}.
 * @returns The sheet body.
 *
 * Side effects: none beyond the map's draw animation.
 */
export function RouteSheet({ payload, sources, chrome = 'full' }: RouteSheetProps): JSX.Element {
  const styles = useStyles(useTheme());
  const view = useMemo(() => toRouteView(payload), [payload]);
  // `view.mapPins`, not `view.places`: two places at one coordinate are one dot, and the
  // mark carries both names rather than the second being painted invisibly over the first.
  const pins = view.mapPins;

  return (
    <View style={styles.sheet} testID="spatial-route-sheet">
      {chrome === 'full' ? (
        <SheetHeading eyebrow={EYEBROW} title={view.title} subtitle={view.passageLabel} />
      ) : null}
      <Text style={styles.scheme}>{view.schemeLabel}</Text>
      <RouteMap
        pins={pins}
        title={view.title}
        variant={view.isMentionOrder ? 'mentionOrder' : 'route'}
        style={styles.map}
      />
      <StatRow stats={view.stats} />
      <RoutePlaceList places={view.places} />
      {chrome === 'full' ? <SpatialSourceStrip sources={sources} /> : null}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  sheet: { gap: spacing.lg },
  // `overflow: hidden` clips the sea rectangle to the rounded corner rather than letting
  // it square the card off — the same reason `components/surface/Card` clips its gradient.
  map: { borderRadius: radius.card, overflow: 'hidden' },
  // Directly under the heading: it is the method behind everything below it.
  scheme: { ...uiText('xs'), color: theme.ink.secondary, marginTop: -spacing.sm },
}));
