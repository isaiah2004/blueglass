/**
 * Where the five sheet bodies meet the reading canvas.
 *
 * Purpose
 *   `features/reader/badges/badge-sheet-slot.tsx` is a seam with two sides: the reader draws
 *   the chrome and asks a context for the body; `features/sheets/` builds the bodies and
 *   knows nothing about the reader. **This file is the only place the two sides meet**, and
 *   until it existed neither did the connection — every badge opened onto a pill, a
 *   reference, a teaser and a source list, and the map, the timeline, the lexicon entry and
 *   the linked passages were reachable only from `/spike/*`.
 *
 * Why it is a component and not a constant
 *   The renderers close over nothing, so a module-level object would do — but a host that is
 *   a component is a host `app/_layout.tsx` mounts the same way it mounts every other
 *   provider, and it keeps `BadgeSheetProvider` out of the router file. A sixth badge is one
 *   entry here and no change anywhere else.
 *
 * Every body is drawn as a `body`, never as a `full` sheet
 *   `BadgeDetail` has already drawn the mark, the reference, the teaser, the evidence and —
 *   the part that matters — the `AI-05` attribution strip. A sheet drawing its own heading
 *   and its own strip inside that would print the badge's name twice and its licences twice.
 *   So both feature folders take a `chrome` prop and both are asked for `body`.
 *
 * Navigation
 *   `[Cross-Ref]` and `[Root]` hand back a `VerseTarget` — a `VerseKey` and the strings a
 *   router needs. The slot's own `BadgeSheetTarget` is the same destination in the reader's
 *   vocabulary, which is what lets `features/reader` stay free of any import from here. The
 *   translation between them is `toBadgeTarget`, below, and it is the whole adapter.
 *
 * The two payload vocabularies are one vocabulary
 *   `features/reader/badges/badge-payloads.ts` was written against the same endpoint these
 *   sheets were, so a decoded `ReaderBadge` is structurally the badge each sheet declares.
 *   The narrowing below is therefore a discriminated-union check and not a conversion; if
 *   the two ever drift, this file stops compiling, which is exactly where that should surface.
 *
 * Dependencies
 *   The reader's badge slot, and the two sheet features' public APIs. No router, no queries.
 */

import type { JSX, ReactNode } from 'react';

import {
  BadgeSheetProvider,
  type BadgeSheetActions,
  type BadgeSheetRenderers,
  type BadgeSheetTarget,
  type ReaderBadge,
} from '@/features/reader/badges';

import { SpatialSheet } from './spatial';
import { TextualSheet, type TextualBadge, type VerseTarget } from './textual';

/** Props for {@link BadgeSheetHost}. */
export interface BadgeSheetHostProps {
  /** The subtree that may open badges — in practice, the whole navigator. */
  readonly children: ReactNode;
}

/**
 * Restate a sheet's destination in the reader's own vocabulary.
 *
 * @param target - Where a sheet row wants to go.
 * @returns The same destination, flattened. Side effects: none.
 */
function toBadgeTarget(target: VerseTarget): BadgeSheetTarget {
  return {
    bookNumber: target.verse.book.canonicalNumber,
    bookId: target.bookId,
    chapter: target.chapter,
    verseNumber: target.verseNumber,
    label: target.label,
  };
}

/**
 * Adapt the slot's command to the callback the textual sheets take.
 *
 * @param actions - What the reader offered.
 * @returns The callback, or `undefined` when the host cannot navigate — in which case the
 *   rows render readable and inert rather than pretending to be pressable.
 *   Side effects: none.
 */
function openVerseHandler(actions: BadgeSheetActions): ((target: VerseTarget) => void) | undefined {
  const { openVerse } = actions;
  if (openVerse === undefined) {
    return undefined;
  }

  return (target: VerseTarget): void => {
    openVerse(toBadgeTarget(target));
  };
}

/**
 * Draw a textual badge's body.
 *
 * @param badge - The badge, already known to be one of the three textual kinds.
 * @param actions - What the reader offered.
 * @returns The body. Side effects: none beyond the caller's `openVerse`.
 */
function textualBody(badge: TextualBadge, actions: BadgeSheetActions): ReactNode {
  return <TextualSheet badge={badge} chrome="body" onOpenVerse={openVerseHandler(actions)} />;
}

/**
 * The five bodies, keyed by the theme's badge hue names — which is what the slot keys on.
 *
 * `themeBadgeKind` maps the wire's `3d-city` to the theme's `city3d` and `cross-ref` to
 * `crossRef`; the reader applies it before asking, so the keys here are the theme's.
 */
const RENDERERS: BadgeSheetRenderers = {
  route: (badge: ReaderBadge) =>
    badge.kind !== 'route' ? null : (
      <SpatialSheet badge={{ payload: badge.payload, sources: badge.sources }} chrome="body" />
    ),
  city3d: (badge: ReaderBadge) =>
    badge.kind !== '3d-city' ? null : (
      <SpatialSheet badge={{ payload: badge.payload, sources: badge.sources }} chrome="body" />
    ),
  history: (badge: ReaderBadge, actions: BadgeSheetActions) =>
    badge.kind !== 'history' ? null : textualBody(badge, actions),
  root: (badge: ReaderBadge, actions: BadgeSheetActions) =>
    badge.kind !== 'root' ? null : textualBody(badge, actions),
  crossRef: (badge: ReaderBadge, actions: BadgeSheetActions) =>
    badge.kind !== 'cross-ref' ? null : textualBody(badge, actions),
};

/**
 * Publish the five sheet bodies to every badge the reader can open.
 *
 * @param props - See {@link BadgeSheetHostProps}.
 * @returns The subtree, with the bodies in scope. Side effects: none.
 */
export function BadgeSheetHost({ children }: BadgeSheetHostProps): JSX.Element {
  return <BadgeSheetProvider renderers={RENDERERS}>{children}</BadgeSheetProvider>;
}
