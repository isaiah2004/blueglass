/**
 * The answer-notification channel (hub-platform.md §6) and invariant I-6:
 *
 *   Answering never blocks on the fleet, and the fleet never blocks on answering.
 *
 * That invariant is why the long-poll waiters live outside the write queue. The last
 * suite here is the one that actually proves it: 33 listeners holding requests open must
 * not add measurable delay to the human tapping Save.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, portAllocator } from '../helpers/hub-server.mjs';

const nextPort = portAllocator(7860);

async function hub(t, fixture = 'e2e-seed.json') {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());
  return instance;
}

const currentSeq = async (h) => (await (await h.get('/api/health')).json()).seq;

describe('a listener that is behind catches up immediately', () => {
  test('since=0 returns the backlog without waiting', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/api/events?since=0&timeout=30')).json();

    assert.ok(Array.isArray(body.events), 'events must be an array');
    assert.ok(body.events.length >= 1, 'a listener starting from zero got no history');
    assert.equal(typeof body.seq, 'number');
  });

  test('every event carries a monotonic seq, so nothing is missed between polls', async (t) => {
    const h = await hub(t);
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });

    const body = await (await h.get('/api/events?since=0&timeout=1')).json();

    const seqs = body.events.map((e) => e.seq);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'events are out of order');
    assert.equal(new Set(seqs).size, seqs.length, 'two events share a seq, so one would be skipped');
  });
});

describe('a caught-up listener is held open and woken by a write', () => {
  test('an answer wakes the poll and names the question', async (t) => {
    const h = await hub(t);
    const since = await currentSeq(h);

    // Started before the write, but correct even if the write lands first: `since` makes
    // the response deterministic either way, so this cannot flake on scheduling order.
    const polling = h.get('/api/events?since=' + since + '&timeout=30').then((r) => r.json());
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });
    const body = await polling;

    assert.ok(body.events.length >= 1, 'the listener was not woken by an answer');
    assert.ok(JSON.stringify(body.events).includes('S-01'), 'the event does not name the question answered');
    assert.ok(body.seq > since, 'seq did not advance, so the next poll would replay this event');
  });

  test('a newly asked question wakes the poll too', async (t) => {
    const h = await hub(t);
    const since = await currentSeq(h);

    const polling = h.get('/api/events?since=' + since + '&timeout=30').then((r) => r.json());
    await h.post('/api/ask', {
      id: 'LATE-01', section: '9 · Late', question: 'Posted while a listener waited.',
      kind: 'choice', options: ['Yes', 'No'], askedBy: 'test',
    });
    const body = await polling;

    assert.ok(JSON.stringify(body.events).includes('LATE-01'),
      'a question posted by an agent does not reach the phone until the next full poll');
  });

  test('a poll with nothing to report expires cleanly rather than erroring', async (t) => {
    const h = await hub(t);
    const since = await currentSeq(h);

    const res = await h.get('/api/events?since=' + since + '&timeout=1');
    const body = await res.json();

    assert.equal(res.status, 200, 'an expired long-poll must not look like a failure to the client');
    assert.deepEqual(body.events, [], 'an expired poll invented events');
    assert.equal(body.seq, since, 'seq drifted on an empty poll');
  });
});

describe('I-6 — a runaway listener cannot lock the human out', () => {
  test('33 held polls do not stop an answer being saved', async (t) => {
    const h = await hub(t);
    const since = await currentSeq(h);
    const waiters = Array.from({ length: 33 }, () =>
      h.get('/api/events?since=' + since + '&timeout=30').then((r) => r.json()).catch(() => null));

    const started = Date.now();
    const res = await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });
    const elapsed = Date.now() - started;

    assert.equal(res.status, 200, 'saving an answer failed while listeners were held open');
    assert.ok(elapsed < 5000, 'the save took ' + elapsed + 'ms with 33 listeners waiting — ' +
      'waiters are inside the write queue, so the fleet can block the human');
    const q = (await h.readDb()).questions.find((x) => x.id === 'S-01');
    assert.equal(q.answer, 'A demoable MVP of one journey');
    await Promise.all(waiters);
  });

  test('beyond the 32-waiter cap a listener is answered immediately instead of queued', async (t) => {
    const h = await hub(t);
    const since = await currentSeq(h);
    const held = Array.from({ length: 32 }, () =>
      h.get('/api/events?since=' + since + '&timeout=30').then((r) => r.json()).catch(() => null));

    const started = Date.now();
    const overflow = await (await h.get('/api/events?since=' + since + '&timeout=30')).json();
    const elapsed = Date.now() - started;

    assert.ok(elapsed < 3000,
      'the 33rd listener was held for ' + elapsed + 'ms; beyond the cap it must return at once ' +
      'so a runaway agent cannot exhaust the socket pool');
    assert.deepEqual(overflow.events, []);
    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });
    await Promise.all(held);
  });
});

describe('the health endpoint is enough to drive a restart check', () => {
  test('it reports ok, the schema version, the stats and the seq', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/api/health')).json();

    assert.equal(body.ok, true);
    assert.equal(body.version, 3, 'the orchestrator confirms the migrated version through this field');
    assert.equal(body.stats.answered, 1);
    assert.equal(typeof body.seq, 'number');
  });
});
