/**
 * Payloads for the three pattern badges: Structure, Lineage, and Meditate.
 *
 * Purpose
 *   These three show shape rather than fact — the Poetic Chiasm sheet (a colour-coded
 *   node graph of literary symmetry, A → B → C → B' → A'), the Lineage sheet (a 3D
 *   family-tree graph connecting figures to messianic prophecy), and the Meditate sheet
 *   (the devotional pause that completes the 5-minute habit loop's "reflect" step).
 *
 * Key responsibilities
 *   - Type a chiasm as nodes that name their own mirror, so the graph can draw the
 *     symmetry instead of inferring it from label text.
 *   - Type a family tree as people plus relationships, never as nested children — the
 *     same person appears in more than one line and a tree shape would duplicate them.
 *
 * Dependencies
 *   `./badge-envelope.types`. Pure types.
 *
 * Habit-loop constraint
 *   `suggestedDurationSeconds` exists so the daily path can be proved completable in
 *   five minutes (pillar 4). A meditation with no stated length cannot be budgeted.
 */

import type { InlineBadgeBase } from './badge-envelope.types';

/** One element of a chiastic or parallel structure. */
export interface StructuralNode {
  /** Stable identifier within the badge. */
  readonly id: string;
  /** The symmetry marker, e.g. `A`, `B`, `B'`. Drives the node's colour pairing. */
  readonly symmetryLabel: string;
  /** What happens at this point, e.g. `Vision at Troas`. */
  readonly text: string;
  /** Nesting depth: 0 for the outermost pair, rising toward the centre. */
  readonly depth: number;
  /**
   * The node this one mirrors. Absent for the pivot at the centre of a chiasm, which by
   * definition has no partner — that absence is the structure's whole point.
   */
  readonly mirrorNodeId?: string;
}

/** Sheet content for `[🌳 Structure]` — the literary shape of a passage. */
export interface StructureBadgePayload {
  /** The form, e.g. `Chiasm`, `Historical Narrative`, `Synonymous parallelism`. */
  readonly literaryType: string;
  /** The nodes, in reading order. Pair them through `mirrorNodeId`, not by index. */
  readonly nodes: readonly StructuralNode[];
  /** One sentence on what the shape is doing to the reader. */
  readonly summary: string;
}

/** How two people in a lineage are related. */
export type LineageRelationKind = 'parent-of' | 'spouse-of' | 'ancestor-of';

/** One figure in a lineage graph. */
export interface LineagePerson {
  /** Stable identifier within the badge. */
  readonly id: string;
  /** The name as scripture gives it, e.g. `David`. */
  readonly name: string;
  /** A few words of identification, e.g. `king of Israel`. */
  readonly epithet?: string;
  /** Where the figure is introduced, as an OSIS id, for the jump-to-verse action. */
  readonly introducedAtOsis?: string;
}

/** One edge of a lineage graph. */
export interface LineageRelation {
  /** Identifier of the person the edge starts at. */
  readonly fromPersonId: string;
  /** Identifier of the person the edge ends at. */
  readonly toPersonId: string;
  /** What kind of edge it is. */
  readonly kind: LineageRelationKind;
}

/** A figure's connection to a messianic prophecy. */
export interface MessianicLink {
  /** Identifier of the person the prophecy attaches to. */
  readonly personId: string;
  /** The prophecy's location, as an OSIS id. */
  readonly prophecyOsis: string;
  /** One sentence on the connection. */
  readonly note: string;
}

/** Sheet content for `[🧬 Lineage]` — the family tree behind a name. */
export interface LineageBadgePayload {
  /** The person the verse names; the graph opens centred on them. */
  readonly focusPersonId: string;
  /** Everyone in the graph, including the focus. */
  readonly people: readonly LineagePerson[];
  /** The edges between them. */
  readonly relations: readonly LineageRelation[];
  /** Connections to messianic prophecy. Empty for a lineage that has none. */
  readonly messianicLinks: readonly MessianicLink[];
}

/** Sheet content for `[🧘 Meditate]` — the reflect step of the daily loop. */
export interface MeditateBadgePayload {
  /** The invitation, one or two sentences, addressed to the reader. */
  readonly prompt: string;
  /** Questions to sit with. Also seed the Journal entry if the reader writes one. */
  readonly reflectionQuestions: readonly string[];
  /** How long the pause is designed to take. Counts against the 5-minute budget. */
  readonly suggestedDurationSeconds: number;
  /** Length of one guided breath cycle, when the sheet offers breathing pacing. */
  readonly breathCycleSeconds?: number;
}

/** The `[🌳 Structure]` badge, ready to render. */
export type StructureBadge = InlineBadgeBase<'structure', StructureBadgePayload>;

/** The `[🧬 Lineage]` badge, ready to render. */
export type LineageBadge = InlineBadgeBase<'lineage', LineageBadgePayload>;

/** The `[🧘 Meditate]` badge, ready to render. */
export type MeditateBadge = InlineBadgeBase<'meditate', MeditateBadgePayload>;
