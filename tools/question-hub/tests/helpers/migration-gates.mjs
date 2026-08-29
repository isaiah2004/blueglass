/**
 * The v1 -> v3 migration gates, as pure functions.
 *
 * These live here rather than inside `verify-migration.mjs` so the *same* assertions
 * run in two places: the one-off pre-restart CLI gate, and the `node:test` suite that
 * runs on every `smoke.mjs`. A gate that only exists inside a script is a gate nobody
 * re-runs after the next refactor.
 *
 * Nothing in this module touches the filesystem or the clock.
 */
import { isDeepStrictEqual } from 'node:util';

/**
 * The fields the migration is forbidden to touch (hub-platform.md §4.6.3).
 *
 * Deep-equality across this list, before and after, is what turns "the migration is
 * additive only" from a claim in a comment into a mechanical fact. `answer` and
 * `answeredAt` are the two that actually carry the human's work; the rest are here so
 * a careless rewrite of any field is caught by the same gate rather than a new one.
 */
export const IDENTITY_FIELDS = Object.freeze([
  'id',
  'section',
  'question',
  'why',
  'kind',
  'options',
  'answer',
  'note',
  'status',
  'askedBy',
  'blocking',
  'recommended',
  'defaultAnswer',
  'askedAt',
  'answeredAt',
]);

/** Fields v3 is expected to add to every question record (hub-platform.md §4.1). */
export const ADDED_QUESTION_FIELDS = Object.freeze([
  'answerDetail',
  'attachments',
  'optionMeta',
  'allowOther',
  'layout',
  'assumedInUse',
  'priority',
  'withdrawnAt',
  'withdrawReason',
  'updatedAt',
]);

/**
 * Assert the migration only added.
 *
 * Checks three separate ways a migration can quietly lose an answer: dropping a
 * question entirely, renaming an id so the old one vanishes, and rewriting the value
 * of a frozen field in place.
 *
 * @returns {{ ok: boolean, failures: Array<object> }}
 */
export function identityGate(before, after) {
  const failures = [];
  const afterById = new Map((after.questions ?? []).map((q) => [q.id, q]));

  for (const original of before.questions ?? []) {
    const migrated = afterById.get(original.id);
    if (!migrated) {
      failures.push({ id: original.id, field: '<whole record>', reason: 'missing after migration' });
      continue;
    }
    for (const field of IDENTITY_FIELDS) {
      if (!isDeepStrictEqual(original[field], migrated[field])) {
        failures.push({
          id: original.id,
          field,
          reason: 'changed by migration',
          before: original[field],
          after: migrated[field],
        });
      }
    }
  }

  const beforeIds = new Set((before.questions ?? []).map((q) => q.id));
  for (const migrated of after.questions ?? []) {
    if (!beforeIds.has(migrated.id)) {
      failures.push({ id: migrated.id, field: '<whole record>', reason: 'invented by migration' });
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * Assert running the migration twice changes nothing the second time.
 *
 * The realistic failure this catches: a server restarted twice re-stamping `migratedAt`
 * or re-deriving `answerDetail` from an already-derived `answer`, which would slowly
 * rewrite the human's answers on every boot.
 *
 * @param {(db: object) => object} migrate
 */
export function idempotenceGate(migrate, db) {
  const once = migrate(structuredClone(db));
  const twice = migrate(structuredClone(once));
  return { ok: isDeepStrictEqual(once, twice), once, twice };
}

/** Every answered question whose answer had to be reconciled by the normalised pass. */
export function normalisedMatches(db) {
  return (db.questions ?? [])
    .filter((q) => q.answerDetail && q.answerDetail.match === 'normalised')
    .map((q) => ({ id: q.id, answer: q.answer, selected: q.answerDetail.selected ?? [] }));
}

/** Every question the migration could not confidently reconcile. */
export function needsReview(db) {
  return (db.questions ?? [])
    .filter((q) => q.answerDetail && q.answerDetail.needsReview === true)
    .map((q) => ({ id: q.id, answer: q.answer, other: q.answerDetail.other ?? null }));
}

/** Count questions by kind, so the dry-run report can show the shape of the corpus. */
export function countsByKind(db) {
  const counts = {};
  for (const q of db.questions ?? []) counts[q.kind] = (counts[q.kind] ?? 0) + 1;
  return counts;
}

/**
 * The set of keys the migration added to a record, sampled across the whole DB.
 * Reported rather than asserted: the spec fixes a minimum, not a maximum.
 */
export function addedFieldNames(before, after) {
  const beforeKeys = new Set();
  for (const q of before.questions ?? []) for (const k of Object.keys(q)) beforeKeys.add(k);
  const added = new Set();
  for (const q of after.questions ?? []) {
    for (const k of Object.keys(q)) if (!beforeKeys.has(k)) added.add(k);
  }
  return [...added].sort();
}

/**
 * Count answers that survived the migration with their text intact.
 * This is the single number the human cares about: 11 in, 11 out.
 */
export function answerCensus(db) {
  const answered = (db.questions ?? []).filter((q) => q.status === 'answered');
  return {
    answered: answered.length,
    withText: answered.filter((q) => typeof q.answer === 'string' && q.answer.length > 0).length,
    ids: answered.map((q) => q.id),
  };
}
