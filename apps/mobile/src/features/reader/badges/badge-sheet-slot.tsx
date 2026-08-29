/**
 * The seam between the reader's badge wiring and the five sheet bodies.
 *
 * Purpose
 *   Two different things live inside one badge sheet, and they are built by different people.
 *   The **chrome** — where the surface opens, how it closes, the pill, the teaser, the
 *   citations and the attribution strip — belongs to the reading canvas, because it is the
 *   same on every badge and because `AI-05` makes the attribution non-optional. The **body**
 *   — a stylised GeoJSON map, a dual-axis timeline, a lexicon entry — is one component per
 *   kind, and each is a piece of work in its own right.
 *
 *   This module is the join. A sheet author registers a renderer for their kind; the reader
 *   never imports their component and they never import the reader's.
 *
 * Why a context and not a prop
 *   A prop would make every route that mounts `ReaderScreen` name all five sheets, so adding
 *   the sixth would edit files that have nothing to do with it. Mounting the provider once,
 *   above the navigator, keeps the registration in one place and keeps this folder free of
 *   imports it does not own.
 *
 * The empty default is a real state, not a stub
 *   With nothing registered, a badge sheet still shows its pill, its reference, its teaser,
 *   its evidence chips and its sources. That is a complete, honest surface — it makes no
 *   claim it cannot support — so a kind whose body has not landed yet degrades to less
 *   detail rather than to a broken sheet.
 *
 * Usage
 *   ```tsx
 *   <BadgeSheetProvider renderers={{ route: (badge) => <RouteSheetBody badge={badge} /> }}>
 *     <Stack />
 *   </BadgeSheetProvider>
 *   ```
 *
 * Dependencies
 *   React, `@/theme` for `BadgeKind`, and this folder's models.
 */

import { createContext, useContext, type JSX, type ReactNode } from 'react';

import type { BadgeKind } from '@/theme';

import type { ReaderBadge } from './badge-models';

/**
 * Where a body asks the reader to be taken.
 *
 * Deliberately flat and primitive. A cross-reference row, a Root example and a History
 * passage span all resolve to "open this verse", and the host turns that into route params
 * — which are strings and numbers. Carrying the book BOTH ways (its canonical number and
 * its route segment) means neither side has to re-run a name lookup that can fail.
 *
 * It is declared here, in the reader's own vocabulary, rather than imported from
 * `features/sheets`: this folder must not depend on the bodies it hosts, or the seam stops
 * being a seam.
 */
export interface BadgeSheetTarget {
  /** 1-66, the canonical book number. */
  readonly bookNumber: number;
  /** Route segment for the book, e.g. `acts`. Matches `CanonicalBook.id`. */
  readonly bookId: string;
  /** 1-based chapter. */
  readonly chapter: number;
  /** 1-based verse, so a host can also focus the row once the chapter is on screen. */
  readonly verseNumber: number;
  /** How the destination reads, e.g. `Acts 2:38-39`. Used as the accessibility label. */
  readonly label: string;
}

/**
 * What a body may ask the reading canvas to do.
 *
 * One member today. It is an object rather than a bare callback so a sixth badge that needs
 * a second command — play an audio clip, highlight a verse — adds a field instead of
 * changing the signature of every renderer that already exists.
 */
export interface BadgeSheetActions {
  /**
   * Open a passage in the reader.
   *
   * Absent when the host cannot navigate — a gallery, a test. A body that receives no
   * `openVerse` must stay readable rather than rendering dead controls.
   */
  readonly openVerse?: ((target: BadgeSheetTarget) => void) | undefined;
}

/** No commands. Shared so no caller allocates one per render. */
export const NO_BADGE_SHEET_ACTIONS: BadgeSheetActions = {};

/**
 * Draws the body of one badge's sheet.
 *
 * Receives the whole badge rather than only its payload, because a body may legitimately want
 * the anchor (which word was tapped) or a citation id. It must return only the body: the
 * pill, the heading and the attribution are drawn around it and must not be repeated.
 *
 * The second argument is what makes a cross-reference followable. Without it the
 * `[Cross-Ref]` sheet renders its targets and every one of them is inert, which is the
 * difference between a thread of scripture and a lookup table.
 */
export type BadgeSheetRenderer = (badge: ReaderBadge, actions: BadgeSheetActions) => ReactNode;

/** A renderer per kind. Partial: an unregistered kind falls back to chrome alone. */
export type BadgeSheetRenderers = Partial<Record<BadgeKind, BadgeSheetRenderer>>;

/** No bodies registered — the shipped default until the sheet components mount a provider. */
const NO_RENDERERS: BadgeSheetRenderers = {};

const BadgeSheetContext = createContext<BadgeSheetRenderers>(NO_RENDERERS);

/** Props for {@link BadgeSheetProvider}. */
export interface BadgeSheetProviderProps {
  readonly renderers: BadgeSheetRenderers;
  readonly children: ReactNode;
}

/**
 * Publish the per-kind sheet bodies to the reading canvas.
 *
 * @param props - See {@link BadgeSheetProviderProps}.
 * @returns The subtree, with the renderers in scope. Side effects: none.
 */
export function BadgeSheetProvider({ renderers, children }: BadgeSheetProviderProps): JSX.Element {
  return <BadgeSheetContext.Provider value={renderers}>{children}</BadgeSheetContext.Provider>;
}

/**
 * The body renderer for one badge kind, if one is registered.
 *
 * @param kind - Which badge type.
 * @returns The renderer, or `undefined`. Side effects: subscribes to the context.
 */
export function useBadgeSheetRenderer(kind: BadgeKind): BadgeSheetRenderer | undefined {
  return useContext(BadgeSheetContext)[kind];
}
