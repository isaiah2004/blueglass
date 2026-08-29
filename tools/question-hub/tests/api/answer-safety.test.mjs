/**
 * The three ways the live hub was found to destroy an answer (hub-platform.md §1.1),
 * tested at the HTTP surface where an agent or the phone actually hits them.
 *
 * Every test here boots its own hub against its own temp directory. Nothing shares state
 * and nothing reads `data/questions.json`.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, portAllocator } from '../helpers/hub-server.mjs';

const nextPort = portAllocator(7800);

/**
 * Boot a hub scoped to one test, torn down even if the test throws.
 * Per-test rather than per-file: a shared instance would let an earlier test's writes
 * decide a later test's result, which is the bug this suite exists to catch elsewhere.
 */
async function hub(t, fixture = 'e2e-seed.json') {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());
  return instance;
}

const find = (list, id) => list.find((q) => q.id === id);

describe('D-C — an empty or absent answer must never un-answer a question', () => {
  test('a batch entry with no answer field is skipped, not treated as a clear', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });

    const res = await h.post('/api/answer-batch', { answers: [{ id: 'S-01' }, { id: 'S-02', answer: 'A clean rewrite' }] });
    const body = await res.json();

    assert.deepEqual(body.skipped, ['S-01'], 'an untouched question was not reported as skipped');
    assert.deepEqual(body.saved, ['S-02']);
    const db = await h.readDb();
    assert.equal(find(db.questions, 'S-01').answer, 'A demoable MVP of one journey', 'the answer was wiped');
    assert.equal(find(db.questions, 'S-01').status, 'answered');
  });

  test('an empty-string answer does not silently un-answer', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });

    await h.post('/api/answer-batch', { answers: [{ id: 'S-01', answer: '' }] });

    const q = find((await h.readDb()).questions, 'S-01');
    assert.equal(q.status, 'answered', 'a stray tap that cleared a text field destroyed a real answer');
    assert.ok(q.answeredAt, 'answeredAt was thrown away');
  });

  test('clearing is possible, but only when asked for explicitly', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });

    await h.post('/api/answer-batch', { answers: [{ id: 'S-01', clear: true }] });

    const q = find((await h.readDb()).questions, 'S-01');
    assert.equal(q.status, 'open', 'clear: true did not clear');
    assert.equal(q.answer, null);
  });
});

describe('D-A — withdraw is a soft delete', () => {
  test('a withdrawn question keeps its answer on disk', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-02', answer: 'A clean rewrite' });

    await h.post('/api/withdraw', { id: 'S-02', reason: 'answered by S-01' });

    const q = find((await h.readDb()).questions, 'S-02');
    assert.ok(q, 'the record was spliced out of the array and the answer is gone');
    assert.equal(q.status, 'withdrawn');
    assert.equal(q.answer, 'A clean rewrite', 'withdraw destroyed the human\'s answer');
    assert.ok(q.withdrawnAt, 'no withdrawnAt recorded, so the event is untraceable');
  });

  test('withdrawn questions vanish from the default list, exactly as they used to', async (t) => {
    const h = await hub(t);
    await h.post('/api/withdraw', { id: 'S-02', reason: 'stale' });

    const body = await (await h.get('/api/questions')).json();

    assert.equal(find(body.questions, 'S-02'), undefined, 'a withdrawn question is still in the default list');
  });

  test('but they can be asked for deliberately', async (t) => {
    const h = await hub(t);
    await h.post('/api/withdraw', { id: 'S-02', reason: 'stale' });

    const body = await (await h.get('/api/questions?status=withdrawn')).json();

    assert.ok(find(body.questions, 'S-02'), 'a withdrawn question is unrecoverable through the API');
  });
});

describe('D-B — re-asking a question must not orphan its answer', () => {
  const reAsk = (options) => ({
    id: 'S-02', section: '1 · Scope & truth', question: 'Is this a rewrite or an incremental port?',
    why: 'Re-asked with new wording.', kind: 'choice', options, recommended: options[0], askedBy: 'orchestrator',
  });

  test('a rewording that still matches keeps the decision and its timestamp', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-02', answer: 'A clean rewrite' });
    const before = find((await h.readDb()).questions, 'S-02').answeredAt;

    await h.post('/api/ask', reAsk(['A clean rewrite ', 'An incremental port']));

    const q = find((await h.readDb()).questions, 'S-02');
    assert.equal(q.status, 'answered', 'a rewording un-answered a settled question');
    assert.equal(q.answeredAt, before, 'answeredAt moved, so the decision looks newer than it is');
    assert.deepEqual(q.answerDetail.selected, ['A clean rewrite '], 'selected was not rewritten to the new option string');
  });

  test('a rewording that no longer matches keeps the answer and flags it, never discards it', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-02', answer: 'A clean rewrite' });
    const before = find((await h.readDb()).questions, 'S-02').answeredAt;

    await h.post('/api/ask', reAsk(['Start from scratch', 'Port module by module']));

    const q = find((await h.readDb()).questions, 'S-02');
    assert.equal(q.answer, 'A clean rewrite', 'the orphaned answer was silently discarded');
    assert.equal(q.answeredAt, before, 'answeredAt was rewritten');
    assert.equal(q.answerDetail.needsReview, true, 'the orphaned answer was silently retained with no flag');
  });

  test('the orphaning is recorded as an event carrying both option lists', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-02', answer: 'A clean rewrite' });

    await h.post('/api/ask', reAsk(['Start from scratch', 'Port module by module']));

    const events = (await h.readDb()).events.filter((e) => e.kind === 'answer-orphaned');
    assert.equal(events.length, 1, 'no answer-orphaned event was logged, so nobody can find out it happened');
    assert.ok(JSON.stringify(events[0].detail).includes('A clean rewrite') ||
      JSON.stringify(events[0].detail).includes('Start from scratch'),
    'the event does not carry the option lists needed to understand it');
  });
});

describe('writes are atomic and serialised', () => {
  test('fifty concurrent answers all land, each with the value that was sent', async (t) => {
    const h = await hub(t);
    const ids = Array.from({ length: 50 }, (_, i) => 'C-' + String(i).padStart(2, '0'));
    await Promise.all(ids.map((id) => h.post('/api/ask', {
      id, section: '9 · Concurrency', question: 'Question ' + id, kind: 'choice',
      options: ['yes-' + id, 'no-' + id], askedBy: 'test',
    })));

    await Promise.all(ids.map((id) => h.post('/api/answer', { id, answer: 'yes-' + id })));

    const db = await h.readDb();
    const stored = new Map(db.questions.map((q) => [q.id, q.answer]));
    const wrong = ids.filter((id) => stored.get(id) !== 'yes-' + id);
    assert.deepEqual(wrong, [], wrong.length + ' answers were lost or interleaved by concurrent writes');
    assert.equal(db.questions.length, 61, 'the question array was corrupted by a concurrent write');
  });

  test('the file on disk is always complete JSON, never a half-written temp file', async (t) => {
    const h = await hub(t);
    const writes = Array.from({ length: 30 }, (_, i) =>
      h.post('/api/answer', { id: 'T-01', answer: 'tone revision ' + i }));

    const reads = [];
    for (let i = 0; i < 30; i += 1) reads.push(h.readDb().then(() => true).catch((e) => e.message));
    await Promise.all(writes);

    const failures = (await Promise.all(reads)).filter((r) => r !== true);
    assert.deepEqual(failures, [], 'a reader saw a truncated database mid-write');
  });

  test('concurrent batch saves leave one of the values that was actually sent', async (t) => {
    const h = await hub(t);
    const sent = [
      'A demoable MVP of one journey',
      'Whole-Bible reader shell, full depth only for Acts',
      'Architectural skeleton with two flagship features',
    ];

    await Promise.all(sent.map((answer) => h.post('/api/answer-batch', {
      answers: [{ id: 'S-01', answer }, { id: 'S-02', answer: 'A clean rewrite' }],
    })));

    const db = await h.readDb();
    const q = db.questions.find((x) => x.id === 'S-01');
    assert.ok(sent.includes(q.answer), 'the stored answer is not one of the values sent: ' + JSON.stringify(q.answer));
    assert.equal(db.questions.find((x) => x.id === 'S-02').answer, 'A clean rewrite');
  });
});
