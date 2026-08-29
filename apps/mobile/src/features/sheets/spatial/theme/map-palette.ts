/**
 * The map's colours, derived from theme roles — never written down as hues.
 *
 * Purpose
 *   A drawn map needs about a dozen colours the design tokens do not name: sea, land, coast,
 *   the route line and its glow, the pin and its halo, the label and its plate, and the
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
 *   Land is `ink.tertiary` over the canvas. In the dark theme that makes land *lighter*
 *   than the sea; in the light theme it makes land *darker* than the sea. Both are the
 *   convention their own kind of map uses, and neither needed a special case. What did need
 *   fixing was the *strength*: see {@link LAND_ALPHA} for the measurement that raised it.
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
  /** Coastline stroke, and lake shores. The strongest line on the basemap. */
  readonly coast: Color;
  /** The latitude/longitude grid. */
  readonly graticule: Color;
  /** The two labels on that grid. */
  readonly graticuleLabel: Color;
  /** The route line, for a scheme that can establish a route. */
  readonly route: Color;
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
  /** The plate drawn behind the map's own furniture — the key and the scale bar. */
  readonly keyPlate: Color;
  /** Map furniture — the scale bar's rule and ticks. Quieter than any place name. */
  readonly furniture: Color;
  /** The caption beside that furniture. */
  readonly furnitureLabel: Color;
}

/**
 * Land's opacity over the canvas.
 *
 * Measured, after a report that an inland site read as a rendering bug. At 0.30 land stood
 * at **1.31:1** against the sea in the dark palette and **1.35:1** in the light one — a
 * difference a reader cannot see, so the coastline in the reported Lystra screenshot was
 * not a coastline but two unexplained black wedges. 0.55 measures **1.84:1** and
 * **1.77:1**: unmistakably two materials, still quiet enough that the gold pin and the cyan
 * route line win on hue as `design-language.md` §8 intends. `theme/map-palette.test.ts`
 * holds both figures to a floor so the polarity cannot be flattened again.
 *
 * A land fill bright enough to clear WCAG's 3:1 non-text bar against near-black would be a
 * slab, not a map, so the bar is met by the coastline stroke instead — which is the line a
 * reader actually follows.
 */
const LAND_ALPHA = 0.55;

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

/** A pin's outer ring. Visible against both sea and land without a second hue. */
const PIN_HALO_ALPHA = 0.28;

/**
 * The label plate. Near-opaque, so a name over a coastline is still legible.
 *
 * A place label is ON the map, so a little of the map showing through it is correct: the
 * plate is there to keep the name readable, not to cut a hole in the picture. Map
 * FURNITURE is the opposite case and takes {@link MapPalette.keyPlate} instead -- see the
 * note there for the screenshot that made the difference matter.
 */
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

/*
 * NO CONSTANT HERE, and the absence is the fix.
 *
 * Its caption -- the one place on this map where an alpha was a defect.
 *
 * `Q-017` resolved conflict `C-3` on `ink.secondary` for small metadata, after
 * `ink.tertiary` measured 3.36:1 and failed WCAG AA at exactly this size. That resolution
 * was then undone here by a 0.72 alpha: the key's caption measured **4.33:1** in dark and
 * **3.57:1** in light against the 4.5:1 bar, while the pin labels beside it measured
 * 16-17:1. The caption carrying the caveat was the least readable text on the drawing.
 *
 * So there is no alpha. `furnitureLabel` IS `ink.secondary`, the token `Q-017` chose, over
 * an opaque plate: 7.1:1 dark and 6.4:1 light, held by `map-palette.test.ts` in both
 * themes. `furniture` keeps its alpha -- a hairline rule is a graphic, not text, and is
 * governed by the 3:1 bar rather than by this one.
 */

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
    // `ink.secondary` at full strength, not `ink.tertiary` at two-thirds: the edge between
    // land and sea is the one line on the basemap a reader traces, and it measures 4.1:1
    // against land and 7.6:1 against sea in the dark palette, 3.9:1 and 6.9:1 in the light
    // one. Both clear WCAG 1.4.11's 3:1 bar for a graphic that carries meaning.
    coast: theme.ink.secondary,
    graticule: withOpacity(theme.ink.tertiary, GRATICULE_ALPHA),
    graticuleLabel: withOpacity(theme.ink.secondary, GRATICULE_LABEL_ALPHA),
    route: theme.badge.route.tint,
    routeGlow: withOpacity(theme.badge.route.tint, GLOW_ALPHA),
    pin: theme.badge.city3d.tint,
    pinHalo: withOpacity(theme.badge.city3d.tint, PIN_HALO_ALPHA),
    label: theme.ink.primary,
    labelPlate: withOpacity(theme.background.canvas, LABEL_PLATE_ALPHA),
    // Opaque, and that is the whole point: the "30 N" graticule label bled through the
    // translucent key plate on the tablet screenshot and made it look smudged. Furniture
    // is an annotation ABOUT the picture, so the picture does not run underneath it, and
    // an opaque ground is also what makes the caption's contrast a fixed measurable number
    // rather than one that depends on whether the key happens to sit over land or sea.
    keyPlate: theme.background.canvas,
    furniture: withOpacity(theme.ink.secondary, FURNITURE_ALPHA),
    furnitureLabel: theme.ink.secondary,
  };
}
