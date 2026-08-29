/**
 * CrossRefTargetRow — one linked passage in the `[Cross-Ref]` sheet.
 *
 * Purpose
 *   Binds one target to the shared `ReferenceRow`: the reference, the scripture, the
 *   strength meter, the note when the text is only part of the span, and the destination a
 *   tap resolves to. Separated from `CrossRefSheet` so the sheet stays a description of
 *   sections rather than a description of a row.
 *
 * Responsibilities
 *   - Owns: what one target contributes to the row — the meter and the first-verse note.
 *   - Does NOT own: the row's layout (that is `chrome/ReferenceRow`, shared with `[Root]`),
 *     the ranking, or where the tap goes.
 */

import type { JSX } from 'react';

import type { CrossReferenceTarget } from '@atlas/shared';

import { ReferenceRow } from '../chrome/ReferenceRow';
import { rangeTarget, type VerseTarget } from '../model/verse-target';
import { StrengthMeter } from './StrengthMeter';
import { targetNote } from './crossref-targets';

/** Inputs to {@link CrossRefTargetRow}. */
export interface CrossRefTargetRowProps {
  /** The linked passage. */
  readonly target: CrossReferenceTarget;
  /** The badge's hue. */
  readonly tint: string;
  /** Open the passage in the reader. Omitted, the row is readable but not pressable. */
  readonly onOpenVerse?: ((destination: VerseTarget) => void) | undefined;
}

/**
 * One linked passage.
 *
 * @param props - See {@link CrossRefTargetRowProps}.
 * @returns The row.
 *
 * Side effects: none beyond `onOpenVerse`.
 */
export function CrossRefTargetRow({
  target,
  tint,
  onOpenVerse,
}: CrossRefTargetRowProps): JSX.Element {
  const destination = rangeTarget(target.range, target.displayReference);

  return (
    <ReferenceRow
      testID={`cross-ref-row-${String(target.range.start.value)}`}
      reference={target.displayReference}
      text={target.text}
      note={targetNote(target)}
      trailing={<StrengthMeter votes={target.votes} tint={tint} />}
      onPress={
        onOpenVerse === undefined
          ? undefined
          : () => {
              onOpenVerse(destination);
            }
      }
      accessibilityLabel={`Open ${destination.label}`}
    />
  );
}
