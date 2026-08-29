/**
 * The inline badge kinds — the app's signature interaction, enumerated.
 *
 * Purpose
 *   `docs/product/prd.md` "Tab 2" defines the small glowing pills that sit inline in
 *   scripture and open a focused sheet. Every one of them needs a stable discriminator
 *   the reader, the API, and the sheet router all agree on. This module is that list.
 *
 * Key responsibilities
 *   - Enumerate the badge kinds as a closed union, so a `switch` over them is exhaustive.
 *   - Carry each kind's product-level presentation: bracketed label, glyph, and what it
 *     appears beside. These come from the spec, not from the design system — the hue is
 *     a design token and deliberately lives in the theme layer, not here.
 *
 * Dependencies
 *   None. Pure data.
 *
 * Count discrepancy — recorded, not resolved (question `Q-018`)
 *   The PRD's prose says "10 Embedded Feature Badges" but the list beneath it contains
 *   **eleven** marks, because Route and 3D City share one bullet. Separately,
 *   `docs/product/design-language.md` §2 assigns a hue to ten badges and omits Lineage,
 *   even though the PRD gives Lineage its own bullet *and* its own sheet ("3D family
 *   tree node graph"). This module models all eleven: a badge type with a specified
 *   sheet but no assigned hue is a design gap to fill, whereas dropping it would be a
 *   feature silently lost.
 */

/**
 * Which inline badge this is. The discriminant of the `InlineBadge` union.
 *
 * Values are kebab-case and stable — they appear in pre-computed passage records and in
 * analytics events, so renaming one is a data migration, not a refactor.
 */
export type BadgeKind =
  | 'route'
  | '3d-city'
  | 'history'
  | 'root'
  | 'lineage'
  | 'manuscript'
  | 'cross-ref'
  | 'structure'
  | 'cultural'
  | 'context'
  | 'meditate';

/** The product-level description of one badge kind. */
export interface BadgeKindDescriptor {
  /** The discriminator, repeated here so an iterated descriptor is self-contained. */
  readonly kind: BadgeKind;
  /** The word inside the brackets, e.g. `Route` in `[🗺 Route]`. */
  readonly label: string;
  /** The emoji the spec pairs with the label. Part of the mark, per the design language. */
  readonly glyph: string;
  /** What the badge annotates, condensed from the PRD. Guides the enrichment pipeline. */
  readonly appearsBeside: string;
}

/** Every badge kind, in the order the PRD lists them. */
export const BADGE_KINDS = [
  'route',
  '3d-city',
  'history',
  'root',
  'lineage',
  'manuscript',
  'cross-ref',
  'structure',
  'cultural',
  'context',
  'meditate',
] as const satisfies readonly BadgeKind[];

/**
 * Each kind's presentation, keyed by the discriminator.
 *
 * A `Record` over the literal union rather than a `Map`: the compiler then refuses to
 * merge a new kind into `BadgeKind` without also describing it here, so the two can
 * never drift apart.
 */
const DESCRIPTOR_BY_KIND: Readonly<Record<BadgeKind, BadgeKindDescriptor>> = {
  route: { kind: 'route', label: 'Route', glyph: '🗺️', appearsBeside: 'location names' },
  // `Q-025`: the label is what the reader is shown, and the sheet behind it shows the
  // gazetteer site record rather than a reconstruction — no openly licensed 3D model of a
  // biblical city exists (`DECISIONS.md` §4). The discriminator keeps its published
  // spelling; only the words the reader reads changed.
  '3d-city': {
    kind: '3d-city',
    label: 'Site',
    glyph: '🏛️',
    appearsBeside: 'cities named in the passage',
  },
  history: {
    kind: 'history',
    label: 'History',
    glyph: '⏳',
    appearsBeside: 'historical rulers or laws',
  },
  root: { kind: 'root', label: 'Root', glyph: '🗣️', appearsBeside: 'key original-language words' },
  lineage: { kind: 'lineage', label: 'Lineage', glyph: '🧬', appearsBeside: 'biblical figures' },
  manuscript: {
    kind: 'manuscript',
    label: 'Manuscript',
    glyph: '📜',
    appearsBeside: 'famous textual variants',
  },
  'cross-ref': {
    kind: 'cross-ref',
    label: 'Cross-Ref',
    glyph: '🎯',
    appearsBeside: 'quotations and fulfilled prophecies',
  },
  structure: {
    kind: 'structure',
    label: 'Structure',
    glyph: '🌳',
    appearsBeside: 'chiasms, Psalms and Proverbs',
  },
  cultural: {
    kind: 'cultural',
    label: 'Cultural',
    glyph: '⚖️',
    appearsBeside: 'ancient Near East and Greco-Roman customs',
  },
  context: {
    kind: 'context',
    label: 'Context',
    glyph: '🎙️',
    appearsBeside: 'verses needing historical background',
  },
  meditate: {
    kind: 'meditate',
    label: 'Meditate',
    glyph: '🧘',
    appearsBeside: 'high-impact devotional or command verses',
  },
};

/**
 * Every descriptor, in PRD order.
 *
 * Iterate this rather than hand-writing a list; the chapter-end badge summary and the
 * enrichment pipeline's coverage report both depend on it being complete.
 */
export const BADGE_KIND_DESCRIPTORS: readonly BadgeKindDescriptor[] = BADGE_KINDS.map(
  (kind) => DESCRIPTOR_BY_KIND[kind],
);

/** How many inline badge kinds exist. See the count discrepancy note above. */
export const BADGE_KIND_COUNT = BADGE_KINDS.length;

/**
 * Narrow an arbitrary string to a badge kind.
 *
 * Pre-computed passage records are authored outside the app, so a `kind` arriving from
 * one is untrusted input and must be checked at the boundary (rule 6.5.1).
 *
 * @param value - A candidate discriminator, typically from JSON.
 * @returns `true` when the value is one of the known kinds. Side effects: none.
 */
export function isBadgeKind(value: string): value is BadgeKind {
  return BADGE_KINDS.some((kind) => kind === value);
}

/**
 * Look up a badge kind's label, glyph, and placement rule.
 *
 * @param kind - A known badge kind.
 * @returns Its descriptor. Total over `BadgeKind`, so there is no failure branch.
 *
 * Side effects: none.
 */
export function describeBadgeKind(kind: BadgeKind): BadgeKindDescriptor {
  return DESCRIPTOR_BY_KIND[kind];
}
