/**
 * The answer <-> answerDetail bridge and the two-pass option matcher (spec §2.5, §4.2).
 *
 * The flat `answer` string is frozen for every existing reader; `answerDetail` is the new
 * authoritative shape. This module is the only place that converts between them, so
 * "picked an option" and "wrote free text" can never become ambiguous.
 *
 * The disambiguation rule it enforces: a string may appear in `selected`/`ranking` ONLY if
 * it is `===` an entry in the question's `options`. Free text appears only in `other`.
 *
 * Pure: imports nothing, touches no clock except via the caller, performs no I/O.
 */

export const ANSWER_SOURCES = Object.freeze(['human', 'accepted-recommendation', 'imported']);
export const OTHER_PREFIX = 'Other: ';
export const MULTI_SEP = ' | ';
export const RANK_SEP = ' > ';

const CURLY_SINGLE = /[\u2018\u2019\u201A\u201B\u2032]/g;
const CURLY_DOUBLE = /[\u201C\u201D\u201E\u201F\u2033]/g;
const DASHES = /[\u2013\u2014]/g;

/**
 * Fold the cosmetic differences that a re-typed question introduces: NFC, curly quotes to
 * ASCII, en/em dash to hyphen, collapsed whitespace, casefolded. Used only for matching —
 * the ORIGINAL option string is always what gets stored.
 */
export function normaliseForMatch(value) {
  return String(value)
    .normalize('NFC')
    .replace(CURLY_SINGLE, "'")
    .replace(CURLY_DOUBLE, '"')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Match one answer fragment against the options. Pass 1 is exact; pass 2 is normalised and
 * only accepts an UNAMBIGUOUS single hit. Returns the original option string, or null.
 */
export function matchOne(options, part) {
  const exact = options.indexOf(part);
  if (exact >= 0) return { value: options[exact], match: 'exact' };
  const target = normaliseForMatch(part);
  const hits = options.filter((option) => normaliseForMatch(option) === target);
  return hits.length === 1 ? { value: hits[0], match: 'normalised' } : null;
}

/** A blank detail record of the right shape for `kind`. */
export function emptyDetail(kind, source = 'human') {
  return { kind, selected: [], other: null, ranking: kind === 'rank' ? [] : null, text: null, source, match: 'exact', needsReview: false };
}

/**
 * Derive `answerDetail` from a flat `answer` string using the two-pass matcher.
 * Returns null for an unanswered question. Never mutates the question.
 */
export function deriveAnswerDetail(question, source = 'imported') {
  const { kind = 'text', options = [], answer } = question;
  if (answer === null || answer === undefined || answer === '') return null;
  const detail = emptyDetail(kind, source);
  if (kind === 'text') {
    detail.text = String(answer);
    return detail;
  }
  if (kind === 'scale') {
    detail.selected = [String(answer)];
    return detail;
  }
  const flat = String(answer);
  const sep = kind === 'rank' ? RANK_SEP : MULTI_SEP;
  // An option label may itself contain the separator, so try the whole string first.
  const parts = kind === 'choice' || options.includes(flat) ? [flat] : flat.split(sep);
  const others = [];
  for (const part of parts) {
    if (part.startsWith(OTHER_PREFIX)) {
      others.push(part.slice(OTHER_PREFIX.length));
      continue;
    }
    const hit = matchOne(options, part);
    if (!hit) {
      others.push(part);
      detail.needsReview = true;
    } else {
      (kind === 'rank' ? detail.ranking : detail.selected).push(hit.value);
      if (hit.match === 'normalised') detail.match = 'normalised';
    }
  }
  detail.other = others.length > 0 ? others.join(sep) : null;
  return detail;
}

/** Regenerate the frozen flat `answer` string from a detail record. Never authored by hand. */
export function flatten(detail) {
  if (!detail) return null;
  if (detail.kind === 'text') return detail.text ?? '';
  if (detail.kind === 'scale') return String(detail.selected?.[0] ?? '');
  const sep = detail.kind === 'rank' ? RANK_SEP : MULTI_SEP;
  const parts = [...(detail.kind === 'rank' ? detail.ranking ?? [] : detail.selected ?? [])];
  if (detail.other) parts.push(OTHER_PREFIX + detail.other);
  return parts.join(sep);
}

/**
 * Validate and normalise a client-supplied `answerDetail` against its question.
 * Returns `{ detail }` or `{ error }` — a message the client can show verbatim.
 */
export function buildDetail(question, input, source) {
  const kind = question.kind ?? 'text';
  const options = question.options ?? [];
  const detail = emptyDetail(kind, source);
  const list = (value) => (Array.isArray(value) ? value : []);
  const picks = kind === 'rank' ? list(input.ranking) : list(input.selected);
  for (const pick of picks) {
    if (!options.includes(pick)) return { error: 'answerDetail contains "' + pick + '", which is not an option of ' + question.id + '. Free text belongs in "other".' };
  }
  if (new Set(picks).size !== picks.length) return { error: 'answerDetail lists the same option twice for ' + question.id + '.' };
  if (kind === 'choice' && picks.length > 1) return { error: 'kind=choice accepts one option; ' + picks.length + ' were sent for ' + question.id + '.' };
  if (input.other !== undefined && input.other !== null && typeof input.other !== 'string') return { error: 'answerDetail.other must be a string or null.' };
  if (kind === 'text' && input.text !== undefined && typeof input.text !== 'string') return { error: 'answerDetail.text must be a string.' };
  if (kind === 'rank') detail.ranking = picks;
  else detail.selected = picks;
  detail.other = input.other ? String(input.other) : null;
  detail.text = kind === 'text' ? String(input.text ?? '') : null;
  // "One answer means one answer": typing into Other on a choice clears the pick.
  if (kind === 'choice' && detail.other) detail.selected = [];
  detail.needsReview = Boolean(input.needsReview);
  return { detail };
}
