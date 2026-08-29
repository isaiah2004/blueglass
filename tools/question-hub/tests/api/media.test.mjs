/**
 * The /media/ route over real HTTP (hub-platform.md §3.3).
 *
 * tests/media-path-safety.test.mjs pins the gates down as pure logic; this file checks
 * the things only a real request can show: the headers, the 304, the streaming, and the
 * property that matters most for an endpoint anyone on the wifi can reach —
 *
 *   every rejection looks exactly like every other rejection, so the endpoint cannot be
 *   used to find out what exists.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, portAllocator } from '../helpers/hub-server.mjs';

const nextPort = portAllocator(7840);
const REFERENCED = '/media/docs/product/mockups/image9.png';

async function hub(t, fixture = 'media-safety.json') {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());
  return instance;
}

describe('a published mockup is served, with the headers a phone needs', () => {
  test('200, the right content type, and nosniff', async (t) => {
    const h = await hub(t);

    const res = await h.get(REFERENCED);

    assert.equal(res.status, 200, 'the positive control failed; every 404 below proves nothing');
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    await res.arrayBuffer();
  });

  test('immutable caching, so a second visit costs nothing on phone wifi', async (t) => {
    const h = await hub(t);

    const res = await h.get(REFERENCED);

    assert.match(res.headers.get('cache-control') ?? '', /immutable/);
    assert.match(res.headers.get('cache-control') ?? '', /max-age=31536000/);
    assert.ok(res.headers.get('etag'), 'no etag, so a phone re-downloads 2 MB on every poll');
    assert.ok(Number(res.headers.get('content-length')) > 0, 'no content-length');
    await res.arrayBuffer();
  });

  test('if-none-match returns 304 with no body', async (t) => {
    const h = await hub(t);
    const first = await h.get(REFERENCED);
    const etag = first.headers.get('etag');
    await first.arrayBuffer();

    const second = await h.get(REFERENCED, { headers: { 'if-none-match': etag } });

    assert.equal(second.status, 304);
    assert.equal((await second.arrayBuffer()).byteLength, 0, 'a 304 must not carry the file');
  });

  test('the bytes served are the real file, complete', async (t) => {
    const h = await hub(t);

    const res = await h.get(REFERENCED);
    const body = await res.arrayBuffer();

    assert.equal(body.byteLength, Number(res.headers.get('content-length')),
      'the stream was truncated, which on an image means a half-rendered mockup');
    assert.deepEqual([...new Uint8Array(body.slice(0, 4))], [0x89, 0x50, 0x4e, 0x47], 'not a PNG');
  });

  test('an attachment hanging off an option is served too', async (t) => {
    const h = await hub(t);

    const res = await h.get('/media/docs/product/mockups/image6.png');

    assert.equal(res.status, 200, 'optionMeta attachments 404, so compare and swatch layouts break');
    await res.arrayBuffer();
  });
});

describe('every refusal is a bare 404 and they are indistinguishable', () => {
  const REJECTED = {
    'parent-directory hop': '/media/docs/product/../../CLAUDE.md',
    'percent-encoded hop': '/media/docs/product/%2e%2e/CLAUDE.md',
    'double-encoded hop': '/media/docs/product/%252e%252e/CLAUDE.md',
    'outside every allowed root': '/media/docs/decisions/ASSUMPTIONS.md',
    'the answers file itself': '/media/tools/question-hub/data/questions.json',
    'prefix-confused sibling': '/media/docs/product-secrets/leak.png',
    'excluded .svg extension': '/media/docs/product/mockups/decoy.svg',
    'a directory, not a file': '/media/docs/product/mockups',
    'real but unpublished': '/media/docs/product/mockups/image1.png',
    'published then withdrawn': '/media/docs/product/mockups/image8.png',
    'does not exist at all': '/media/docs/product/mockups/nothing-here.png',
  };

  test('each one is a 404', async (t) => {
    const h = await hub(t);

    for (const [why, path] of Object.entries(REJECTED)) {
      const res = await h.get(path);
      assert.equal(res.status, 404, 'SERVED a path it must refuse (' + why + '): ' + path);
      await res.arrayBuffer();
    }
  });

  test('the responses are byte-identical, so the endpoint cannot be used to probe the disk', async (t) => {
    const h = await hub(t);
    const shapes = [];

    for (const path of Object.values(REJECTED)) {
      const res = await h.get(path);
      shapes.push(JSON.stringify({
        status: res.status,
        type: res.headers.get('content-type'),
        body: (await res.text()).slice(0, 200),
      }));
    }

    const distinct = [...new Set(shapes)];
    assert.equal(distinct.length, 1,
      'refusals differ from each other, so a reader can tell "forbidden" from "missing":\n' +
        distinct.join('\n'));
  });

  test('a 404 never leaks a filesystem path', async (t) => {
    const h = await hub(t);

    const body = await (await h.get('/media/docs/decisions/ASSUMPTIONS.md')).text();

    assert.equal(/[A-Za-z]:[\\/]/.test(body), false, 'the response contains an absolute path: ' + body);
    assert.equal(body.includes('spark-expo'), false, 'the response names the repository directory');
  });

  test('a refusal is never cached, so fixing a path does not need a cache bust', async (t) => {
    const h = await hub(t);

    const res = await h.get('/media/docs/product/mockups/image1.png');

    assert.equal(/immutable/.test(res.headers.get('cache-control') ?? ''), false,
      'a 404 was cached for a year');
    await res.arrayBuffer();
  });
});

describe('there is no directory listing', () => {
  for (const path of ['/media/', '/media', '/media/docs/', '/media/docs/product/', '/media/docs/product/mockups/']) {
    test(path + ' is a 404, not an index', async (t) => {
      const h = await hub(t);

      const res = await h.get(path);
      const body = await res.text();

      assert.equal(res.status, 404, path + ' returned ' + res.status);
      assert.equal(body.includes('image9'), false, path + ' enumerated the directory');
    });
  }
});

describe('the referenced set tracks writes', () => {
  test('withdrawing a question stops its media being served, without a restart', async (t) => {
    const h = await hub(t);
    assert.equal((await h.get(REFERENCED)).status, 200);

    await h.post('/api/withdraw', { id: 'M-OK', reason: 'no longer needed' });

    const res = await h.get(REFERENCED);
    assert.equal(res.status, 404, 'withdraw did not retract the published file');
    await res.arrayBuffer();
  });

  test('asking a new question publishes its media immediately', async (t) => {
    const h = await hub(t);
    assert.equal((await h.get('/media/docs/product/mockups/image1.png')).status, 404);

    await h.post('/api/ask', {
      id: 'NEW-01', section: '1 · Media', question: 'Does this render?', kind: 'choice',
      options: ['Yes', 'No'], askedBy: 'test',
      attachments: [{ type: 'image', src: 'docs/product/mockups/image1.png', alt: 'newly published' }],
    });

    const res = await h.get('/media/docs/product/mockups/image1.png');
    assert.equal(res.status, 200, 'a newly published file is not servable until a restart');
    await res.arrayBuffer();
  });
});
