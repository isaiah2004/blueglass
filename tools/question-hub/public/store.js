/**
 * Client state: the server's question set plus the staged-edit map.
 *
 * Staging is the only place an in-progress answer lives, so it is mirrored to
 * localStorage on every change (§5.6.1) — a backgrounded phone tab getting
 * evicted must never cost the human twenty answers.
 */
import { debounce } from './util.js';

const DRAFT_KEY = 'atlas-hub-drafts:' + location.origin;

export const state = {
  questions: [], stats: {}, statusBoard: null, seq: 0, serverVersion: null,
  /** id -> { detail, note, clear, base } — everything edited but not yet on disk. */
  pending: new Map(),
  /** id -> { theirs } — answered on another device while staged here (§5.6.4). */
  conflicts: new Map(),
  /** Swiped-left this session; sorted to the bottom, never written. */
  skipped: new Set(),
  restoredCount: 0,
};

export const emptyDetail = (kind, source = 'human') => ({ kind, selected: [], other: null, ranking: null, text: null, source });

/** Is there anything a reader would call an answer in here? */
export const detailHasAnswer = (detail) => Boolean(detail &&
  (detail.text || detail.other || (detail.ranking || detail.selected || []).length));

/** The frozen flat `answer` string, derived — never authored (§2.5). */
export function flatten(kind, detail) {
  if (!detail) return null;
  if (kind === 'text') return detail.text ?? '';
  if (kind === 'rank') {
    const ranked = (detail.ranking ?? []).join(' > ');
    return [ranked, detail.other ? 'Other: ' + detail.other : ''].filter(Boolean).join(' | ');
  }
  const parts = [...(detail.selected ?? [])];
  if (detail.other) parts.push('Other: ' + detail.other);
  return parts.join(' | ');
}

/**
 * Rebuild a detail from a flat answer string. Only used when the server has not
 * sent `answerDetail` — i.e. a pre-v3 server. The UI renders correctly on either.
 */
export function deriveDetail(question) {
  const detail = emptyDetail(question.kind, 'imported');
  const answer = question.answer;
  if (answer === null || answer === undefined || answer === '') return detail;
  if (question.kind === 'text') return { ...detail, text: String(answer) };
  const options = question.options ?? [];
  const parts = question.kind === 'choice' ? [String(answer)] : String(answer).split(' | ');
  const bucket = question.kind === 'rank' ? 'ranking' : 'selected';
  detail[bucket] = [];
  for (const part of parts) {
    if (part.startsWith('Other: ')) detail.other = part.slice(7);
    else if (options.includes(part)) detail[bucket].push(part);
    else if (question.kind === 'scale') detail.selected.push(part);
    else detail.other = detail.other ? detail.other + ' | ' + part : part;
  }
  return detail;
}

/** The detail the UI should render: staged first, then the server's, then derived. */
export function detailOf(question) {
  const staged = state.pending.get(question.id);
  if (staged) return staged.clear ? emptyDetail(question.kind) : staged.detail;
  if (question.answerDetail) return { ...emptyDetail(question.kind), ...question.answerDetail };
  return deriveDetail(question);
}

export const noteOf = (question) => {
  const staged = state.pending.get(question.id);
  return staged && staged.note !== undefined ? staged.note : question.note;
};
export const isStaged = (id) => state.pending.has(id);
export const hasPending = () => state.pending.size > 0;

/** Merge a patch into the staged entry for `id`, creating it from the server value. */
export function stage(id, patch) {
  const question = state.questions.find((q) => q.id === id);
  if (!question) return null;
  const current = state.pending.get(id) ?? {
    detail: detailOf(question),
    note: undefined,
    clear: false,
    base: { answer: question.answer ?? null, answeredAt: question.answeredAt ?? null },
  };
  const next = { ...current, ...patch, detail: { ...current.detail, ...(patch.detail ?? {}) } };
  state.pending.set(id, next);
  saveDrafts();
  return next;
}

/** Remove exactly these ids from staging — the scoped undo of §5.2. */
export function unstage(ids) {
  for (const id of ids) state.pending.delete(id);
  saveDrafts();
}
export const saveDrafts = debounce(() => {
  try {
    const rows = [...state.pending.entries()];
    if (rows.length === 0) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
  } catch (err) { console.warn('[hub] could not persist drafts', err); }
}, 300);

export function restoreDrafts() {
  try {
    for (const [id, e] of JSON.parse(localStorage.getItem(DRAFT_KEY) || '[]')) state.pending.set(id, e);
    state.restoredCount = state.pending.size;
  } catch (err) { console.warn('[hub] could not restore drafts', err); }
  return state.restoredCount;
}

/**
 * Adopt a server payload. Pending always wins (§5.6.3); a question answered
 * elsewhere while staged raises a conflict rather than overwriting either side.
 */
export function mergeServer(data) {
  state.questions = data.questions ?? [];
  state.stats = data.stats ?? {};
  state.statusBoard = data.status ?? null;
  for (const [id, staged] of state.pending) {
    const question = state.questions.find((q) => q.id === id);
    if (!question) continue;
    const movedElsewhere = (question.answeredAt ?? null) !== (staged.base?.answeredAt ?? null);
    const differs = (question.answer ?? null) !== flatten(question.kind, staged.detail);
    if (movedElsewhere && differs) state.conflicts.set(id, { theirs: question.answer });
    else state.conflicts.delete(id);
  }
}

/** Batch entries for POST /api/answer-batch, plus the ids we deliberately hold back. */
export function pendingPayload() {
  const answers = [];
  const held = [];
  for (const [id, staged] of state.pending) {
    const question = state.questions.find((q) => q.id === id);
    if (!question) continue;
    if (staged.clear) { answers.push({ id, clear: true, note: staged.note }); continue; }
    // `source` rides at the top level as well as inside the detail: that is where
    // the server reads provenance from, and it is what tells the fleet later that
    // a bulk endorsement was not a deliberated decision.
    const flat = flatten(question.kind, staged.detail);
    const source = staged.detail.source;
    // `scale` carries synthetic 1-5 labels absent from `options`, which the server
    // rejects inside answerDetail. Send the flat answer and let it derive.
    if (detailHasAnswer(staged.detail)) {
      answers.push(question.kind === 'scale'
        ? { id, answer: flat, note: staged.note, source }
        : { id, answerDetail: staged.detail, answer: flat, note: staged.note, source });
    } else if (question.status === 'answered' && staged.note !== undefined) {
      answers.push({ id, answer: question.answer, answerDetail: question.answerDetail, note: staged.note });
    } else {
      held.push(id);
    }
  }
  return { answers, held };
}
