/**
 * Touch and keyboard input (§5.4, §5.5).
 *
 * Restrained on purpose: one gesture that helps (swipe right = accept), one
 * that defers (swipe left = skip), and none that destroy. Both stage only.
 */
import { byId, reducedMotion } from './util.js';
import { state } from './store.js';
import { acceptOne } from './render-card.js';
import { skipQuestion } from './filters.js';
import { focusNext } from './progress.js';

const THRESHOLD = 0.33;
const GESTURE_KEY = 'atlas-hub-gestures';
let gesturesOn = localStorage.getItem(GESTURE_KEY) !== 'off';
let notify = () => {};
let drag = null;

const cards = () => [...document.querySelectorAll('.card')];
const activeCard = () => document.activeElement?.closest?.('.card') ?? null;
const focusedCard = () => activeCard() ?? cards()[0] ?? null;
const questionFor = (card) => state.questions.find((q) => q.id === card?.dataset.cardId);
const inField = (node) => Boolean(node && node.closest && node.closest('input, textarea, select'));

function moveFocus(step) {
  const list = cards();
  if (list.length === 0) return;
  // From a cold start `j` lands on the first card rather than skipping it.
  const at = list.indexOf(activeCard());
  const next = list[at < 0 ? 0 : Math.min(list.length - 1, Math.max(0, at + step))];
  next.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  next.focus({ preventScroll: true });
}

function pickNth(card, index) {
  const options = card.querySelectorAll('.opt');
  if (options[index]) options[index].click();
}

const KEYS = {
  j: () => moveFocus(1),
  k: () => moveFocus(-1),
  n: () => focusedCard()?.querySelector('.note-toggle')?.click(),
  o: () => {
    const card = focusedCard();
    if (!card) return;
    const id = card.dataset.cardId;
    const pill = card.querySelector('.other-pill');
    if (pill && pill.getAttribute('aria-expanded') === 'false') pill.click();
    // Expanding repaints the card, so re-find the input rather than holding a stale node.
    setTimeout(() => document.getElementById(id)?.querySelector('.other-box input')?.focus(), 40);
  },
  '/': () => byId('search')?.focus(),
  '?': () => byId('shortcuts')?.showModal(),
};

function onKey(ev) {
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    byId('saveBtn')?.click();
    return;
  }
  if (ev.key === 'Escape') {
    if (inField(ev.target)) ev.target.blur();
    return;
  }
  if (inField(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.key === 'A' && ev.shiftKey) {
    const card = focusedCard();
    const question = questionFor(card);
    if (question) document.querySelector('[data-act="accept-section"][data-section="' +
      CSS.escape(question.section) + '"]')?.click();
    return;
  }
  if (ev.key === 'a') {
    const question = questionFor(focusedCard());
    if (!question || !question.recommended) return;
    acceptOne(question);
    notify();
    // The re-render replaces the card node, so put the keyboard back where it was.
    document.getElementById(question.id)?.focus({ preventScroll: true });
    return;
  }
  if (/^[1-9]$/.test(ev.key)) {
    const card = focusedCard();
    if (card) { ev.preventDefault(); pickNth(card, Number(ev.key) - 1); }
    return;
  }
  const handler = KEYS[ev.key];
  if (handler) { ev.preventDefault(); handler(); }
}

function endDrag(card, dx, width) {
  const question = questionFor(card);
  card.style.removeProperty('--dx');
  card.style.removeProperty('--swipe-p');
  card.removeAttribute('data-swipe-label');
  if (!question || Math.abs(dx) < width * THRESHOLD) return;
  if (dx > 0 && question.recommended) { acceptOne(question); notify(); }
  if (dx < 0) { skipQuestion(question.id); notify(); }
}

function onTouchStart(ev) {
  if (!gesturesOn || ev.touches.length !== 1 || inField(ev.target)) return;
  const card = ev.target.closest('.card');
  if (!card) return;
  drag = { card, x: ev.touches[0].clientX, y: ev.touches[0].clientY, locked: null };
}

function onTouchMove(ev) {
  if (!drag) return;
  const dx = ev.touches[0].clientX - drag.x;
  const dy = ev.touches[0].clientY - drag.y;
  if (drag.locked === null) drag.locked = Math.abs(dx) > Math.abs(dy) + 6 ? 'x' : 'y';
  if (drag.locked !== 'x') return;
  ev.preventDefault();
  const question = questionFor(drag.card);
  if (dx > 0 && !(question && question.recommended)) return;
  // Rubber-band resistance, so a scroll can never turn into an accept by accident.
  const eased = Math.sign(dx) * Math.min(Math.abs(dx), 140) ** 0.92;
  drag.card.style.setProperty('--dx', eased.toFixed(1) + 'px');
  drag.card.style.setProperty('--swipe-p',
    Math.min(1, Math.abs(dx) / (drag.card.offsetWidth * THRESHOLD)).toFixed(2));
  drag.card.dataset.swipeLabel = dx > 0 ? 'ACCEPT' : 'SKIP';
  drag.dx = dx;
}

function onTouchEnd() {
  if (!drag) return;
  endDrag(drag.card, drag.dx ?? 0, drag.card.offsetWidth);
  drag = null;
}

export function initGestures(onChange) {
  notify = onChange;
  document.addEventListener('keydown', onKey);
  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd);
  document.addEventListener('touchcancel', onTouchEnd);

  const toggle = byId('gestureToggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(gesturesOn));
    toggle.addEventListener('click', () => {
      gesturesOn = !gesturesOn;
      localStorage.setItem(GESTURE_KEY, gesturesOn ? 'on' : 'off');
      toggle.setAttribute('aria-pressed', String(gesturesOn));
    });
  }

  const overlay = byId('shortcuts');
  byId('shortcutsBtn')?.addEventListener('click', () => overlay?.showModal());
  overlay?.addEventListener('click', (ev) => {
    if (ev.target === overlay || ev.target.closest('[data-act="close-shortcuts"]')) overlay.close();
  });
  byId('nextBtn')?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') focusNext(); });
}
