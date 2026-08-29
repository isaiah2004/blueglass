/**
 * The map's colours, derived from theme roles — never written down as hues.
 *
 * Purpose
 *   A drawn map needs about a dozen colours the design tokens do not name: sea, land, coast,
 *   the trace line and its glow, the pin and its halo, the label and its plate, and the
 *   furniture that measures the view. CLAUDE.md is absolute that a component never inlines a
 *   colour, so rather than sprinkle a dozen hexes through five components this module
 *   derives them all **from the theme in force**, the same way `theme/colors.ts` derives
 *   every badge's three colours from its one hue.
 *
 * Why derivation rather than new tokens
 *   `apps/mobile/src/theme` is owned elsewhere in the fleet, and a map palette is not a
 *   product-wide concern — it is one feature's presentation of tokens it does not own.
 *   Every value below traces to a role on `Theme`, so light mode works with no second
 *   table to keep in step, and a palette change in `colors.ts` moves the map with it.
 *
 * Why the polarity works in both themes
 *   Land is `ink.tertiary` at low opacity over the canvas. In the dark theme that makes
 *   land *lighter* than the sea; in the light theme it makes land *darker* than the sea.
 *   Both are the convention their own kind of map uses, and neither needed a special case.
 *
 * Meaning, not decoration
 *   `design-language.md` §8: gold means "you", cyan means "the system". The route line is
 *   the badge's own cyan — the system's reading of where the passage moves — and the pins
 *   are the gold the mockups give city markers and place names. Both are read off
 *   `theme.badge`, so a badge hue and its map agree by construction.
 *
 * Dependencies
 *   `@/theme` only. No React, so this module is unit-testable under Node.
 */

import { withOpacity, type Color, type Theme } from '@/theme';

/** Every colour a spatial sheet's map paints with. */
export interface MapPalette {
  /** Top of the sea's vertical gradient. */
  readonly seaTop: Color;
  /** Bottom of the sea's vertical gradient. */
  readonly seaBottom: Color;
  /** Land fill. */
  readonly land: Color;
  /** Coastline stroke, and lake shores. */
  readonly coast: Color;
  /** The latitude/longitude grid. */
  readonly graticule: Color;
  /** The two labels on that grid. */
  readonly graticuleLabel: Color;
  /** The route line, for a scheme that can establish a route. */
  readonly route: Color;
  /** The connector drawn between pins that are only in mention order. */
  readonly trace: Color;
  /** The wide, soft stroke drawn under the route line to read as a glow. */
  readonly routeGlow: Color;
  /** A pin's centre. */
  readonly pin: Color;
  /** A pin's outer ring. */
  readonly pinHalo: Color;
  /** A place label. */
  readonly label: Color;
  /** The plate drawn behind a label so it survives over land or sea. */
  readonly labelPlate: Color;
  /** Map furniture — the scale bar's rule and ticks. Quieter than any place name. */
  readonly furniture: Color;
  /** The caption beside that furniture. */
  readonly furnitureLabel: Color;
}

/**
 * Land's opacity over the canvas.
 *
 * Tuned by looking at the rendered sheet, not by taste: at 0.22 the Aegean coastline was
 * present but not readable at phone size against `bg.canvas`, which is only 3 % luminance
 * to begin with. 0.30 reads as ground without ever competing with the route line, which is
 * a saturated cyan and wins on hue rather than on value.
 */
const LAND_ALPHA = 0.3;

/** The coastline is the same hue at more than twice the strength, so the edge reads. */
const COAST_ALPHA = 0.68;

/**
 * The coordinate grid.
 *
 * Weaker than the land fill on purpose: the grid is a reference, and a reference that
 * competes with the coastline has stopped being one.
 */
const GRATICULE_ALPHA = 0.14;

/** The grid's two labels. Legible, but never louder than a place name. */
const GRATICULE_LABEL_ALPHA = 0.45;

/**
 * The route's glow.
 *
 * A wide translucent stroke under the line, not an SVG filter: `feGaussianBlur` is
 * unsupported by `react-native-svg` on Android, and a per-frame blur under an animating
 * stroke is the exact cost `flutter-port-map.md` §7.6 warns about.
 */
const GLOW_ALPHA = 0.2;

/**
 * The mention-order connector.
 *
 * The same cyan as a route — `design-language.md` §8 gives cyan to the system's own
 * analysis, and a reading order is exactly that — but at under half the strength and with
 * no glow beneath it. A saturated, glowing, progressively drawn polyline through sixteen
 * pins reads as a voyage however carefully the caption above it is worded, and Acts 16's
 * pins include Jerusalem, which the chapter names without anyone going there.
 */
const TRACE_ALPHA = 0.42;

/** A pin's outer ring. Visible against both sea and land without a second hue. */
const PIN_HALO_ALPHA = 0.28;

/** The label plate. Near-opaque, so a name over a coastline is still legible. */
const LABEL_PLATE_ALPHA = 0.82;

/**
 * Map furniture — today, the scale bar.
 *
 * The scale bar used to be drawn in `label`, which is `ink.primary`: a solid white slab
 * with white type stacked on it, sitting on the coastline it was measuring. On an
 * otherwise restrained dark canvas it read as a rendering artefact rather than as an
 * annotation (`D-05`: restraint plus texture, not glare). Furniture is not a datum — it is
 * the ruler beside the datum — so it is drawn at the weight of a hairline rule.
 */
const FURNITURE_ALPHA = 0.55;

/** Its caption. Readable, and no louder than the grid's own two labels. */
const FURNITURE_LABEL_ALPHA = 0.72;

/**
 * Derive the map palette from a theme.
 *
 * @param theme - The theme in force, from `useTheme()`.
 * @returns Fifteen colours, every one traceable to a token. Side effects: none.
 */
export function mapPalette(theme: Theme): MapPalette {
  return {
    seaTop: theme.background.elevated,
    seaBottom: theme.background.canvas,
    land: withOpacity(theme.ink.tertiary, LAND_ALPHA),
    coast: withOpacity(theme.ink.tertiary, COAST_ALPHA),
    graticule: withOpacity(theme.ink.tertiary, GRATICULE_ALPHA),
    graticuleLabel: withOpacity(theme.ink.secondary, GRATICULE_LABEL_ALPHA),
    route: theme.badge.route.tint,
    trace: withOpacity(theme.badge.route.tint, TRACE_ALPHA),
    routeGlow: withOpacity(theme.badge.route.tint, GLOW_ALPHA),
    pin: theme.badge.city3d.tint,
    pinHalo: withOpacity(theme.badge.city3d.tint, PIN_HALO_ALPHA),
    label: theme.ink.primary,
    labelPlate: withOpacity(theme.background.canvas, LABEL_PLATE_ALPHA),
    furniture: withOpacity(theme.ink.secondary, FURNITURE_ALPHA),
    furnitureLabel: withOpacity(theme.ink.secondary, FURNITURE_LABEL_ALPHA),
  };
}
