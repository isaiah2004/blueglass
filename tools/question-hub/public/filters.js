/**
 * Finding the right question among eighty-five: filter chips, plain-substring
 * search, the leverage sort, the section index and hash deep links (§5.7).
 *
 * The default sort is deliberately not insertion order — it is "your answer
 * changes the most work, first".
 */
import { esc, byId } from './util.js';
import { state } from './store.js';

export const filterState = { filter: 'open', search: '' };

/** `9 · Maps, 3D & Visualisation` -> `9`, so an agent can link `#section-9`. */
export function sectionSlug(section) {
  const lead = String(section ?? '').match(/^\s*(\d+)/);
  return lead ? lead[1] : String(section ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

const hasImages = (q) => (q.attachments ?? []).some((a) => a && (a.type === 'image' || a.type === 'compare'))
  || Object.values(q.optionMeta ?? {}).some((m) => m && m.attachment);

const PREDICATES = {
  open: (q) => q.status === 'open' || state.pending.has(q.id),
  blocking: (q) => q.blocking && q.status === 'open',
  inuse: (q) => Boolean(q.assumedInUse) && q.status === 'open',
  norec: (q) => !q.recommended && q.status === 'open',
  images: hasImages,
  recheck: (q) => Boolean(q.answerDetail && q.answerDetail.needsReview),
  all: () => true,
};

function matchesSearch(question, needle) {
  if (!needle) return true;
  const hay = [question.id, question.question, question.why, question.section].join(' ').toLowerCase();
  return hay.includes(needle);
}

/** blocking -> in use -> no recommendation -> oldest. Skipped cards sink. */
function leverage(question) {
  return [
    state.skipped.has(question.id) ? 1 : 0,
    question.blocking && question.status === 'open' ? 0 : 1,
    question.assumedInUse && question.status === 'open' ? 0 : 1,
    !question.recommended && question.status === 'open' ? 0 : 1,
    question.askedAt ?? '',
  ];
}

export function applyFilters(questions) {
  const predicate = PREDICATES[filterState.filter] ?? PREDICATES.all;
  const needle = filterState.search.trim().toLowerCase();
  const rows = questions.filter((q) => q.status !== 'withdrawn' && predicate(q) && matchesSearch(q, needle));
  return rows.sort((a, b) => {
    const [ka, kb] = [leverage(a), leverage(b)];
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] < kb[i]) return -1;
      if (ka[i] > kb[i]) return 1;
    }
    return 0;
  });
}

/** Group into the order the sort produced, so section order tracks leverage too. */
export function groupBySection(questions) {
  const groups = new Map();
  for (const question of questions) {
    if (!groups.has(question.section)) groups.set(question.section, []);
    groups.get(question.section).push(question);
  }
  return groups;
}

function renderSectionIndex() {
  const sections = new Map();
  for (const q of state.questions) {
    if (q.status === 'withdrawn') continue;
    const row = sections.get(q.section) ?? { total: 0, done: 0 };
    row.total += 1;
    if (q.status === 'answered') row.done += 1;
    sections.set(q.section, row);
  }
  return [...sections.entries()].map(([name, row]) =>
    '<button class="idx-row" data-goto="' + esc(sectionSlug(name)) + '">' +
    '<span>' + esc(name) + '</span><b>' + row.done + '/' + row.total + '</b></button>').join('');
}

/** Flash the card an agent linked to, so the human sees where they landed. */
export function applyDeepLink() {
  const hash = decodeURIComponent(location.hash.replace('#', ''));
  if (!hash) return;
  const target = document.getElementById(hash.startsWith('section-') ? hash : hash);
  if (!target) return;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  target.classList.add('flash');
  setTimeout(() => target.classList.remove('flash'), 1600);
  if (target.classList.contains('card')) target.focus({ preventScroll: true });
}

function scrollToSection(slug) {
  const node = document.getElementById('section-' + slug);
  if (!node) return;
  node.open = true;
  node.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

export function initFilters(onChange) {
  const chips = [...document.querySelectorAll('.chip[data-filter]')];
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      filterState.filter = chip.dataset.filter;
      for (const other of chips) other.setAttribute('aria-pressed', String(other === chip));
      onChange();
    });
  }

  const search = byId('search');
  if (search) {
    search.addEventListener('input', () => { filterState.search = search.value; onChange(); });
    search.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { search.value = ''; filterState.search = ''; onChange(); search.blur(); } });
  }

  const dialog = byId('sectionIndex');
  const open = byId('sectionIndexBtn');
  if (dialog && open) {
    open.addEventListener('click', () => {
      byId('sectionIndexBody').innerHTML = renderSectionIndex();
      dialog.showModal();
    });
    dialog.addEventListener('click', (ev) => {
      const row = ev.target.closest('[data-goto]');
      if (row) { dialog.close(); scrollToSection(row.dataset.goto); }
      else if (ev.target === dialog || ev.target.closest('[data-act="close-index"]')) dialog.close();
    });
  }

  window.addEventListener('hashchange', applyDeepLink);
}

/** Move a card to the bottom for this session only — nothing is written. */
export const skipQuestion = (id) => state.skipped.add(id);
