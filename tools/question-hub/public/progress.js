/**
 * Momentum, honestly measured: the header bar, a ring per section, sections
 * that collapse once finished, and the `↓ Next` jump (§5.3).
 *
 * No streaks and no confetti — the product being built already owns that
 * vocabulary. Here, momentum is "fewer things left, visibly".
 */
import { esc, byId, reducedMotion } from './util.js';
import { state } from './store.js';
import { sectionSlug } from './filters.js';

const CIRCUMFERENCE = 2 * Math.PI * 9;

/** Open questions in this section that carry a recommendation we could accept. */
export const acceptableIn = (questions) =>
  questions.filter((q) => q.status === 'open' && q.recommended && !state.pending.has(q.id));

function ring(done, total) {
  const fraction = total ? done / total : 0;
  return '<svg class="ring" viewBox="0 0 22 22" aria-hidden="true">' +
    '<circle cx="11" cy="11" r="9" class="ring-track" />' +
    '<circle cx="11" cy="11" r="9" class="ring-fill" stroke-dasharray="' +
    (fraction * CIRCUMFERENCE).toFixed(2) + ' ' + CIRCUMFERENCE.toFixed(2) + '" /></svg>';
}

/**
 * A section as a <details> block: finished ones render as a single green row so
 * the page gets visibly shorter as the work gets done.
 */
export function renderSection(name, questions, cardsHtml) {
  const inSection = state.questions.filter((q) => q.section === name && q.status !== 'withdrawn');
  const done = inSection.filter((q) => q.status === 'answered').length;
  const complete = inSection.length > 0 && done === inSection.length;
  const canAccept = acceptableIn(questions);
  const accept = canAccept.length
    ? '<button class="sec-accept" data-act="accept-section" data-section="' + esc(name) + '">Accept ' +
      canAccept.length + ' &rsaquo;</button>' : '';
  return '<details class="sec' + (complete ? ' is-complete' : '') + '" id="section-' +
    esc(sectionSlug(name)) + '"' + (complete ? '' : ' open') + '>' +
    '<summary class="sec-head">' + ring(done, inSection.length) +
      '<span class="sec-name">' + esc(name) + '</span>' +
      '<span class="sec-count">' + done + '/' + inSection.length + '</span>' +
      (complete ? '<span class="sec-done">all answered &check;</span>' : '') +
    '</summary>' + accept + '<div class="sec-body">' + cardsHtml + '</div></details>';
}

/** The header counter and gradient bar. */
export function renderHeaderProgress() {
  const stats = state.stats ?? {};
  const total = stats.total ?? 0;
  const answered = stats.answered ?? 0;
  byId('pAnswered').textContent = String(answered);
  byId('pTotal').textContent = String(total);
  byId('pBar').style.width = total ? ((answered / total) * 100).toFixed(1) + '%' : '0%';
  const blocking = byId('pBlocking');
  blocking.textContent = stats.blockingOpen ? stats.blockingOpen + ' blocking' : '';
  blocking.classList.toggle('is-blocking', Boolean(stats.blockingOpen));
}

/** The empty state names the shape of the remaining work rather than a zero. */
export function emptyState() {
  const open = state.questions.filter((q) => q.status === 'open');
  const withRec = open.filter((q) => q.recommended).length;
  if (open.length === 0) {
    return '<div class="empty"><p class="big">Nothing waiting on you.</p>' +
      '<p>The fleet is building. New questions appear here on their own.</p></div>';
  }
  return '<div class="empty"><p class="big">Nothing matches that filter.</p>' +
    '<p>' + open.length + ' open &middot; ' + withRec +
    ' have a recommendation waiting for you to confirm.</p></div>';
}

const nextCard = () => [...document.querySelectorAll('.card')]
  .find((card) => !card.classList.contains('is-answered') && !card.classList.contains('is-staged'));

/** Nobody should ever scroll hunting for what is left. */
export function focusNext() {
  const card = nextCard();
  if (!card) return false;
  const details = card.closest('details');
  if (details) details.open = true;
  card.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
  card.focus({ preventScroll: true });
  return true;
}

/**
 * The one animation that earns its place: the counter counts up on save.
 * Under reduced motion the number simply changes.
 */
export function celebrateSave(savedCount) {
  const remaining = (state.stats.total ?? 0) - (state.stats.answered ?? 0);
  const bar = byId('pBar');
  if (bar && !reducedMotion()) {
    bar.classList.add('pulse');
    setTimeout(() => bar.classList.remove('pulse'), 700);
  }
  return 'Saved ' + savedCount + ' · ' + remaining + ' to go';
}

/** Give the questions the screen back the moment you start scrolling. */
function initHeaderCondense() {
  const header = document.querySelector('header');
  if (!header) return;
  const update = () => header.classList.toggle('condensed', window.scrollY > 90);
  window.addEventListener('scroll', update, { passive: true });
  update();
}

export function initProgress(onNext) {
  byId('nextBtn')?.addEventListener('click', () => { if (!focusNext()) onNext(); });
  initHeaderCondense();
}
