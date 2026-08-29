/**
 * Discover tab — the atlas surfaces.
 *
 * Will hold: search, the 3D travel-route cards, the dual-axis empire timeline, and the
 * literary-pattern node graph (`docs/product/prd.md` "Tab 3"; mockup `image5.png`).
 *
 * Scaffold content only. The datasets behind each card are catalogued in
 * `docs/architecture/data-inventory.md`; none of them is wired yet.
 */

import type { JSX } from 'react';

import { ScreenScaffold } from '@/components/surface/ScreenScaffold';
import { SectionCard } from '@/components/surface/SectionCard';

/** @returns The Discover tab. */
export default function DiscoverScreen(): JSX.Element {
  return (
    <ScreenScaffold eyebrow="The atlas" title="Discover" testID="discover-screen">
      <SectionCard
        eyebrow="Routes"
        title="3D travel routes"
        body="Paul's journeys drawn over real terrain, with every place name resolved against a gazetteer rather than generated."
      />
      <SectionCard
        eyebrow="History"
        title="The empire timeline"
        body="A dual-axis timeline: scripture on one axis, the empires around it on the other."
      />
      <SectionCard
        eyebrow="Structure"
        title="Literary patterns"
        body="Chiastic structure as a node graph, from 10,304 openly licensed nodes covering the whole canon."
      />
    </ScreenScaffold>
  );
}
