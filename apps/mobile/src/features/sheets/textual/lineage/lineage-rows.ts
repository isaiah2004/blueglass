/**
 * Turning a `[Lineage]` payload's people and edges into printable rows.
 *
 * Purpose
 *   `LineageBadgePayload` types a family tree as people plus relationships rather than as
 *   nested children, because the same person can appear on more than one line
 *   (`literary-badge.types.ts`). That shape is exactly right for storage and wrong for
 *   reading straight off — a reader wants "David is the father of Solomon," not an edge
 *   list — so this module is the one place that turns an edge into that sentence.
 *
 * Why a list instead of a drawn tree
 *   `image4.png`'s tree/timeline graph needs a layout engine this pass does not have. A
 *   list that names every person and every relationship in full sentences carries the same
 *   facts and degrades gracefully — nothing here blocks a graph view being added later,
 *   since it would read from the same `people`/`relations` arrays.
 *
 * Dependencies
 *   `@atlas/shared`'s `LineagePerson`/`LineageRelation`. Pure — no React.
 */

import type { LineagePerson, LineageRelation } from '@atlas/shared';

/** Look up one person by id. */
export function personById(
  people: readonly LineagePerson[],
  id: string,
): LineagePerson | undefined {
  return people.find((person) => person.id === id);
}

/**
 * One relation, as a full sentence.
 *
 * @param relation - The edge.
 * @param people - Every person in the graph, to resolve the edge's two ends.
 * @returns The sentence, or `undefined` when either end names a person not in `people` —
 *   a malformed edge is dropped rather than printed with a blank name.
 *   Side effects: none.
 */
export function relationSentence(
  relation: LineageRelation,
  people: readonly LineagePerson[],
): string | undefined {
  const from = personById(people, relation.fromPersonId);
  const to = personById(people, relation.toPersonId);

  if (from === undefined || to === undefined) {
    return undefined;
  }

  switch (relation.kind) {
    case 'parent-of':
      return `${from.name} is the parent of ${to.name}.`;
    case 'spouse-of':
      return `${from.name} is married to ${to.name}.`;
    case 'ancestor-of':
      return `${from.name} is an ancestor of ${to.name}.`;
  }
}

/** One person's line under their name, e.g. `king of Israel`. */
export function personCaption(person: LineagePerson): string | undefined {
  return person.epithet;
}
