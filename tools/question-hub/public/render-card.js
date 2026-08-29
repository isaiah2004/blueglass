/**
 * One question card: all five kinds, the Other escape, chips, note box,
 * per-option consequence, the conflict bar and the clear-confirm row.
 *
 * Attachment rendering is injected, not imported, so a failure in
 * render-attachments.js costs images and nothing else (§8.2 client hard rule).
 */
import { esc } from './util.js';
import { state, detailOf, noteOf, isStaged, stage, flatten, emptyDetail } from './store.js';
let renderAtts = () => '';
let renderOptionAtt = () => '';
/** Cards whose Other input is expanded, and cards awaiting a clear confirmation. */
const otherOpen = new Set();
const clearAsk = new Set();
export function setAttachmentRenderers({ renderAttachments, renderOptionAttachment }) {
  renderAtts = renderAttachments;
  renderOptionAtt = renderOptionAttachment;
}

const chip = (c, t) => '<span class="chip-tag ' + c + '">' + esc(t) + '</span>';
const bucketOf = (kind) => (kind === 'rank' ? 'ranking' : 'selected');
/** Everything the human is meant to notice about this card, before reading it. */
function chipsFor(question, detail, staged) {
  const open = question.status !== 'answered';
  const accepted = detail && detail.source === 'accepted-recommendation';
  return [
    question.blocking ? chip('cyan', 'BLOCKING') : '',
    question.assumedInUse && open ? chip('cyan', 'IN USE') : '',
    question.answerDetail && question.answerDetail.needsReview ? chip('cyan', 'RE-CHECK') : '',
    staged ? chip('gold', 'UNSAVED')
      : (open ? '' : chip(accepted ? 'gold' : 'green', accepted ? 'ACCEPTED' : 'ANSWERED')),
    question.askedBy && question.askedBy !== 'orchestrator' ? chip('faint', question.askedBy) : '',
  ].join('');
}

/**
 * The mark carries card state without colour: dashed ring for an unconfirmed
 * recommendation, solid tick for a real choice, a number for a rank position.
 */
function markFor(question, label, detail) {
  const bucket = bucketOf(question.kind);
  const picked = (detail[bucket] ?? []).indexOf(label);
  if (picked >= 0) {
    const glyph = question.kind === 'rank' ? String(picked + 1) : '&check;';
    return '<span class="mark is-on" aria-hidden="true">' + glyph + '</span>';
  }
  const isRec = question.recommended === label && question.status !== 'answered';
  const cls = isRec ? (question.assumedInUse ? 'mark is-inuse' : 'mark is-rec') : 'mark';
  return '<span class="' + cls + '" aria-hidden="true"></span>';
}

function optionRow(question, label) {
  const detail = detailOf(question);
  const meta = (question.optionMeta ?? {})[label] ?? {};
  const isRec = question.recommended === label;
  const on = (detail[bucketOf(question.kind)] ?? []).includes(label);
  const accept = isRec && question.status !== 'answered' ? '<button class="opt-accept" data-act="accept"' +
    ' data-id="' + esc(question.id) + '" aria-label="' +
    esc('Accept the recommendation for ' + question.id) + '">Accept</button>' : '';
  return '<div class="opt-wrap">' +
    (meta.attachment ? renderOptionAtt(meta.attachment) : '') +
    '<button class="opt" data-act="pick" data-id="' + esc(question.id) + '" data-val="' + esc(label) + '"' +
      ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
      markFor(question, label, detail) +
      '<span class="opt-body"><span class="opt-label">' + esc(label) +
        (isRec ? ' <span class="rec">RECOMMENDED</span>' : '') + '</span>' +
        (meta.hint ? '<span class="opt-hint">' + esc(meta.hint) + '</span>' : '') +
        (meta.consequence ? '<span class="opt-conseq">' + esc(meta.consequence) + '</span>' : '') +
      '</span></button>' + accept + '</div>';
}

/** A pill until wanted: it costs no vertical space and never grabs focus on load. */
function otherRow(question, detail) {
  if (question.allowOther === false) return '';
  const open = otherOpen.has(question.id) || (detail.other !== null && detail.other !== undefined);
  return '<div class="other-row">' +
    '<button class="other-pill" data-act="other-toggle" data-id="' + esc(question.id) + '"' +
      ' aria-expanded="' + (open ? 'true' : 'false') + '">' +
      (open ? '&minus; Other' : '+ Something else') + '</button>' +
    '<div class="other-box"' + (open ? '' : ' hidden') + '>' +
      '<input type="text" data-act="other" name="other-' + esc(question.id) + '" data-id="' + esc(question.id) + '"' +
      ' value="' + esc(detail.other ?? '') + '" placeholder="In your own words&hellip;"' +
      ' aria-label="Other answer" enterkeyhint="done" autocapitalize="sentences" autocorrect="on" />' +
    '</div></div>';
}

function bodyFor(question, detail) {
  if (question.kind === 'text') {
    return '<textarea data-act="text" name="answer-' + esc(question.id) + '" data-id="' + esc(question.id) + '" rows="3" aria-label="Your answer"' +
      ' enterkeyhint="done" autocapitalize="sentences" placeholder="' +
      esc(question.defaultAnswer ? 'Default: ' + question.defaultAnswer : 'Your answer…') +
      '">' + esc(detail.text ?? '') + '</textarea>';
  }
  const labels = question.kind === 'scale' && (question.options ?? []).length === 0
    ? ['1', '2', '3', '4', '5'] : (question.options ?? []);
  const layout = ['compare', 'swatch'].includes(question.layout) ? question.layout : 'list';
  const hint = question.kind === 'rank'
    ? '<p class="rank-hint">Tap in priority order. Tap again to remove and renumber.</p>' : '';
  return hint + '<div class="opts layout-' + layout + '">' +
    labels.map((label) => optionRow(question, label)).join('') + '</div>' +
    otherRow(question, detail);
}

/** Two devices, two answers — shown side by side rather than silently resolved. */
function conflictBar(question) {
  const clash = state.conflicts.get(question.id);
  if (!clash) return '';
  const id = esc(question.id);
  return '<div class="conflict"><p class="conflict-head">Answered on another device while you were editing.</p>' +
    '<p class="conflict-val"><b>Yours</b> ' + esc(flatten(question.kind, detailOf(question)) || '(empty)') + '</p>' +
    '<p class="conflict-val"><b>Theirs</b> ' + esc(clash.theirs || '(empty)') + '</p>' +
    '<div class="conflict-acts"><button data-act="keep-mine" data-id="' + id + '">Keep mine</button>' +
    '<button data-act="take-theirs" data-id="' + id + '">Take theirs</button></div></div>';
}

/** One card. Returns a string; the caller decides where it lands in the DOM. */
export function renderCard(question) {
  const detail = detailOf(question);
  const staged = isStaged(question.id);
  const note = noteOf(question);
  const classes = ['card',
    question.status === 'answered' && !staged ? 'is-answered' : '',
    staged ? 'is-staged' : '',
    question.assumedInUse && question.status !== 'answered' ? 'is-inuse' : '',
    question.blocking ? 'is-blocking' : ''].filter(Boolean);
  return '<article class="' + classes.join(' ') + '" data-card-id="' + esc(question.id) +
    '" id="' + esc(question.id) + '" tabindex="-1">' +
    '<div class="qid"><span class="qid-num">' + esc(question.id) + '</span>' +
      chipsFor(question, detail, staged) + '</div>' +
    '<p class="qtext">' + esc(question.question) + '</p>' +
    (question.why ? '<p class="qwhy">' + esc(question.why) + '</p>' : '') +
    renderAtts(question.attachments) +
    bodyFor(question, detail) +
    (clearAsk.has(question.id)
      ? '<div class="clear-row"><span>Clear this saved answer?</span>' +
        '<button data-act="clear-yes" data-id="' + esc(question.id) + '">Clear</button>' +
        '<button data-act="clear-no" data-id="' + esc(question.id) + '">Keep it</button></div>' : '') +
    conflictBar(question) +
    '<button class="note-toggle" data-act="note-toggle" data-id="' + esc(question.id) + '"' +
      ' aria-expanded="' + (note ? 'true' : 'false') + '">' +
      (note ? '&minus; note' : '+ add a note') + '</button>' +
    '<div class="note-box"' + (note ? '' : ' hidden') + '>' +
      '<textarea data-act="note" name="note-' + esc(question.id) + '" data-id="' + esc(question.id) + '" rows="2" aria-label="Note"' +
      ' placeholder="Extra context, caveats, links…">' + esc(note ?? '') + '</textarea></div>' +
    '</article>';
}

/** Stage the fleet's recommendation, recording that it was endorsed, not deliberated. */
export function acceptOne(question) {
  const base = emptyDetail(question.kind, 'accepted-recommendation');
  stage(question.id, { clear: false, detail: question.kind === 'text'
    ? { ...base, text: question.recommended } : { ...base, [bucketOf(question.kind)]: [question.recommended] } });
}

/** Tap-to-rank: assign the next number, or clear and renumber the rest. */
function togglePick(question, label) {
  const detail = { ...detailOf(question) };
  const bucket = bucketOf(question.kind);
  const list = [...(detail[bucket] ?? [])];
  const at = list.indexOf(label);
  if (question.kind === 'choice') {
    detail.selected = at >= 0 ? [] : [label];
    if (at < 0) detail.other = null;
  } else {
    if (at >= 0) list.splice(at, 1); else list.push(label);
    detail[bucket] = list;
  }
  detail.source = 'human';
  return detail;
}

/**
 * Handle one click inside a card. Returns the id to repaint, or null.
 * Clearing an answer that is already on disk needs an explicit confirmation.
 */
export function onCardAction(act, target, question) {
  const id = question.id;
  if (act === 'pick') {
    const label = target.dataset.val;
    const wasOn = (detailOf(question)[bucketOf(question.kind)] ?? []).includes(label);
    if (wasOn && question.status === 'answered' && question.kind === 'choice') clearAsk.add(id);
    else stage(id, { detail: togglePick(question, label), clear: false });
    return id;
  }
  if (act === 'accept') { acceptOne(question); return id; }
  if (act === 'other-toggle') { otherOpen.has(id) ? otherOpen.delete(id) : otherOpen.add(id); return id; }
  if (act === 'clear-yes') { clearAsk.delete(id); stage(id, { clear: true }); return id; }
  if (act === 'clear-no') { clearAsk.delete(id); return id; }
  if (act === 'keep-mine') { state.conflicts.delete(id); return id; }
  if (act === 'take-theirs') { state.conflicts.delete(id); state.pending.delete(id); return id; }
  if (act !== 'note-toggle') return null;
  const box = target.parentElement.querySelector('.note-box');
  if (!box) return null;
  box.hidden = !box.hidden;
  target.innerHTML = box.hidden ? '+ add a note' : '&minus; note';
  target.setAttribute('aria-expanded', String(!box.hidden));
  if (!box.hidden) box.querySelector('textarea').focus();
  return null;
}

/** Text input handling — never repaints, so the caret and keyboard stay put. */
export function onCardInput(act, target, question) {
  const detail = { ...detailOf(question), source: 'human' };
  if (act === 'text') stage(question.id, { detail: { ...detail, text: target.value }, clear: false });
  if (act === 'note') stage(question.id, { note: target.value });
  if (act !== 'other') return;
  const value = target.value === '' ? null : target.value;
  const next = { ...detail, other: value };
  // One answer means one answer: writing your own deselects the picked option.
  if (question.kind === 'choice' && value) next.selected = [];
  stage(question.id, { detail: next, clear: false });
  if (question.kind !== 'choice' || !value) return;
  const card = target.closest('.card');
  if (!card) return;
  for (const btn of card.querySelectorAll('.opt[aria-pressed="true"]')) {
    btn.setAttribute('aria-pressed', 'false');
    const mark = btn.querySelector('.mark');
    if (mark) { mark.className = 'mark'; mark.innerHTML = ''; }
  }
}
