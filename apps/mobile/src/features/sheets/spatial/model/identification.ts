/**
 * The two sentences a single pin owes the reader when it is not the only candidate.
 *
 * Purpose
 *   `DECISIONS.md` #10: a sheet showing one pin for a shared or disputed identification
 *   says the identification is shared, rather than presenting one candidate as settled.
 *   There are two ways a pin can be one of several, they are independent, and both were
 *   measured on the loaded gazetteer:
 *
 *     - **The name is shared.** Nine different ancient places are called Ramah, four
 *       Gilgal, three Babylon, three Bethel. 1,122 of the canon's 4,298 route waypoints
 *       carry a name two to nine places share.
 *     - **The site is disputed.** 777 of the 1,342 ancient places have more than one
 *       proposed modern site for the one place.
 *
 *   The first was invisible. `homonym_count` reached the database in revision `0008` and
 *   nothing read it: before that revision the label at least read "Ramah 2" — an ordinal
 *   no manuscript contains — and removing it replaced a wrong signal with none, which a
 *   reader takes as certainty. This module is the replacement that revision specified.
 *
 * Why the wording avoids "may be"
 *   The gazetteer's claim is exact — it knows precisely how many places share the name —
 *   so the sentence states the count. Hedging a countable fact reads as an apology and
 *   tells the reader less than the number does.
 *
 * Dependencies
 *   None. Pure formatting, testable under Node.
 */

/** Below this there is nothing to caveat: one place of the name, one site proposed. */
const SETTLED = 1;

/**
 * Say that other places carry this name.
 *
 * @param sharedNameCount - How many ancient places are called this, from the gazetteer.
 * @returns The sentence, or `null` when the name belongs to one place only — in which
 *   case there is nothing to say and a reassurance would be noise. Side effects: none.
 */
export function sharedNameNote(sharedNameCount: number): string | null {
  if (sharedNameCount <= SETTLED) return null;
  return `One of ${String(sharedNameCount)} places of this name`;
}

/**
 * Say that scholarship proposes more than one site for this place.
 *
 * @param candidateCount - How many modern sites the gazetteer records for it.
 * @returns The sentence, or `null` when one site is proposed. Side effects: none.
 */
export function disputedSiteNote(candidateCount: number): string | null {
  if (candidateCount <= SETTLED) return null;
  return `${String(candidateCount)} proposed sites`;
}

/**
 * Both caveats and the pin's feature type, as one metadata line.
 *
 * @param featureType - The gazetteer's class, e.g. `settlement`.
 * @param sharedNameCount - How many places carry this name.
 * @param candidateCount - How many modern sites are proposed for this one.
 * @returns e.g. `settlement · One of 9 places of this name`. Side effects: none.
 */
export function identificationLine(
  featureType: string,
  sharedNameCount: number,
  candidateCount: number,
): string {
  const parts = [featureType, sharedNameNote(sharedNameCount), disputedSiteNote(candidateCount)];
  return parts.filter((part): part is string => part !== null && part.length > 0).join(' · ');
}
