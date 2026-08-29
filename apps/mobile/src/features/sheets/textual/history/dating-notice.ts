/**
 * What the History sheet must say about the date it is showing.
 *
 * Purpose
 *   Two decisions make the `[History]` sheet the most obligation-carrying of the three.
 *   `Q-016` caps open per-passage dating at the New Testament era, because the only
 *   available Old Testament chronology is Ussher's and shipping 4004 BC as fact is not an
 *   option. `Q-015` requires Hajime Murai's division of the text to be shown as *Murai's
 *   reading*, never as a settled heading. Both are wording, and wording is exactly what
 *   drifts, so both live here as pure functions with tests.
 *
 * Key responsibilities
 *   - Produce the Murai attribution note, and produce nothing at all when the attribution
 *     is incomplete — an unattributed title is not shown at all rather than shown bare.
 *   - Produce the note that a dating is not sourced, when it is not.
 *   - Turn `confidence` into a phrase that says what it measures.
 *
 * `confidence` is coverage, not certainty
 *   `ASSUMPTIONS.md`, `H-03`: the number is *the fraction of the dating event that falls
 *   inside this passage*, chosen so that "Second Missionary Journey" (an umbrella spanning
 *   four chapters) loses to the episode actually on the page. Printing it as "60% confident"
 *   would be a different and false claim, so it is printed as coverage and named as such.
 *
 * Dependencies
 *   The folder's payload types. Pure — no React, no I/O, Node-testable.
 */

import type { HistorySheetPayload } from '../model/textual-payloads';

/** A qualification the sheet must print: a short label and a sentence. */
export interface DatingNotice {
  /** The uppercase label on the note. */
  readonly label: string;
  /** The qualification, in full sentences. */
  readonly body: string;
}

/** Percent, as a whole number. Coverage is not precise enough to warrant a decimal. */
const PERCENT = 100;

/**
 * `Q-016` in one sentence, shown on every History sheet.
 *
 * It is unconditional on purpose. A reader who sees a dated passage in Acts and none in
 * Genesis should be told why, at the place where the difference is visible, rather than
 * left to conclude that the Old Testament data is missing or broken.
 */
export const ERA_NOTE: DatingNotice = {
  label: 'New Testament dating only',
  body: 'Atlas Bible dates passages only in the New Testament era, where the sources agree within a few years. Old Testament passages carry no year, because the only openly available chronology for them is one 17th-century reconstruction and it is not fact.',
};

/**
 * The Murai attribution, when the payload is complete enough to earn one.
 *
 * All three fields travel together or not at all. The server already drops the title when
 * its attribution cannot be resolved (`builders/history.py`), and this repeats the check
 * on the render side: a heading that arrives without its scholar is not a heading, and
 * showing it anyway would turn one reading of the text into the app's own claim.
 *
 * @param payload - The `[History]` payload.
 * @returns The note, or `undefined` when there is no attributed title to show.
 *   Side effects: none.
 *
 * @example
 * muraiNotice(payload)?.label; // "Murai's reading"
 */
export function muraiNotice(payload: HistorySheetPayload): DatingNotice | undefined {
  const { passageTitle, interpretiveClaim, attributedTo } = payload;
  if (passageTitle === undefined || interpretiveClaim === undefined || attributedTo === undefined) {
    return undefined;
  }

  return {
    label: interpretiveClaim,
    body: `“${passageTitle}” is how ${attributedTo} divides and titles this passage. It is one scholar's reading of the text's structure, not a heading in the text itself.`,
  };
}

/**
 * The title a sheet may print as a heading.
 *
 * @param payload - The `[History]` payload.
 * @returns The title, or `undefined` when it is not fully attributed and therefore not
 *   printable as a heading. Side effects: none.
 */
export function attributedTitle(payload: HistorySheetPayload): string | undefined {
  return muraiNotice(payload) === undefined ? undefined : payload.passageTitle;
}

/**
 * The note that a date did not come from a dataset.
 *
 * Every row M2 ships is `sourced`, so this returns `undefined` for all of them. It exists
 * because the field can hold `generated` and `authored`, and the day one of those reaches
 * a reader it must arrive labelled rather than indistinguishable from a sourced year.
 *
 * @param payload - The `[History]` payload.
 * @returns The note, or `undefined` when the dating is sourced. Side effects: none.
 */
export function originNotice(payload: HistorySheetPayload): DatingNotice | undefined {
  if (payload.datingOrigin === 'sourced') {
    return undefined;
  }
  const written =
    payload.datingOrigin === 'generated' ? 'written by a language model' : 'written by an editor';

  return {
    label: 'Not from a dataset',
    body: `This date was ${written} rather than taken from a published chronology. Treat it as a working estimate.`,
  };
}

/**
 * How much of the passage the dating event narrates, as a phrase.
 *
 * @param payload - The `[History]` payload.
 * @returns A phrase naming what the number measures, or `undefined` when the payload
 *   carries no confidence. Side effects: none.
 *
 * @example
 * coveragePhrase(payload); // 'Covers about 60% of the passage'
 */
export function coveragePhrase(payload: HistorySheetPayload): string | undefined {
  const { confidence } = payload;
  if (confidence === undefined) {
    return undefined;
  }
  const percent = Math.round(confidence * PERCENT);

  return `Covers about ${String(percent)}% of the passage`;
}

/**
 * What the sheet says when neither axis has anything for this year.
 *
 * @param payload - The `[History]` payload.
 * @returns The sentence. Side effects: none.
 */
export function emptyTimelineCopy(payload: HistorySheetPayload): string {
  return `No contemporary rulers or narrated events are sourced for ${payload.passageYearLabel}. The date itself still stands — the timeline around it does not.`;
}
