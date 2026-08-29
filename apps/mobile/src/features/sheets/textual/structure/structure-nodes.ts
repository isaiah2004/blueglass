/**
 * Turning a `[Structure]` payload's nodes into printable rows.
 *
 * Purpose
 *   `StructureBadgePayload` types a chiasm or parallel as a flat list of nodes, each naming
 *   its own mirror by id rather than nesting (`literary-badge.types.ts`) — the same shape
 *   choice `lineage-rows.ts` makes for a family tree, and for the same reason: printing the
 *   pairing needs a lookup, not a walk.
 *
 * Dependencies
 *   `@atlas/shared`'s `StructuralNode`. Pure — no React.
 */

import type { StructuralNode } from '@atlas/shared';

/** Look up one node by id. */
export function nodeById(
  nodes: readonly StructuralNode[],
  id: string,
): StructuralNode | undefined {
  return nodes.find((node) => node.id === id);
}

/**
 * The mirror line under a node, e.g. `Mirrors A — Vision at Troas`.
 *
 * @param node - The node to describe.
 * @param nodes - Every node in the structure, to resolve `mirrorNodeId`.
 * @returns The line, or `undefined` for the pivot node at a chiasm's centre, which by
 *   definition has no mirror. Side effects: none.
 */
export function mirrorLine(
  node: StructuralNode,
  nodes: readonly StructuralNode[],
): string | undefined {
  if (node.mirrorNodeId === undefined) {
    return undefined;
  }

  const mirror = nodeById(nodes, node.mirrorNodeId);

  return mirror === undefined
    ? undefined
    : `Mirrors ${mirror.symmetryLabel} — ${mirror.text}`;
}
