/**
 * Bootstrap and the load/save loop.
 *
 * Everything the human needs in order to answer — render, stage, save — lives
 * in this module and the three it imports statically. Attachments, the lightbox,
 * the accept sheet and gestures are loaded dynamically inside try/catch, so a
 * bug in any of them costs that feature and never the ability to answer (§8.2).
 */
import { byId } from './util.js';
import { state, restoreDrafts, hasPending, mergeServer, pendingPayload, unstage } from './store.js';
import { renderCard, onCardAction, onCardInput, setAttachmentRenderers } from './render-card.js';
import { applyFilters, groupBySection, initFilters, filterState, applyDeepLink } from './filters.js';
import { renderSection, renderHeaderProgress, emptyState, initProgress, celebrateSave, acceptableIn } from './progress.js';
import { renderStatusBoard } from './status-board.js';

const RETRY_MS = [1000, 3000, 9000];
const SAVE_MESSAGE_MS = 4000;
const list = byId('list');
let savedUntil = 0;
let updateMirror = () => {};
let renderQueued = false;
let saving = false;
let offlineNote = '';
let loadRetry = 0;
let loadTimer = null;

const warnCounts = new Map();

/**
 * Report a non-fatal failure without turning the console into noise (rule 6.1.1 — no catch
 * swallows silently). The optional features below must never block answering, so their errors
 * are logged rather than thrown; but the scroll-driven ones can fail many times a second, and a
 * console that scrolls its own first message out of view informs nobody. So the first failure
 * from each source is printed in full and the rest are tallied. The running counts stay on
 * `window.hubWarnings`, which is reachable from a phone's remote inspector.
 */
function warnOnce(source, err) {
  const count = (warnCounts.get(source) ?? 0) + 1;
  warnCounts.set(source, count);
  if (count === 1) console.warn('[hub] ' + source + ' failed; the hub continues without it.', err);
}
window.hubWarnings = warnCounts;

const setStatus = (text, kind = '') => {
  Object.assign(byId('status'), { textContent: text, className: 'status ' + kind });
};

/**
 * The save bar is ONE indicator with two faces: whether Save is enabled, and what the status
 * text says. They were being written in separate places, so the accept sheet could stage four
 * answers, enable Save, and leave the text reading "Up to date" — a lie that costs real work
 * the moment somebody believes it and closes the tab. Writing both here, together, is what
 * makes that unrepresentable: there is no path that can update one without the other.
 *
 * A transient message (saving, a failure, the post-save celebration) owns the bar while it is
 * true — but only while nothing is staged. The instant an edit is pending the bar goes back to
 * counting it, because "3 saved" stops being the whole truth as soon as a fourth is waiting.
 */
function syncSaveBar() {
  const pending = hasPending();
  byId('saveBtn').disabled = !pending;
  if (saving) return;                              // the in-flight save owns the bar until it resolves
  if (!pending && Date.now() < savedUntil) return; // let the save message finish being true
  // Being cut off outranks both counts: "Up to date" is false when we cannot reach the server
  // to know, and that is the same lie in a different coat.
  if (offlineNote) return setStatus((pending ? state.pending.size + ' unsaved · ' : '') + offlineNote, 'err');
  setStatus(pending ? state.pending.size + ' unsaved' : 'Up to date', pending ? '' : 'ok');
}

const questionById = (id) => state.questions.find((q) => q.id === id);
const serverMessage = async (res) => {
  try { return (await res.json()).error ?? 'HTTP ' + res.status; } catch { return 'HTTP ' + res.status; }
};
const editingText = () => Boolean(document.activeElement &&
  document.activeElement.matches('#list input, #list textarea'));

/** Deliberately a scroll away from Save, so it can never be the button you meant. */
function renderGlobalAccept() {
  const foot = byId('globalAccept');
  const count = acceptableIn(state.questions).length;
  foot.hidden = count === 0 || filterState.filter === 'status';
  if (!foot.hidden) foot.innerHTML = '<button class="accept-all" data-act="accept-all">Accept all ' +
    count + ' remaining</button><p>Every one is shown for review first.</p>';
}

export function render() {
  renderHeaderProgress();
  syncSaveBar();
  if (filterState.filter === 'status') { list.innerHTML = renderStatusBoard(); return renderGlobalAccept(); }
  const rows = applyFilters(state.questions);
  let html = '';
  for (const [name, questions] of groupBySection(rows)) {
    html += renderSection(name, questions, questions.map(renderCard).join(''));
  }
  list.innerHTML = rows.length === 0 ? emptyState() : html;
  renderGlobalAccept();
  // The mirror is a convenience, never a blocker: losing it costs a shortcut, not an answer.
  try { updateMirror(); } catch (err) { warnOnce('accept mirror (on render)', err); }
}

/** Deferred so a poll can never yank the keyboard out from under a half-typed answer. */
function scheduleRender() {
  if (!editingText()) return render();
  if (renderQueued) return;
  renderQueued = true;
  document.activeElement.addEventListener('blur', () => { renderQueued = false; render(); }, { once: true });
}

function repaintCard(id) {
  const question = questionById(id);
  const node = list.querySelector('[data-card-id="' + CSS.escape(id) + '"]');
  if (!question || !node) return render();
  node.outerHTML = renderCard(question);
  list.querySelector('[data-card-id="' + CSS.escape(id) + '"]')?.focus({ preventScroll: true });
  syncSaveBar();
}

/**
 * Fetch the questions and repaint. Retries with backoff, forever, and never gives up.
 *
 * The first load used to fail silently-for-good: one transient fetch error left the page on an
 * empty list with nothing scheduled to try again, because the event subscription only reloads
 * when an event *arrives* and a quiet hub sends none. On a phone that is indistinguishable from
 * "the fleet has asked me nothing", which is the one thing the hub must never be able to imply.
 * Retrying costs nothing — the request is a read, and staged answers are untouched either way.
 */
async function load() {
  clearTimeout(loadTimer);
  try {
    const res = await fetch('/api/questions', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    mergeServer(await res.json());
    loadRetry = 0;
    offlineNote = '';
    scheduleRender();
    syncSaveBar();
  } catch (err) {
    offlineNote = 'offline (' + err.message + '), retrying';
    syncSaveBar();
    loadTimer = setTimeout(load, RETRY_MS[Math.min(loadRetry++, RETRY_MS.length - 1)]);
  }
}

async function save(attempt = 1) {
  const { answers, held } = pendingPayload();
  if (answers.length === 0) {
    return setStatus(held.length ? held.length + ' notes need an answer before they save' : 'Nothing to save');
  }
  saving = true;
  byId('saveBtn').disabled = true;
  setStatus('Saving ' + answers.length + '…');
  try {
    const res = await fetch('/api/answer-batch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    });
    if (!res.ok) throw Object.assign(new Error(await serverMessage(res)), { status: res.status });
    const out = await res.json();
    // Clear only what the server confirmed. Anything it skipped stays staged.
    unstage(out.saved ?? answers.map((a) => a.id));
    await load();
    saving = false;
    savedUntil = Date.now() + SAVE_MESSAGE_MS;
    byId('saveBtn').disabled = !hasPending();
    setStatus(celebrateSave((out.saved ?? []).length), 'ok');
  } catch (err) {
    saving = false;
    byId('saveBtn').disabled = false;
    // A 4xx will never succeed on a retry, so say what is wrong instead of looping.
    const permanent = err.status >= 400 && err.status < 500;
    if (permanent) await load();
    if (permanent || attempt > RETRY_MS.length) {
      setStatus('Not saved — ' + err.message + ' Your answers are still here.', 'err');
      return;
    }
    setStatus('Save failed — retrying (' + attempt + ' of ' + RETRY_MS.length + ')', 'err');
    setTimeout(() => save(attempt + 1), RETRY_MS[attempt - 1]);
  }
}

/**
 * Long-poll for events so an agent's new question lands on the phone in about a
 * second. Falls back to a slow interval if the server predates /api/events.
 */
async function subscribe() {
  for (;;) {
    try {
      const res = await fetch('/api/events?since=' + state.seq + '&timeout=30', { cache: 'no-store' });
      if (res.status === 404) return void setInterval(load, 12000);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      state.seq = data.seq ?? state.seq;
      if ((data.events ?? []).length > 0) await load();
    } catch (err) {
      // Back off and keep trying — the poll must survive the server restarting under it. Said
      // once, because a hub that is genuinely down would otherwise loop here in total silence.
      warnOnce('event subscription', err);
      await new Promise((done) => setTimeout(done, 3000));
    }
  }
}

list.addEventListener('click', (ev) => {
  const target = ev.target.closest('[data-act]');
  if (!target || !target.dataset.id) return;
  const question = questionById(target.dataset.id);
  if (!question) return;
  const repaint = onCardAction(target.dataset.act, target, question);
  if (repaint) repaintCard(repaint);
});

list.addEventListener('input', ({ target }) => {
  const question = target.dataset && target.dataset.act ? questionById(target.dataset.id) : null;
  if (!question) return;
  onCardInput(target.dataset.act, target, question);
  syncSaveBar();
});

window.addEventListener('scroll', () => {
  try { updateMirror(); } catch (err) { warnOnce('accept mirror (on scroll)', err); }
}, { passive: true });
window.addEventListener('beforeunload', (ev) => {
  if (hasPending()) { ev.preventDefault(); ev.returnValue = ''; }
});

byId('saveBtn').addEventListener('click', () => save());
byId('restoreDismiss').addEventListener('click', () => { byId('restoreBanner').hidden = true; });

/** Optional modules. Each failure is logged and skipped; none is load-bearing. */
async function initOptional() {
  const safe = async (name, run) => {
    try { await run(); } catch (err) { console.error('[hub] ' + name + ' disabled', err); }
  };
  await safe('attachments', async () => {
    const module = await import('./render-attachments.js');
    setAttachmentRenderers(module);
    module.initAttachments();
  });
  await safe('lightbox', async () => (await import('./lightbox.js')).initLightbox());
  await safe('accept sheet', async () => {
    const sheet = await import('./accept-sheet.js');
    sheet.initAcceptSheet(render);
    updateMirror = sheet.updateMirror;
  });
  await safe('gestures', async () => (await import('./gestures.js')).initGestures(render));
}

async function boot() {
  const restored = restoreDrafts();
  byId('restoreCount').textContent = String(restored);
  byId('restoreBanner').hidden = restored === 0;
  initFilters(render);
  initProgress(() => setStatus('Nothing left to jump to', 'ok'));
  await initOptional();
  try {
    const health = await (await fetch('/api/health', { cache: 'no-store' })).json();
    state.seq = health.seq ?? 0;
    state.serverVersion = health.version ?? null;
  } catch (err) {
    // Health is informational; /api/questions is the real check and runs next regardless.
    // Worth saying out loud, though: without a seq the event subscription starts from 0 and
    // replays the whole log on first poll, which looks like a stuck UI if you do not know why.
    console.warn('[hub] /api/health did not answer; starting from seq 0 and continuing.', err);
  }
  await load();
  applyDeepLink();
  subscribe();
}

boot();
