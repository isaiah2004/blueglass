/**
 * The glyph paths.
 *
 * Purpose
 *   `docs/product/design-language.md` §7 asks for a per-tab glyph inside a glowing ring.
 *   Nothing drew one, and the tab bar shipped React Navigation's `MissingIcon` chevron
 *   twice per tab until `(tabs)/_layout.tsx` suppressed it. These are the real glyphs.
 *
 * Why vendored paths rather than an icon package
 *   Assumption `Q-021` already settled the same question for the eleven badge marks:
 *   monochrome SVG paths in-repo, because an emoji is painted by the OS and cannot be
 *   tinted — and a tinted glyph is the whole mechanism by which a reader learns the
 *   colour language. The same reasoning applies to navigation, and a table of `d`
 *   attributes costs nothing to bundle.
 *
 * Drawing convention
 *   Every path is drawn inside a 24x24 box, as an **outline**: stroked, never filled,
 *   with round caps and joins. That is what lets one path serve both states — inactive is
 *   the outline in `ink.tertiary`, active is the same outline in the tab's accent inside a
 *   ring. Two separate outline/filled sets would have to stay in sync by hand.
 *
 * Dependencies
 *   None. Data only, so the table can be asserted without rendering.
 */

/** The side of the square every path is drawn inside. */
export const ICON_VIEWBOX = 24;

/** Every glyph this app draws. */
export type IconName =
  | 'home'
  | 'book'
  | 'compass'
  | 'sparkle'
  | 'notebook'
  | 'sun'
  | 'moon'
  | 'display'
  | 'settings'
  | 'panelRight';

/**
 * One glyph: the strokes that make it, in draw order.
 *
 * An array rather than one `d` string because several glyphs need an open path beside a
 * closed one, and merging them into a single `d` makes the round caps land wrong.
 */
export type IconPaths = readonly string[];

/**
 * The glyph table.
 *
 * Coordinates are hand-set on a 24-unit grid with a 2-unit margin, so every glyph has the
 * same optical weight beside the others in a rail.
 */
export const iconPaths = {
  /** Home — the daily canvas. */
  home: [
    'M3.5 10.6 12 3.8l8.5 6.8V19a1.8 1.8 0 0 1-1.8 1.8h-3.7v-6.3H9v6.3H5.3A1.8 1.8 0 0 1 3.5 19z',
  ],
  /** Bible — the reading canvas. A codex with a spine, not an open book. */
  book: [
    'M5 3.6h12.4a1.6 1.6 0 0 1 1.6 1.6v13.6H6.6A1.6 1.6 0 0 0 5 20.4z',
    'M19 18.8v1.6a1.6 1.6 0 0 1-1.6 1.6H6.6',
    'M9.4 8.2h5.6',
  ],
  /** Discover — a compass, for exploring the atlas. */
  compass: [
    'M12 21.2a9.2 9.2 0 1 0 0-18.4 9.2 9.2 0 0 0 0 18.4z',
    'M15.4 8.6 13.6 13.6 8.6 15.4 10.4 10.4z',
  ],
  /** Studio — a spark, for generated work. */
  sparkle: [
    'M12 3.2 13.9 8.6 19.3 10.5 13.9 12.4 12 17.8 10.1 12.4 4.7 10.5 10.1 8.6z',
    'M18.4 16.6 19.2 18.8 21.4 19.6 19.2 20.4 18.4 22.6 17.6 20.4 15.4 19.6 17.6 18.8z',
  ],
  /** Journal — a bound notebook with a ruled edge. */
  notebook: [
    'M7.6 3h9.8A1.6 1.6 0 0 1 19 4.6v14.8a1.6 1.6 0 0 1-1.6 1.6H7.6z',
    'M7.6 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h1.6',
    'M10.8 8.4h4.8',
    'M10.8 12h4.8',
  ],
  /** Light theme. */
  sun: [
    'M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8z',
    'M12 2.6v2.2M12 19.2v2.2M4.35 4.35l1.56 1.56M18.09 18.09l1.56 1.56M2.6 12h2.2M19.2 12h2.2M4.35 19.65l1.56-1.56M18.09 5.91l1.56-1.56',
  ],
  /** Dark theme. */
  moon: ['M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6a8.8 8.8 0 1 0 11 11z'],
  /** Follow the system. */
  display: [
    'M3.6 5.2h16.8a1 1 0 0 1 1 1v9.6a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V6.2a1 1 0 0 1 1-1z',
    'M8.8 20.8h6.4M12 16.8v4',
  ],
  /** Settings. */
  settings: [
    'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z',
    'M19.4 14.6a1.5 1.5 0 0 0 .3 1.65l.05.06a1.8 1.8 0 1 1-2.55 2.55l-.06-.06a1.5 1.5 0 0 0-2.55 1.06v.17a1.8 1.8 0 1 1-3.6 0v-.09a1.5 1.5 0 0 0-2.6-1.03l-.06.06a1.8 1.8 0 1 1-2.55-2.55l.06-.06a1.5 1.5 0 0 0-1.06-2.55h-.17a1.8 1.8 0 1 1 0-3.6h.09a1.5 1.5 0 0 0 1.03-2.6l-.06-.06a1.8 1.8 0 1 1 2.55-2.55l.06.06a1.5 1.5 0 0 0 2.55-1.06v-.17a1.8 1.8 0 1 1 3.6 0v.09a1.5 1.5 0 0 0 2.6 1.03l.06-.06a1.8 1.8 0 1 1 2.55 2.55l-.06.06a1.5 1.5 0 0 0 1.06 2.55h.17a1.8 1.8 0 1 1 0 3.6h-.09a1.5 1.5 0 0 0-1.38.91z',
  ],
  /** Show or hide the context rail. */
  panelRight: ['M3.6 4.4h16.8a1 1 0 0 1 1 1v13.2a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V5.4a1 1 0 0 1 1-1z', 'M15 4.4v15.2'],
} as const satisfies Record<IconName, IconPaths>;

/** Every glyph name, so a gallery or a test iterates rather than restates. */
export const iconNames = [
  'home',
  'book',
  'compass',
  'sparkle',
  'notebook',
  'sun',
  'moon',
  'display',
  'settings',
  'panelRight',
] as const satisfies readonly IconName[];
