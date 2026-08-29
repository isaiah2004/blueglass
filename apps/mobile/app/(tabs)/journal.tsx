/**
 * Journal tab — the reader's own writing.
 *
 * Will hold: entries, prompts tied to the day's passage, and the saved highlights and notes
 * that feed them (`docs/product/prd.md` "Tab 5").
 *
 * The constraint that shapes this screen
 *   Decision `J-01`: entries are encrypted on the client before they sync. The server holds
 *   ciphertext and can never read, search, or index one. Nothing in this scaffold assumes
 *   otherwise, because a search box wired to the server would be the exact mistake.
 */

import type { JSX } from 'react';

import { ScreenScaffold } from '@/components/surface/ScreenScaffold';
import { SectionCard } from '@/components/surface/SectionCard';

/** @returns The Journal tab. */
export default function JournalScreen(): JSX.Element {
  return (
    <ScreenScaffold eyebrow="Your own words" title="Journal" testID="journal-screen">
      <SectionCard
        eyebrow="Private"
        title="Encrypted before it leaves the device"
        body="Entries are encrypted on this device and sync as ciphertext. The server cannot read, search, or index them."
        accent="gold"
      />
      <SectionCard
        eyebrow="Today"
        title="One line is enough"
        body="The reflection step of the daily loop. It is content, not a gate: the day completes when you open and read."
        accent="gold"
      />
      <SectionCard
        eyebrow="Saved"
        title="Highlights and notes"
        body="Everything marked while reading collects here, each one still pointing back at its verse."
        accent="gold"
      />
    </ScreenScaffold>
  );
}
