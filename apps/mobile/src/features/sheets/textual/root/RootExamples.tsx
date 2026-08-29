/**
 * RootExamples — where the word appears.
 *
 * Purpose
 *   `image6.png` puts an EXAMPLES OF USE list at the foot of the sheet, each row a
 *   reference the reader can follow. This is that list, sized to the data that actually
 *   exists.
 *
 * What the data supports, and what it does not
 *   `RootPayloadOut` carries three counts and no concordance: there is no endpoint that
 *   returns the other verses a lemma occurs in. So this section lists the one verse the
 *   sheet can name with certainty — the one the reader is standing in — and states the
 *   count for the rest. It does not render an empty list under a heading that promises
 *   several, and it does not link to verses it has not been given.
 *
 *   That is a smaller section than the mockup's, and it is the honest size. Every `[Root]`
 *   badge in the corpus today is a single occurrence anyway (the builder badges words
 *   occurring twelve times or fewer, and the ones that clear the alignment bar are all
 *   hapax legomena), so for every badge that ships, this list is complete.
 *
 * Responsibilities
 *   - Owns: the section and its caption.
 *   - Does NOT own: the row. That is `chrome/ReferenceRow`, shared with the Cross-Ref
 *     sheet so a passage link looks the same wherever a reader meets one.
 */

import type { JSX } from 'react';

import type { VerseKey } from '@atlas/shared';

import { ReferenceRow } from '../chrome/ReferenceRow';
import { SheetSection } from '../chrome/SheetSection';
import type { RootSheetPayload } from '../model/textual-payloads';
import { verseLabel, verseTarget, type VerseTarget } from '../model/verse-target';
import { examplesCaption } from './root-usage';

/** Inputs to {@link RootExamples}. */
export interface RootExamplesProps {
  /** The `[Root]` payload, for the caption's counts. */
  readonly payload: RootSheetPayload;
  /** The verse the badge is anchored to. */
  readonly verse: VerseKey;
  /** That verse's text, when the host has it. Omitted, the row is reference-only. */
  readonly verseText?: string | undefined;
  /** Open a passage in the reader. Omitted, the row is not pressable. */
  readonly onOpenVerse?: ((target: VerseTarget) => void) | undefined;
  /** The badge's hue, for the section eyebrow. */
  readonly tint: string;
}

/**
 * The where-it-appears section.
 *
 * @param props - See {@link RootExamplesProps}.
 * @returns The section.
 *
 * Side effects: none beyond `onOpenVerse`.
 */
export function RootExamples({
  payload,
  verse,
  verseText,
  onOpenVerse,
  tint,
}: RootExamplesProps): JSX.Element {
  const target = verseTarget(verse);

  return (
    <SheetSection
      eyebrow="Where it appears"
      badgeTint={tint}
      caption={examplesCaption(payload)}
      testID="root-examples"
    >
      <ReferenceRow
        testID="root-example-row"
        reference={verseLabel(verse)}
        text={verseText}
        onPress={
          onOpenVerse === undefined
            ? undefined
            : () => {
                onOpenVerse(target);
              }
        }
        accessibilityLabel={`Open ${target.label}`}
      />
    </SheetSection>
  );
}
