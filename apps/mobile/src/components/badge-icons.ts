/**
 * The badge glyphs, as vendored vector paths.
 *
 * Purpose
 *   `docs/product/design-language.md` §5 requires the badge's icon to be drawn *in the
 *   badge's hue* — that tint is the whole mechanism by which a reader learns the colour
 *   language. The inline-badge spike shipped colour emoji as a stopgap and recorded the
 *   problem as its first concession: an emoji is painted by the OS in its own palette, and
 *   `color` does not touch it, so a cyan Route pill carried a green-and-blue map. Assumption
 *   `Q-021` settles it — monochrome SVG paths, in-repo. These are those paths.
 *
 * Why vendored rather than an icon package
 *   The same reasoning `nav-icons.ts` gives for the navigation glyphs: a table of `d`
 *   attributes costs nothing to bundle, has no licence to track, and cannot break when a
 *   package changes its export shape. The two tables deliberately share a drawing convention
 *   so a badge pill and a tab bar never look like they came from different products.
 *
 * Drawing convention
 *   Every path is drawn inside a 24x24 box as an **outline**: stroked, never filled, round
 *   caps and joins, a 2-unit margin. Stroked outlines take a single `stroke` colour, which is
 *   exactly what "the icon in the badge's hue" means.
 *
 * Dependencies
 *   `@/theme` for `BadgeKind` only. Data, so the table can be asserted without rendering.
 */

import type { BadgeKind } from '@/theme';

/** The side of the square every path is drawn inside. */
export const BADGE_ICON_VIEWBOX = 24;

/**
 * Stroke width, in viewBox units.
 *
 * Heavier than the navigation glyphs' 1.7, because a badge icon is drawn at roughly 12 dp
 * inside a pill rather than at 20 dp in a rail, and a 1.7 stroke disappears at that size
 * against a 10 %-opacity fill.
 */
export const BADGE_ICON_STROKE = 2;

/**
 * The glyph's box as a multiple of the label's font size.
 *
 * 1.15 puts the 24-unit drawing's optical weight level with the label's caps: the paths carry
 * a 2-unit margin, so the ink occupies about 0.83 of the box.
 */
export const BADGE_ICON_SIZE_RATIO = 1.15;

/** The space between the glyph and the word, as a multiple of the label's font size. */
export const BADGE_ICON_GAP_RATIO = 0.25;

/** One glyph: the strokes that make it, in draw order. */
export type BadgeIconPaths = readonly string[];

/**
 * The glyph table — one per badge kind.
 *
 * `satisfies Record<BadgeKind, BadgeIconPaths>` makes an eleventh badge kind a compile error
 * here until it has a glyph, which is the same guarantee the theme gives for its hue.
 */
export const badgeIconPaths = {
  /** Route — a folded map. */
  route: ['M3.5 7 9 4.6 15 7.4 20.5 5v12L15 19.4 9 16.6 3.5 19z', 'M9 4.6v12', 'M15 7.4v12'],
  /** 3D City — a colonnaded building, the mockup's own mark for a site. */
  city3d: [
    'M12 3.2 20.8 8.4H3.2z',
    'M6 11.4v6.4M10 11.4v6.4M14 11.4v6.4M18 11.4v6.4',
    'M3.6 20.8h16.8',
  ],
  /** History — an hourglass. */
  history: [
    'M6.8 3.2h10.4M6.8 20.8h10.4',
    'M8.4 3.2v3.1c0 2.1 3.6 3.6 3.6 5.7 0-2.1 3.6-3.6 3.6-5.7V3.2',
    'M8.4 20.8v-3.1c0-2.1 3.6-3.6 3.6-5.7 0 2.1 3.6 3.6 3.6 5.7v3.1',
  ],
  /** Manuscript — a scroll with a rolled edge. */
  manuscript: [
    'M6.6 3.6h10.8a1.8 1.8 0 0 1 1.8 1.8v11.4a2.8 2.8 0 0 0 2.8 2.8H8.4a1.8 1.8 0 0 1-1.8-1.8z',
    'M6.6 3.6a2.4 2.4 0 0 0-2.4 2.4v1.8h2.4',
    'M10 8.4h5.6M10 12h5.6',
  ],
  /** Cross-Ref — a target, the mockup's mark for a deliberate link. */
  crossRef: [
    'M12 20.6a8.6 8.6 0 1 0 0-17.2 8.6 8.6 0 0 0 0 17.2z',
    'M12 16.1a4.1 4.1 0 1 0 0-8.2 4.1 4.1 0 0 0 0 8.2z',
    'M12 3.4v3.2M12 17.4v3.2M3.4 12h3.2M17.4 12h3.2',
  ],
  /** Root — a seedling, for a word's root. */
  root: [
    'M12 20.8v-7.2',
    'M12 13.6C12 10.1 9.5 7.6 6 7.6c0 3.5 2.5 6 6 6z',
    'M12 13.6c0-3.1 2.2-5.6 5.6-5.6 0 3.1-2.5 5.6-5.6 5.6z',
  ],
  /** Lineage — a small family tree, three generations wide. */
  lineage: [
    'M12 5.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M6.4 13.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.6 13.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M6.4 21.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17.6 21.2a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
    'M12 5.2v3M12 8.2 6.4 9.2M12 8.2l5.6 1',
    'M6.4 13.2v4M17.6 13.2v4',
  ],
  /** Structure — a three-node graph, for literary structure. */
  structure: [
    'M12 6.6a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    'M6 22.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    'M18 22.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z',
    'M10.4 8.2 7.3 16.2M13.6 8.2l3.1 8',
  ],
  /** Cultural — a balance, for a custom weighed in its own world. */
  cultural: [
    'M12 4.2v16.2M6.4 20.4h11.2',
    'M3.6 8.2h16.8M12 4.2 3.6 8.2M12 4.2l8.4 4',
    'M3.6 8.2 1.6 13.4a2.4 2.4 0 0 0 4 0z',
    'M20.4 8.2l-2 5.2a2.4 2.4 0 0 0 4 0z',
  ],
  /** Context — a studio microphone, for the narrated overview. */
  context: [
    'M12 14.6a3.4 3.4 0 0 0 3.4-3.4V6.2a3.4 3.4 0 1 0-6.8 0v5a3.4 3.4 0 0 0 3.4 3.4z',
    'M5.6 11.2a6.4 6.4 0 0 0 12.8 0',
    'M12 17.6v3.2M9 20.8h6',
  ],
  /** Meditate — a seated figure. */
  meditate: [
    'M12 6.6a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4z',
    'M12 8.6v5',
    'M12 13.6 6 17.2M12 13.6l6 3.6',
    'M4.6 20.6h14.8',
  ],
} as const satisfies Record<BadgeKind, BadgeIconPaths>;
