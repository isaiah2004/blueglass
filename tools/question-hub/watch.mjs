/**
 * The listener CLI: long-polls the hub and prints one line per newly answered question.
 *
 * The orchestrator runs this detached and reads its output, which is what turns the hub from
 * a page someone has to remember to check into a channel that pushes decisions back to the
 * fleet. It reconnects with backoff and never crashes the caller when the hub restarts —
 * a listener dying on a restart would silently stop the whole feedback loop.
 *
 * Usage:
 *   node tools/question-hub/watch.mjs                 # follow forever
 *   node tools/question-hub/watch.mjs --once          # exit 0 after the first batch
 *   node tools/question-hub/watch.mjs --since 117     # replay from a known seq
 *   node tools/question-hub/watch.mjs --json          # one JSON object per line
 */
const HUB = process.env.HUB_URL ?? 'http://localhost:7777';
const argv = process.argv.slice(2);
const flags = new Set(argv);
const ANSWER_EVENTS = new Set(['answer', 'answer-batch', 'answer-orphaned', 'accept-recommendations']);

let since = Number(argv[argv.indexOf('--since') + 1]);
let backoffMs = 1000;

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** Fetch the answers behind an event so the orchestrator gets the decision, not just a ping. */
async function describe(ids) {
  const res = await fetch(HUB + '/api/questions', { cache: 'no-store' });
  if (!res.ok) return [];
  const { questions } = await res.json();
  return questions.filter((q) => ids.has(q.id));
}

/** Every question id an answering event touched. Batch events carry their own id list. */
function idsIn(events) {
  const ids = new Set();
  for (const event of events) {
    if (!ANSWER_EVENTS.has(event.kind)) continue;
    if (event.detail?.id) ids.add(event.detail.id);
    for (const id of event.detail?.ids ?? []) ids.add(id);
  }
  return ids;
}

async function report(events) {
  const ids = idsIn(events);
  if (ids.size === 0) return 0;
  const questions = await describe(ids);
  for (const q of questions) {
    if (flags.has('--json')) console.log(JSON.stringify({ id: q.id, section: q.section, answer: q.answer, answerDetail: q.answerDetail ?? null }));
    else console.log('[watch] ' + q.id + ' answered — ' + q.answer + (q.answerDetail?.needsReview ? '  (RE-CHECK: reworded after answering)' : ''));
  }
  return questions.length;
}

if (!Number.isFinite(since)) {
  try {
    const res = await fetch(HUB + '/api/health');
    since = res.ok ? (await res.json()).seq ?? 0 : 0;
  } catch {
    since = 0;
  }
}
console.error('[watch] following ' + HUB + ' from seq ' + since);

for (;;) {
  try {
    const res = await fetch(HUB + '/api/events?since=' + since + '&timeout=30', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const payload = await res.json();
    since = payload.seq ?? since;
    backoffMs = 1000;
    const printed = await report(payload.events ?? []);
    if (payload.retryAfterMs) await sleep(payload.retryAfterMs);
    if (flags.has('--once') && printed > 0) process.exit(0);
  } catch (err) {
    console.error('[watch] hub unreachable (' + err.message + '), retrying in ' + backoffMs / 1000 + 's');
    await sleep(backoffMs);
    backoffMs = Math.min(backoffMs * 3, 30000);
  }
}
