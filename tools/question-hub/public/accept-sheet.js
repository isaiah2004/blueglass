/**
 * "Accept all recommendations" — the highest-value control in the hub, and the
 * easiest to regret. Every entry point opens the same review sheet (§5.2).
 *
 * Two rules make the speed safe: the full text of every recommendation is on
 * screen before you agree to it, and accepting only *stages*. Nothing reaches
 * disk until Save, so Undo costs nothing because nothing has happened yet.
 */
import { esc, byId } from './util.js';
import { state, unstage } from './store.js';
import { acceptOne } from './render-card.js';
import { acceptableIn } from './progress.js';

const UNDO_MS = 8000;
let scope = { label: '', questions: [] };
let notify = () => {};

const rowFor = (question) =>
  '<label class="sheet-row"><input type="checkbox" checked data-pick="' + esc(question.id) + '" />' +
  '<span class="sheet-body"><span class="sheet-meta">' + esc(question.id) +
    (question.assumedInUse ? ' <b class="chip-tag cyan">IN USE</b>' : '') + '</span>' +
  '<span class="sheet-q">' + esc(question.question) + '</span>' +
  '<span class="sheet-rec">' + esc(question.recommended) + '</span></span></label>';

/** In-use first: accepting those is confirming work already done. */
function sheetBody(questions, withoutRec) {
  const inUse = questions.filter((q) => q.assumedInUse);
  const rest = questions.filter((q) => !q.assumedInUse);
  const groups = [];
  if (inUse.length) {
    groups.push('<p class="sheet-note">' + inUse.length +
      ' of these are already built on. Accepting confirms work that exists.</p>' +
      inUse.map(rowFor).join(''));
  }
  groups.push(rest.map(rowFor).join(''));
  if (withoutRec > 0) {
    groups.push('<p class="sheet-foot">' + withoutRec +
      (withoutRec === 1 ? ' question here has' : ' questions here have') +
      ' no recommendation — left for you.</p>');
  }
  return groups.join('');
}

function refreshCount() {
  const checked = [...document.querySelectorAll('#acceptSheet [data-pick]')].filter((b) => b.checked);
  const button = byId('acceptConfirm');
  button.textContent = 'Accept ' + checked.length;
  button.disabled = checked.length === 0;
}

export function openSheet(label, questions, withoutRec) {
  const dialog = byId('acceptSheet');
  if (!dialog || questions.length === 0) return;
  scope = { label, questions };
  byId('acceptTitle').textContent = 'Accept ' + questions.length +
    (questions.length === 1 ? ' recommendation' : ' recommendations') + (label ? ' · ' + label : '');
  byId('acceptBody').innerHTML = sheetBody(questions, withoutRec);
  refreshCount();
  dialog.showModal();
}

/** Undo is scoped to exactly this batch, so it cannot eat edits made in between. */
function toast(ids) {
  const host = byId('toasts');
  if (!host) return;
  const node = document.createElement('div');
  node.className = 'toast';
  node.innerHTML = '<span>' + ids.length + ' accepted</span>' +
    '<button type="button" data-act="undo-accept">Undo</button>';
  node.querySelector('button').addEventListener('click', () => {
    unstage(ids);
    node.remove();
    notify();
  });
  host.append(node);
  setTimeout(() => node.remove(), UNDO_MS);
}

function confirmAccept() {
  const picked = [...document.querySelectorAll('#acceptSheet [data-pick]')]
    .filter((box) => box.checked)
    .map((box) => box.dataset.pick);
  for (const id of picked) {
    const question = state.questions.find((q) => q.id === id);
    if (question) acceptOne(question);
  }
  byId('acceptSheet').close();
  toast(picked);
  notify();
}

const sectionQuestions = (name) =>
  state.questions.filter((q) => q.section === name && q.status !== 'withdrawn');

function openForSection(name) {
  const inSection = sectionQuestions(name);
  const withoutRec = inSection.filter((q) => q.status === 'open' && !q.recommended).length;
  openSheet(name, acceptableIn(inSection), withoutRec);
}

/** Every remaining recommendation, from the bottom of the page — never the sticky bar. */
function openForAll() {
  const open = state.questions.filter((q) => q.status === 'open');
  const withoutRec = open.filter((q) => !q.recommended).length;
  openSheet('everything remaining', acceptableIn(state.questions), withoutRec);
}

export function initAcceptSheet(onChange) {
  notify = onChange;
  const dialog = byId('acceptSheet');
  if (!dialog) return;
  dialog.addEventListener('change', refreshCount);
  dialog.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-act="close-accept"]') || ev.target === dialog) dialog.close();
    if (ev.target.closest('#acceptConfirm')) confirmAccept();
  });
  document.addEventListener('click', (ev) => {
    const section = ev.target.closest('[data-act="accept-section"]');
    if (section) {
      ev.preventDefault();
      ev.stopPropagation();
      openForSection(section.dataset.section);
      return;
    }
    if (ev.target.closest('[data-act="accept-all"]')) openForAll();
  });
}

/** The thumb-reachable mirror in the sticky bar, tracking the section on screen. */
export function updateMirror() {
  const slot = byId('acceptMirror');
  if (!slot) return;
  const heads = [...document.querySelectorAll('details.sec')];
  const current = heads.find((node) => {
    const box = node.getBoundingClientRect();
    return box.top < 80 && box.bottom > 160;
  });
  const name = current ? current.querySelector('.sec-name').textContent : null;
  const count = name ? acceptableIn(sectionQuestions(name)).length : 0;
  slot.hidden = !name || count === 0;
  if (!slot.hidden) {
    slot.textContent = 'Accept ' + count + ' in ' + name;
    slot.dataset.section = name;
  }
}

export const sheetScope = () => scope;
