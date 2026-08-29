/**
 * Home tab — the Daily Home Canvas.
 *
 * Will hold: the brand lockup, Today's Drop hero, the three-step 5-minute loop checklist,
 * the streak ring and progress sparkline, and the quick-access media cards
 * (`docs/product/prd.md` "Tab 1"; mockups `image3.png`, `image10.png`).
 *
 * What is real here today
 *   The responsive frame, the design language's surfaces, and both themes. The content is
 *   still copy rather than data — the streak, the drop and the loop all need the sync model
 *   `A-03` describes, which is not built. Nothing here decides how that data is shaped.
 */

import type { JSX } from 'react';

import { SectionCard } from '@/components/surface/SectionCard';
import { ScreenScaffold } from '@/components/surface/ScreenScaffold';
import { StatRow } from '@/components/surface/StatRow';

/** @returns The Home tab. */
export default function HomeScreen(): JSX.Element {
  return (
    <ScreenScaffold eyebrow="See. Hear. Understand." title="Atlas Bible" testID="home-screen">
      <SectionCard
        eyebrow="Today's Drop"
        title="Acts 1 — Waiting in Jerusalem"
        body="Five minutes: read the chapter, follow one thread of context, write a line. A day completes on opening and reading."
        accent="gold"
        testID="home-todays-drop"
      >
        <StatRow
          stats={[
            { value: '0', caption: 'Day streak' },
            { value: '26', caption: 'Verses' },
            { value: '5 min', caption: 'To finish' },
          ]}
        />
      </SectionCard>

      <SectionCard
        eyebrow="The loop"
        title="Listen · Explore · Reflect"
        body="The three steps stay as content. They no longer gate the streak — opening and reading is enough."
        accent="gold"
      />

      <SectionCard
        eyebrow="Grounded"
        title="Every claim carries a citation"
        body="Context arrives inside the verse you are already reading, never behind a detour, and never without a source."
      />
    </ScreenScaffold>
  );
}
