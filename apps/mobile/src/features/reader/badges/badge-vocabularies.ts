/**
 * The wire's small string unions, narrowed rather than trusted.
 *
 * Purpose
 *   Six fields on the badge contract are closed vocabularies: a pin's role, a citation's
 *   kind, a word's language, a cross-reference's relation, how a date was arrived at, and
 *   the badge kind itself. Pydantic guarantees them on the way out; nothing guarantees them
 *   on the way in, and `JSON.parse` will happily hand a component the string `"arrival"`
 *   where the code expects `"destination"`.
 *
 * Two failure styles, chosen per field
 *   - **Fail closed** where the wrong value would be a false claim: an unknown language would
 *     render Hebrew right-to-left as Greek, and an unknown dating origin would present a
 *     generated date as a sourced one. Those return `null` and the badge is dropped.
 *   - **Fall back** only where the fallback is the honestly weaker answer: an unrecognised
 *     citation kind becomes `external`, which is the union's own "anything else" member and
 *     understates rather than overstates what the source is.
 *
 * Dependencies
 *   `@atlas/shared` for the unions. Pure functions — no React, no I/O.
 */

import type { CitationKind, LocationRole, OriginalLanguage } from '@atlas/shared';

import type { ReaderBadgeKind } from './badge-models';

/** Membership test for a readonly tuple of string literals. */
function memberOf<TValue extends string>(
  values: readonly TValue[],
  candidate: string,
): TValue | null {
  return (values as readonly string[]).includes(candidate) ? (candidate as TValue) : null;
}

/** The five badge kinds `P-04` ships, in the wire's spelling and the server's order. */
export const READER_BADGE_KINDS: readonly ReaderBadgeKind[] = [
  'route',
  '3d-city',
  'history',
  'root',
  'cross-ref',
];

const LOCATION_ROLES: readonly LocationRole[] = ['departure', 'waypoint', 'island', 'destination'];

const CITATION_KINDS: readonly CitationKind[] = [
  'scripture',
  'reference-work',
  'manuscript',
  'gazetteer',
  'external',
];

const ORIGINAL_LANGUAGES: readonly OriginalLanguage[] = ['greek', 'hebrew', 'aramaic'];

/** How a passage came by its date. M2 emits only `sourced` (`Q-016`). */
export type DatingOrigin = 'sourced' | 'generated' | 'authored';

const DATING_ORIGINS: readonly DatingOrigin[] = ['sourced', 'generated', 'authored'];

/** Why two verses are linked. OpenBible publishes votes only, so M2 emits only `parallel`. */
export type CrossReferenceRelation = 'quotation' | 'allusion' | 'fulfilment' | 'parallel';

const RELATIONS: readonly CrossReferenceRelation[] = [
  'quotation',
  'allusion',
  'fulfilment',
  'parallel',
];

/**
 * @param value - The wire's `kind` on a badge.
 * @returns The kind, or `null` for one this client does not ship. Side effects: none.
 */
export function asReaderBadgeKind(value: string): ReaderBadgeKind | null {
  return memberOf(READER_BADGE_KINDS, value);
}

/**
 * @param value - The wire's `role` on a pin.
 * @returns The role, or `null`. A pin whose part in the journey is unknown is not drawn:
 *   the route line's shape depends on it. Side effects: none.
 */
export function asLocationRole(value: string): LocationRole | null {
  return memberOf(LOCATION_ROLES, value);
}

/**
 * @param value - The wire's `kind` on a citation.
 * @returns The kind, defaulting to `external` — the union's own catch-all, which understates
 *   the source rather than claiming it is a manuscript. Side effects: none.
 */
export function asCitationKind(value: string): CitationKind {
  return memberOf(CITATION_KINDS, value) ?? 'external';
}

/**
 * @param value - The wire's `language` on a Root payload.
 * @returns The language, or `null`. Guessing here would set the wrong reading direction.
 *   Side effects: none.
 */
export function asOriginalLanguage(value: string): OriginalLanguage | null {
  return memberOf(ORIGINAL_LANGUAGES, value);
}

/**
 * @param value - The wire's `dating_origin`.
 * @returns The origin, or `null`. A date whose provenance cannot be named must not be shown
 *   at all — that is `AI-05` applied to a single field. Side effects: none.
 */
export function asDatingOrigin(value: string): DatingOrigin | null {
  return memberOf(DATING_ORIGINS, value);
}

/**
 * @param value - The wire's `relation` on a Cross-Ref payload.
 * @returns The relation, or `null`. Side effects: none.
 */
export function asCrossReferenceRelation(value: string): CrossReferenceRelation | null {
  return memberOf(RELATIONS, value);
}
