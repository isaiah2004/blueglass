/**
 * Studio tab — grounded chat and generated artifacts.
 *
 * Will hold: the Grounded Chat / Custom Notebooks toggle, the audio overview card, and the
 * 2x2 artifact grid (`docs/product/prd.md` "Tab 4"; mockup `image12.png`).
 *
 * Scaffold content only. Every model call goes through `packages/ai-guard`; nothing here
 * calls a provider.
 */

import type { JSX } from 'react';

import { ScreenScaffold } from '@/components/surface/ScreenScaffold';
import { SectionCard } from '@/components/surface/SectionCard';

/** @returns The Studio tab. */
export default function StudioScreen(): JSX.Element {
  return (
    <ScreenScaffold eyebrow="Work with the text" title="Studio" testID="studio-screen">
      <SectionCard
        eyebrow="Grounded chat"
        title="Ask, with sources attached"
        body="Answers stream token by token with the retrieved sources shown as chips before the first word arrives."
      />
      <SectionCard
        eyebrow="Briefings"
        title="Executive briefings"
        body="A second pipeline beside retrieval: a short, cited brief on a passage, generated once and reviewed before it is visible."
      />
      <SectionCard
        eyebrow="Audio"
        title="Dual-host overview"
        body="Stubbed for this milestone: the player and hand-made sample tracks, foreground only."
      />
    </ScreenScaffold>
  );
}
