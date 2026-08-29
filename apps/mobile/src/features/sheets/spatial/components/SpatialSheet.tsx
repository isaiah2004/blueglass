/**
 * The one entry point a sheet host renders for a spatial badge.
 *
 * Purpose
 *   Two things a host should not have to do itself: narrow the payload union, and apply
 *   `AI-05`. This component does both, so a host renders `<SpatialSheet badge={...} />` and
 *   cannot forget the provenance gate.
 *
 * The gate
 *   `canRenderBadge` refuses a badge whose sources are missing or incomplete, and the
 *   refusal is a rendered explanation rather than `null`. `flutter-port-map.md` §7.4's rule
 *   applies — loading, empty and error are three different screens — and a sheet that
 *   opens onto nothing reads as a crash. The server already drops such badges before the
 *   wire; this is the second lock, on the surface the decision is actually about.
 *
 * Layout
 *   None. `design-language.md` §4 puts this content in a bottom sheet below 600 dp and in
 *   the context rail at and above it (`Q-006`), so the host owns the container and this
 *   component owns only what goes inside it. Both paths render the identical tree.
 *
 * Dependencies
 *   `RouteSheet`, `CitySiteSheet`, and the `AI-05` gate.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { canRenderBadge } from '../model/attribution';
import type {
  CitySheetPayload,
  RouteSheetPayload,
  SheetChrome,
  SpatialSheetSources,
} from '../model/spatial-payload.types';

import { CitySiteSheet } from './CitySiteSheet';
import { RouteSheet } from './RouteSheet';

/** A spatial badge, as the host holds it. */
export interface SpatialBadge extends SpatialSheetSources {
  /** The payload, discriminated on `kind`. */
  readonly payload: RouteSheetPayload | CitySheetPayload;
}

/** Inputs to {@link SpatialSheet}. */
export interface SpatialSheetProps {
  /** The badge to render. */
  readonly badge: SpatialBadge;
  /**
   * `full` (the default) draws the heading and the source strip; `body` omits both, for a
   * host such as `features/reader/badges/BadgeDetail` that already draws them.
   *
   * The `AI-05` refusal is NOT suppressed by `body`. A host that already prints
   * attribution has, by definition, attribution to print — but if it does not, refusing is
   * the whole point, and a silent `null` would look like an empty sheet.
   */
  readonly chrome?: SheetChrome;
}

/** What the reader is told when a badge arrives without usable provenance. */
const NO_PROVENANCE =
  'This badge arrived without a complete source record, so it is not shown. Every claim in ' +
  'Atlas Bible carries a source, or it is not rendered.';

/**
 * Render a spatial badge's sheet content.
 *
 * @param props - See {@link SpatialSheetProps}.
 * @returns The Route sheet, the site sheet, or the refusal.
 *
 * Side effects: none beyond the route map's draw animation.
 */
export function SpatialSheet({ badge, chrome = 'full' }: SpatialSheetProps): JSX.Element {
  const styles = useStyles(useTheme());

  if (!canRenderBadge(badge.sources)) {
    return (
      <View style={styles.refusal} testID="spatial-sheet-no-provenance">
        <Text style={styles.refusalText}>{NO_PROVENANCE}</Text>
      </View>
    );
  }

  return badge.payload.kind === 'route' ? (
    <RouteSheet payload={badge.payload} sources={badge.sources} chrome={chrome} />
  ) : (
    <CitySiteSheet payload={badge.payload} sources={badge.sources} chrome={chrome} />
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  refusal: { paddingVertical: spacing.xl },
  refusalText: { ...uiText('sm'), color: theme.ink.secondary },
}));
