/**
 * Labelling a `[Cultural]` payload's world.
 *
 * Purpose
 *   `CulturalWorld` is a kebab-case discriminant meant for code, not for a reader
 *   (`historical-badge.types.ts`). This is the one place that turns it into the label
 *   `CulturalSheet`'s heading prints, so the mapping cannot drift between call sites.
 *
 * Dependencies
 *   `@atlas/shared`'s `CulturalWorld`. Pure — no React.
 */

import type { CulturalWorld } from '@atlas/shared';

/**
 * The reader-facing name of a cultural world.
 *
 * @param world - The discriminant.
 * @returns The label, e.g. `Second Temple Judaism`. Side effects: none.
 */
export function worldLabel(world: CulturalWorld): string {
  switch (world) {
    case 'ancient-near-east':
      return 'Ancient Near East';
    case 'second-temple-judaism':
      return 'Second Temple Judaism';
    case 'greco-roman':
      return 'Greco-Roman world';
  }
}
