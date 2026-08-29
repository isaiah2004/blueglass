/**
 * What a question IS: validation on write, the stored record, and re-ask reconciliation.
 *
 * The handlers that record a decision live in lib/answering.mjs and are re-exported here,
 * so this module stays the single import point for the route table while neither file
 * carries two reasons to change.
 *
 * Defect D-B is fixed here and must stay fixed: re-asking no longer orphans an answer. After
 * the wording is replaced, the stored answer is re-matched against the NEW options. Still
 * matches, the decision is carried across and the flat answer regenerated; no longer matches,
 * the answer and answeredAt are left untouched, `needsReview` is set and an `answer-orphaned`
 * event is logged. Never silently discard, never silently retain — both are how answers rot.
 */
import { getDb, persist } from './db.mjs';
import { logEvent } from './events.mjs';
import { HttpError } from './http.mjs';
import { deriveAnswerDetail, flatten } from './answer-detail.mjs';
import { validateAttachments, validateOptionMeta } from './attachments.mjs';

export { applyAnswer, handleAnswer, handleAnswerBatch, handleAcceptRecommendations, handleWithdraw } from './answering.mjs';

/** `scale` is kept for backward compatibility but deprecated for new asks (§2.2). */
export const VALID_KINDS = Object.freeze(['choice', 'multi', 'text', 'scale', 'rank']);
export const VALID_LAYOUTS = Object.freeze(['list', 'compare', 'swatch']);
export const VALID_PRIORITIES = Object.freeze([null, 'now', 'soon', 'whenever']);
const OPTION_KINDS = ['choice', 'multi', 'rank'];

/** Injected by server.mjs from lib/media.mjs, so a broken media module cannot break asking. */
let checkSrc = () => false;
export function configureMediaCheck(fn) {
  checkSrc = fn;
}

/**
 * The next free id in a prefix's family.
 *
 * COUNTING IS NOT ALLOCATING. The previous version returned `prefix + (count + 1)`, which
 * is only free when the family is contiguous and zero-padded the same way — and it is
 * neither. `Q-01`, `Q-02`, `Q-03` and `Q-04` were seeded unpadded alongside `Q-005`+, so 23
 * `Q-` questions existed while the highest was already `Q-024`. Two agents in a row were
 * handed `Q-024`, and because `/api/ask` upserts by id, each silently overwrote a question
 * a human had already answered — the one failure `lib/db.mjs` is written to prevent, walked
 * in through the front door.
 *
 * So: take the highest number actually in use, add one, and step over anything still taken.
 * The final loop is belt and braces for a hand-written id like `Q-024b`.
 *
 * @param db The database.
 * @param prefix The id family, e.g. `Q`.
 * @returns An id no question currently holds.
 */
function nextId(db, prefix) {
  const taken = new Set(db.questions.map((q) => q.id));
  let highest = 0;
  for (const id of taken) {
    if (!id.startsWith(prefix + '-')) continue;
    const number = Number.parseInt(id.slice(prefix.length + 1), 10);
    if (Number.isFinite(number) && number > highest) highest = number;
  }
  let candidate = highest + 1;
  while (taken.has(prefix + '-' + String(candidate).padStart(3, '0'))) candidate += 1;
  return prefix + '-' + String(candidate).padStart(3, '0');
}

/** Validate a posted question. Throws HttpError(400) with one actionable sentence. */
function validateAsk(body, kind, options) {
  if (typeof body.question !== 'string' || body.question.trim() === '') throw new HttpError(400, 'A question needs a non-empty "question" string.');
  if (typeof body.section !== 'string' || body.section.trim() === '') throw new HttpError(400, 'A question needs a "section" — it is what groups questions in the UI.');
  if (!VALID_KINDS.includes(kind)) throw new HttpError(400, 'Unknown kind "' + kind + '" — expected one of ' + VALID_KINDS.join(', ') + '.');
  if (!Array.isArray(options) || options.some((o) => typeof o !== 'string')) throw new HttpError(400, 'options must be an array of strings.');
  if (OPTION_KINDS.includes(kind) && options.length === 0) throw new HttpError(400, 'kind=' + kind + ' needs a non-empty options array.');
  if (new Set(options).size !== options.length) throw new HttpError(400, 'options contains a duplicate label; optionMeta is keyed by label, so labels must be unique.');
  if (!VALID_PRIORITIES.includes(body.priority ?? null)) throw new HttpError(400, 'priority must be null, "now", "soon" or "whenever".');
  const attachmentError = validateAttachments(body.attachments, checkSrc) ?? validateOptionMeta(body.optionMeta, options, checkSrc);
  if (attachmentError) throw new HttpError(400, attachmentError);
}

/** Build the stored record for a validated ask. */
function buildQuestion(db, body) {
  const kind = body.kind ?? 'text';
  const options = body.options ?? [];
  validateAsk(body, kind, options);
  // A presentation hint may never break answering, so an unknown layout falls back to list.
  const layout = VALID_LAYOUTS.includes(body.layout) ? body.layout : 'list';
  if (body.layout && layout !== body.layout) console.warn('[hub] unknown layout "' + body.layout + '" on ' + (body.id ?? 'a new question') + ' — falling back to list');
  const now = new Date().toISOString();
  return {
    id: body.id ?? nextId(db, body.idPrefix ?? 'Q'),
    section: body.section,
    question: body.question,
    why: body.why ?? '',
    kind,
    options,
    recommended: body.recommended ?? null,
    defaultAnswer: body.defaultAnswer ?? null,
    blocking: Boolean(body.blocking),
    askedBy: body.askedBy ?? 'orchestrator',
    status: 'open',
    answer: null,
    note: null,
    askedAt: now,
    answeredAt: null,
    answerDetail: null,
    attachments: body.attachments ?? [],
    optionMeta: body.optionMeta ?? {},
    allowOther: body.allowOther === undefined ? OPTION_KINDS.includes(kind) : Boolean(body.allowOther),
    layout,
    assumedInUse: Boolean(body.assumedInUse),
    priority: body.priority ?? null,
    withdrawnAt: null,
    withdrawReason: null,
    updatedAt: now,
  };
}

/**
 * Carry an answer across a re-wording (defect D-B). Mutates `merged`; returns the detail for
 * an `answer-orphaned` event when the answer could no longer be matched, else null.
 */
function reconcileAnswer(merged, previous) {
  const source = previous.answerDetail?.source ?? 'imported';
  const rebuilt = deriveAnswerDetail({ ...merged, answer: previous.answer }, source);
  if (rebuilt && !rebuilt.needsReview) {
    merged.answerDetail = rebuilt;
    merged.answer = flatten(rebuilt);
    return null;
  }
  merged.answerDetail = { ...(rebuilt ?? previous.answerDetail ?? {}), needsReview: true };
  return { id: merged.id, answer: previous.answer, oldOptions: previous.options, newOptions: merged.options };
}

/** Merge a re-ask onto the record that already exists, preserving everything the human owns. */
function mergeReAsk(fresh, previous, body) {
  const merged = {
    ...fresh,
    askedAt: previous.askedAt,
    answer: previous.answer,
    note: previous.note,
    status: previous.status,
    answeredAt: previous.answeredAt,
    answerDetail: previous.answerDetail,
    assumedInUse: body.assumedInUse === undefined ? previous.assumedInUse : fresh.assumedInUse,
    withdrawnAt: previous.withdrawnAt ?? null,
    withdrawReason: previous.withdrawReason ?? null,
    updatedAt: new Date().toISOString(),
  };
  // A withdrawal is deliberate, so a repeated seed must not silently resurrect it.
  if (merged.status === 'withdrawn' && body.revive === true) {
    merged.status = merged.answer ? 'answered' : 'open';
    merged.withdrawnAt = null;
    merged.withdrawReason = null;
  }
  return merged;
}

/** Queue a question, or re-ask an existing id without losing the answer it already carries. */
export async function handleAsk(body) {
  const db = getDb();
  const fresh = buildQuestion(db, body);
  const index = db.questions.findIndex((x) => x.id === fresh.id);
  let orphaned = null;
  if (index >= 0) {
    const merged = mergeReAsk(fresh, db.questions[index], body);
    if (merged.status === 'answered') orphaned = reconcileAnswer(merged, db.questions[index]);
    db.questions[index] = merged;
  } else {
    db.questions.push(fresh);
  }
  const stored = index >= 0 ? db.questions[index] : db.questions[db.questions.length - 1];
  logEvent(db, 'ask', { id: stored.id, askedBy: stored.askedBy, blocking: stored.blocking });
  if (orphaned) logEvent(db, 'answer-orphaned', orphaned);
  await persist();
  return stored;
}

/** Stats over the visible questions. Withdrawn are excluded, exactly as they were before v3. */
export function buildStats(db) {
  const visible = db.questions.filter((q) => q.status !== 'withdrawn');
  return {
    total: visible.length,
    open: visible.filter((q) => q.status === 'open').length,
    answered: visible.filter((q) => q.status === 'answered').length,
    blockingOpen: visible.filter((q) => q.status === 'open' && q.blocking).length,
  };
}

/** The `GET /api/questions` projection. Withdrawn are excluded unless explicitly asked for. */
export function listQuestions(db, url) {
  const status = url.searchParams.get('status');
  const section = url.searchParams.get('section');
  let questions = status ? db.questions.filter((q) => q.status === status) : db.questions.filter((q) => q.status !== 'withdrawn');
  if (section) questions = questions.filter((q) => q.section === section);
  return { questions, stats: buildStats(db), status: db.status };
}
