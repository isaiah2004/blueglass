/**
 * Everything that records a decision: answer, answer-batch, accept-recommendations, withdraw.
 *
 * Split out of questions.mjs so neither file carries two reasons to change: that one owns
 * what a question IS, this one owns what happens when the human settles it.
 *
 * Two live defects are fixed here and must stay fixed:
 *   D-A  withdraw is a SOFT delete. It used to splice the record out, destroying any answer
 *        already given. Withdrawn questions keep their answer and are simply excluded from
 *        the default read, which reproduces the old external behaviour exactly.
 *   D-C  an empty string can no longer un-answer a question. `answer` undefined, null or ''
 *        is skipped and reported in `skipped`; un-answering requires explicit `clear: true`.
 */
import { getDb, persist } from './db.mjs';
import { logEvent } from './events.mjs';
import { HttpError } from './http.mjs';
import { ANSWER_SOURCES, buildDetail, deriveAnswerDetail, flatten } from './answer-detail.mjs';

/**
 * Apply one answer entry to a question.
 *
 * @param {object} question       The stored record. Mutated in place.
 * @param {object} item           `{ answer?, answerDetail?, note?, clear?, source? }`.
 * @param {string} defaultSource  Provenance to record when the entry does not state one.
 * @returns {'saved'|'cleared'|'skipped'} What actually happened, so a batch reports honestly.
 * @throws {HttpError} 400 when an answerDetail names something that is not an option.
 */
export function applyAnswer(question, item, defaultSource) {
  const now = new Date().toISOString();
  if (item.clear === true) {
    question.answer = null;
    question.answerDetail = null;
    question.status = 'open';
    question.answeredAt = null;
    question.updatedAt = now;
    if (item.note !== undefined) question.note = item.note;
    return 'cleared';
  }
  const source = item.source ?? defaultSource;
  if (!ANSWER_SOURCES.includes(source)) throw new HttpError(400, 'source must be one of ' + ANSWER_SOURCES.join(', ') + '.');
  const hasDetail = Boolean(item.answerDetail) && typeof item.answerDetail === 'object' && !Array.isArray(item.answerDetail);
  const hasFlat = typeof item.answer === 'string' && item.answer !== '';
  if (!hasDetail && !hasFlat) {
    // D-C: undefined, null and '' never un-answer. A note-only update is still a real update.
    if (item.note === undefined) return 'skipped';
    question.note = item.note;
    question.updatedAt = now;
    return 'saved';
  }
  let detail;
  if (hasDetail) {
    const built = buildDetail(question, item.answerDetail, source);
    if (built.error) throw new HttpError(400, built.error);
    detail = built.detail;
  } else {
    detail = deriveAnswerDetail({ ...question, answer: item.answer }, source);
  }
  question.answerDetail = detail;
  question.answer = flatten(detail);
  question.status = 'answered';
  question.answeredAt = now;
  question.updatedAt = now;
  if (item.note !== undefined) question.note = item.note;
  return 'saved';
}

function mustFind(db, id) {
  const question = db.questions.find((x) => x.id === id);
  if (!question) throw new HttpError(404, 'No such question: ' + id + '.');
  return question;
}

/** Answer one question. */
export async function handleAnswer(body) {
  const db = getDb();
  const question = mustFind(db, body.id);
  const outcome = applyAnswer(question, body, 'human');
  if (outcome === 'skipped') {
    throw new HttpError(400, 'Nothing to apply for ' + body.id + '. Send "answer", "answerDetail" or "note" — or "clear": true to un-answer it.');
  }
  logEvent(db, 'answer', { id: question.id, outcome });
  await persist({ snapshot: true });
  return question;
}

/**
 * Answer many at once — what the UI's Save button uses.
 *
 * `saved` and `skipped` are both **arrays of bare id strings**, which is the frozen contract in
 * hub-platform.md §7. They are the two halves of one answer to "what happened to what I sent",
 * so they have to be the same shape: a caller that renders `skipped` the way it renders `saved`
 * — the obvious thing to write — must not get `[object Object]`.
 *
 * The *reason* each id was skipped is still worth having, so it rides alongside in
 * `skippedDetail`, added rather than substituted. That keeps the diagnosis (a typo'd id is a
 * caller bug; a missing answer is routine) without redefining a field other code already reads.
 */
export async function handleAnswerBatch(body) {
  if (!Array.isArray(body.answers)) throw new HttpError(400, 'answer-batch needs an "answers" array.');
  const db = getDb();
  const saved = [];
  const skippedDetail = [];
  const conflicts = [];
  for (const item of body.answers) {
    const question = db.questions.find((x) => x.id === item.id);
    if (!question) {
      skippedDetail.push({ id: item.id, reason: 'unknown-question' });
      continue;
    }
    // Optimistic concurrency: a client may state which version it edited (risk R-10).
    if (item.baseUpdatedAt && question.updatedAt && item.baseUpdatedAt < question.updatedAt) {
      conflicts.push({ id: item.id, mine: item.answer ?? null, theirs: question.answer, theirUpdatedAt: question.updatedAt });
      continue;
    }
    const outcome = applyAnswer(question, item, body.source ?? 'human');
    if (outcome === 'skipped') skippedDetail.push({ id: item.id, reason: 'no-answer-sent' });
    else saved.push(item.id);
  }
  const skipped = skippedDetail.map((entry) => entry.id);
  // `ids` is carried so a listener knows WHICH questions moved without re-reading them all.
  logEvent(db, 'answer-batch', { count: saved.length, ids: saved, skipped: skipped.length, conflicts: conflicts.length });
  await persist({ snapshot: true });
  return { saved, skipped, skippedDetail, conflicts };
}

/**
 * Bulk-accept the recommended answer for a whole section, or for an explicit id list.
 *
 * Questions with no recommendation are structurally excluded — those are the ones only the
 * human can settle, and they are never bulk-answered. `dryRun: true` returns exactly what
 * would happen and writes nothing, so a review sheet can be built from the server's own view.
 * Every acceptance records `source: "accepted-recommendation"`, which is the honest
 * bookkeeping that lets a later reader tell a considered decision from a bulk endorsement.
 */
export async function handleAcceptRecommendations(body) {
  const db = getDb();
  const ids = Array.isArray(body.ids) ? new Set(body.ids) : null;
  if (!ids && typeof body.section !== 'string') throw new HttpError(400, 'accept-recommendations needs a "section" string or an "ids" array.');
  const accepted = [];
  const skipped = [];
  let matched = 0;
  for (const question of db.questions) {
    if (ids ? !ids.has(question.id) : question.section !== body.section) continue;
    matched += 1;
    if (question.status !== 'open') {
      skipped.push({ id: question.id, reason: question.status });
    } else if (!question.recommended) {
      skipped.push({ id: question.id, reason: 'no-recommendation' });
    } else {
      accepted.push({ id: question.id, question: question.question, answer: question.recommended });
      if (body.dryRun !== true) applyAnswer(question, { answer: question.recommended }, 'accepted-recommendation');
    }
  }
  // A silently empty result cannot be told apart from a mistyped section, so say which it is.
  if (matched === 0) {
    throw new HttpError(400, ids
      ? 'None of those ids exist. Nothing was accepted.'
      : 'No questions are in section "' + body.section + '". Check the exact section string from GET /api/questions.');
  }
  if (body.dryRun === true) return { accepted, skipped, matched, dryRun: true };
  logEvent(db, 'accept-recommendations', { section: body.section ?? null, count: accepted.length, ids: accepted.map((a) => a.id) });
  await persist({ snapshot: true });
  return { accepted, skipped, matched, dryRun: false };
}

/** Retract a stale question. SOFT delete (defect D-A): the answer survives the withdrawal. */
export async function handleWithdraw(body) {
  const db = getDb();
  const question = mustFind(db, body.id);
  const now = new Date().toISOString();
  question.status = 'withdrawn';
  question.withdrawnAt = now;
  question.withdrawReason = body.reason ?? null;
  question.updatedAt = now;
  logEvent(db, 'withdraw', { id: question.id, reason: question.withdrawReason, hadAnswer: Boolean(question.answer) });
  await persist({ snapshot: true });
  return { withdrawn: question.id };
}
