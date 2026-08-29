/**
 * The v1 -> v3 storage migration (spec §4.1–§4.2). PURE: it imports no filesystem module, by rule.
 *
 * Why pure: this function is the only thing standing between 11 answers a human already
 * gave and a silent data loss. A pure `migrate(db) -> db` can be run a hundred times
 * against a copy, diffed field by field, and proved idempotent before it is ever allowed
 * near the real file. A function that read or wrote the disk itself could not be.
 *
 * ADDITIVE ONLY. Every field in IDENTITY_FIELDS must be deep-equal before and after; the
 * migration may only add. `verify-migration.mjs` asserts exactly that.
 *
 * Version 2 is skipped deliberately: the old `EMPTY_DB` claimed `version: 2` for a shape
 * no file on disk ever had, so jumping to 3 makes "which shape is this" answerable from
 * the version number alone.
 */
import { deriveAnswerDetail } from './answer-detail.mjs';

export const SCHEMA_VERSION = 3;

/**
 * Thrown when `migrate()` is handed a database written by a newer server.
 *
 * A named type (rule 6.1.3) so a caller can tell "this file is from the future" apart from
 * "this file is corrupt" and react differently: the first means *start the other server*,
 * the second means *restore a backup*.
 */
export class FutureSchemaError extends Error {
  constructor(onDisk) {
    super('this database is schema v' + onDisk + ' but this build only understands v' + SCHEMA_VERSION +
      '. Refusing to migrate it: every v' + onDisk + ' field would be dropped. Use the newer build instead.');
    this.name = 'FutureSchemaError';
    this.onDisk = onDisk;
    this.understood = SCHEMA_VERSION;
  }
}

/**
 * The fields the migration is forbidden to touch. Exported so the verification tool and
 * `answers.mjs` (the old-reader equivalence oracle) share one definition rather than two
 * that can drift apart.
 */
export const IDENTITY_FIELDS = Object.freeze([
  'id', 'section', 'question', 'why', 'kind', 'options', 'answer', 'note', 'status',
  'askedBy', 'blocking', 'recommended', 'defaultAnswer', 'askedAt', 'answeredAt',
]);

/** Kinds that get a free-text "Other" escape by default. */
const OTHER_KINDS = new Set(['choice', 'multi', 'rank']);

/**
 * Add the v3 fields to one question. Idempotent: every assignment is `??=`, so a record
 * that already carries a field keeps its own value untouched.
 */
export function migrateQuestion(question) {
  const out = { ...question };
  out.attachments ??= [];
  out.optionMeta ??= {};
  out.allowOther ??= OTHER_KINDS.has(out.kind);
  out.layout ??= 'list';
  out.assumedInUse ??= false;
  out.priority ??= null;
  out.withdrawnAt ??= null;
  out.withdrawReason ??= null;
  out.updatedAt ??= out.answeredAt ?? out.askedAt ?? null;
  if (out.answerDetail === undefined) {
    out.answerDetail = out.status === 'answered' ? deriveAnswerDetail(out, 'imported') : null;
  }
  return out;
}

/**
 * Migrate a whole database to v3.
 *
 * @param {object} db      Parsed contents of questions.json. Never mutated.
 * @param {object} [opts]  `now` is injectable so tests get a deterministic migratedAt.
 * @returns {object}       A new v3 database. `migrate(migrate(db))` deep-equals `migrate(db)`.
 * @throws  {FutureSchemaError} If `db.version` is newer than this build understands.
 */
export function migrate(db, { now = () => new Date().toISOString() } = {}) {
  // Fail fast, before a single field is touched. `loadDb()` guards this too, but the guard
  // has to live HERE: this is the pure function every other caller reaches for — the dry-run
  // verifier, tooling, whatever is written next — and a downgrade is silent by nature. It
  // produces a plausible-looking v3 file with every newer field quietly stripped, and the
  // only evidence left behind is a `migratedFrom: 99` nobody reads until the data is gone.
  const onDisk = db?.version ?? 1;
  if (onDisk > SCHEMA_VERSION) throw new FutureSchemaError(onDisk);

  const out = structuredClone(db ?? {});
  out.questions = (Array.isArray(out.questions) ? out.questions : []).map(migrateQuestion);
  // Existing events get their seq by index; the log has only ever been appended to.
  out.events = (Array.isArray(out.events) ? out.events : []).map((event, i) => (event.seq === undefined ? { ...event, seq: i + 1 } : event));
  out.status = out.status ?? null;
  const lastSeq = out.events.length > 0 ? out.events[out.events.length - 1].seq : 0;
  out.seq = Math.max(out.seq ?? 0, lastSeq);
  if (out.version !== SCHEMA_VERSION) {
    out.migratedFrom = out.version ?? 1;
    out.migratedAt = now();
    out.version = SCHEMA_VERSION;
  }
  return out;
}

/**
 * A summary of what a migration did, for the dry-run report. Pure, so the verification
 * tool can print it without loading the server.
 */
export function summarise(before, after) {
  const byKind = {};
  const normalised = [];
  const needsReview = [];
  for (const question of after.questions ?? []) {
    byKind[question.kind] = (byKind[question.kind] ?? 0) + 1;
    const detail = question.answerDetail;
    if (!detail) continue;
    if (detail.match === 'normalised') normalised.push({ id: question.id, answer: question.answer, selected: detail.selected });
    if (detail.needsReview) needsReview.push({ id: question.id, answer: question.answer, other: detail.other });
  }
  return {
    fromVersion: before?.version ?? 1,
    toVersion: after.version,
    questions: (after.questions ?? []).length,
    answered: (after.questions ?? []).filter((q) => q.status === 'answered').length,
    events: (after.events ?? []).length,
    byKind,
    normalised,
    needsReview,
  };
}
