/**
 * The frozen API contract (hub-platform.md §7): every endpoint, success and the
 * documented 4xx cases.
 *
 * The validation tests all share one purpose: a malformed question must be rejected when
 * an agent POSTs it, so it is never discovered by the human tapping a broken card on a
 * phone with no way to report it.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, portAllocator } from '../helpers/hub-server.mjs';

const nextPort = portAllocator(7880);

async function hub(t, fixture = 'e2e-seed.json') {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());
  return instance;
}

const base = {
  id: 'V-01', section: '9 · Validation', question: 'Does this validate?',
  why: 'Testing.', kind: 'choice', options: ['Yes', 'No'], askedBy: 'test',
};

/** Every rejection must be a 400 carrying one actionable sentence and nothing else. */
async function rejects(h, payload, hint) {
  const res = await h.post('/api/ask', { ...base, ...payload });
  const body = await res.json();

  assert.equal(res.status, 400, 'ACCEPTED an invalid question (' + hint + ')');
  assert.equal(typeof body.error, 'string', 'the 400 has no error message (' + hint + ')');
  assert.equal(body.error.includes('    at '), false, 'the error is a stack trace: ' + body.error);
  assert.equal(/[A-Za-z]:[\\/]/.test(body.error), false, 'the error leaks a filesystem path: ' + body.error);
  return body.error;
}

describe('GET /api/questions', () => {
  test('returns questions, stats and the status board', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/api/questions')).json();

    assert.equal(body.questions.length, 11);
    assert.deepEqual(body.stats, { total: 11, open: 10, answered: 1, blockingOpen: 1 });
    assert.equal(body.status.entries.length, 4);
  });

  test('filters by status', async (t) => {
    const h = await hub(t);

    const answered = await (await h.get('/api/questions?status=answered')).json();
    const open = await (await h.get('/api/questions?status=open')).json();

    assert.deepEqual(answered.questions.map((q) => q.id), ['A-01']);
    assert.equal(open.questions.length, 10);
  });

  test('filters by section', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/api/questions?section=' + encodeURIComponent('4 · Priorities'))).json();

    assert.deepEqual(body.questions.map((q) => q.id).sort(), ['M-01', 'R-01']);
  });

  test('answerDetail is present on read, so a client never has to re-derive it', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/api/questions?status=answered')).json();

    assert.deepEqual(body.questions[0].answerDetail.selected, ['pnpm']);
    assert.equal(body.questions[0].answerDetail.source, 'human');
  });

  test('API responses are never cached and are reachable cross-origin', async (t) => {
    const h = await hub(t);

    const res = await h.get('/api/questions');

    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    await res.arrayBuffer();
  });
});

describe('POST /api/ask rejects what would break a card', () => {
  test('an unknown kind', async (t) => {
    await rejects(await hub(t), { kind: 'interpretive-dance' }, 'unknown kind');
  });

  test('a pickable kind with no options', async (t) => {
    const h = await hub(t);
    await rejects(h, { kind: 'choice', options: undefined }, 'choice with no options');
    await rejects(h, { kind: 'rank', options: undefined }, 'rank with no options');
  });

  test('duplicate option labels — optionMeta is keyed by label, so they must be unique', async (t) => {
    await rejects(await hub(t), { options: ['Yes', 'Yes'] }, 'duplicate labels');
  });

  test('an optionMeta key that is not one of the options', async (t) => {
    await rejects(await hub(t), { optionMeta: { Maybe: { consequence: 'x' } } }, 'orphan optionMeta key');
  });

  test('an unknown attachment type', async (t) => {
    await rejects(await hub(t), { attachments: [{ type: 'quantum-hologram' }] }, 'unknown attachment');
  });

  test('an image with no alt text', async (t) => {
    await rejects(await hub(t),
      { attachments: [{ type: 'image', src: 'docs/product/mockups/image9.png' }] }, 'image without alt');
  });

  test('a link whose scheme is not http or https', async (t) => {
    const h = await hub(t);
    for (const href of ['javascript:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd']) {
      await rejects(h, { attachments: [{ type: 'link', href, label: 'tap' }] }, href);
    }
  });

  test('a media src that the /media/ gates would refuse — caught at ask time', async (t) => {
    const h = await hub(t);
    for (const src of ['../../CLAUDE.md', 'tools/question-hub/data/questions.json', 'docs/product/x.svg']) {
      await rejects(h, { attachments: [{ type: 'image', src, alt: 'nope' }] }, src);
    }
  });

  test('a missing question or section', async (t) => {
    const h = await hub(t);
    await rejects(h, { question: undefined }, 'no question text');
    await rejects(h, { section: undefined }, 'no section');
  });

  test('a valid question with attachments is accepted and stored whole', async (t) => {
    const h = await hub(t);

    const res = await h.post('/api/ask', {
      ...base,
      attachments: [{ type: 'image', src: 'docs/product/mockups/image9.png', alt: 'the reader' }],
      optionMeta: { Yes: { consequence: 'Three days of restyling.' } },
      allowOther: false,
      layout: 'compare',
      assumedInUse: true,
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.attachments.length, 1);
    assert.equal(body.optionMeta.Yes.consequence, 'Three days of restyling.');
    assert.equal(body.allowOther, false);
    assert.equal(body.layout, 'compare');
    assert.equal(body.assumedInUse, true);
  });
});

describe('POST /api/answer', () => {
  test('a flat answer string still works, so curl and ask.mjs are unchanged', async (t) => {
    const h = await hub(t);

    const body = await (await h.post('/api/answer', { id: 'S-02', answer: 'A clean rewrite' })).json();

    assert.equal(body.answer, 'A clean rewrite');
    assert.deepEqual(body.answerDetail.selected, ['A clean rewrite'],
      'the server did not derive answerDetail from a flat answer');
  });

  test('answerDetail wins when both are sent, and the flat answer is regenerated from it', async (t) => {
    const h = await hub(t);

    const body = await (await h.post('/api/answer', {
      id: 'M-01',
      answer: 'this string should be thrown away',
      answerDetail: { selected: ['Route', 'History'], other: 'Also chronology' },
    })).json();

    assert.equal(body.answer, 'Route | History | Other: Also chronology',
      'the flat answer was taken from the client instead of derived');
  });

  test('free text is never stored as if it were a picked option', async (t) => {
    const h = await hub(t);

    const res = await h.post('/api/answer', {
      id: 'S-01', answerDetail: { selected: ['Something I typed myself'] },
    });

    assert.equal(res.status, 400, 'free text was accepted into selected');
  });

  test('an unknown id is a 404, not a silently created question', async (t) => {
    const h = await hub(t);

    const res = await h.post('/api/answer', { id: 'NOPE-99', answer: 'x' });

    assert.equal(res.status, 404);
    assert.equal((await h.readDb()).questions.length, 11, 'answering an unknown id created a record');
  });
});

describe('POST /api/status', () => {
  test('replaces the whole board so it cannot accumulate stale rows', async (t) => {
    const h = await hub(t);

    await h.post('/api/status', {
      headline: 'Rebuilt.', entries: [{ title: 'Only entry', state: 'done' }],
    });

    const body = await (await h.get('/api/questions')).json();
    assert.equal(body.status.entries.length, 1, 'the board was patched rather than replaced');
    assert.equal(body.status.headline, 'Rebuilt.');
  });

  test('an unknown state is rejected with a message naming the valid ones', async (t) => {
    const h = await hub(t);

    const res = await h.post('/api/status', { entries: [{ title: 'x', state: 'vibing' }] });
    const body = await res.json();

    assert.equal(res.status, 400);
    assert.match(body.error, /done|running|blocked|queued/);
  });
});

describe('the static UI is served, and only the UI', () => {
  test('GET / returns the answering page', async (t) => {
    const h = await hub(t);

    const res = await h.get('/');
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/html/);
    assert.match(html, /<script[^>]+app\.js/, 'index.html does not load the app module');
  });

  test('the stylesheet and the modules are served', async (t) => {
    const h = await hub(t);

    for (const path of ['/app.css', '/app.js', '/render-card.js']) {
      const res = await h.get(path);
      assert.equal(res.status, 200, path + ' is not served');
      await res.arrayBuffer();
    }
  });

  test('no path outside public/ is reachable through the static route', async (t) => {
    const h = await hub(t);

    for (const path of ['/../server.mjs', '/../../CLAUDE.md', '/../data/questions.json', '/server.mjs']) {
      const res = await h.get(path);
      const body = await res.text();
      assert.notEqual(res.status, 200, 'SERVED a file outside public/: ' + path);
      assert.equal(body.includes('HUB_DATA_DIR'), false, path + ' leaked server source');
    }
  });
});
