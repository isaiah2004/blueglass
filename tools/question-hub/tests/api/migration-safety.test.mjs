/**
 * THE MOST IMPORTANT TEST IN THE SUITE.
 *
 * A database in the OLD schema is loaded by the REAL server through the REAL load path,
 * and every answer must come out the other side intact. The pure-function tests in
 * tests/migrate.test.mjs prove the transform is correct; this proves the thing that
 * actually runs on the human's machine is wired to that transform and to nothing else.
 *
 * Runs entirely against temp directories. `data/questions.json` is never opened.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { startHub, portAllocator, loadFixture, FIXTURES } from '../helpers/hub-server.mjs';

const nextPort = portAllocator(7820);

async function hub(t, fixture) {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());
  return instance;
}

const LEGACY = ['legacy-v1-kinds.json', 'legacy-v1-curly-apostrophe.json', 'legacy-v1-edge-cases.json'];

describe('a v1 database loads, migrates, and loses no answer', () => {
  for (const fixture of LEGACY) {
    test(fixture + ': every answer is still readable over the API', async (t) => {
      const original = await loadFixture(fixture);
      const expected = original.questions.filter((q) => q.status === 'answered');

      const h = await hub(t, fixture);
      const body = await (await h.get('/api/questions?status=answered')).json();

      assert.equal(body.questions.length, expected.length,
        'the server reports ' + body.questions.length + ' answers where the file had ' + expected.length);
      for (const before of expected) {
        const after = body.questions.find((q) => q.id === before.id);
        assert.ok(after, before.id + ' is no longer readable after the migration');
        assert.deepEqual(after.answer, before.answer, before.id + ' answer text changed on load');
        assert.equal(after.answeredAt, before.answeredAt, before.id + ' answeredAt changed on load');
      }
    });

    test(fixture + ': the file the server writes back is v3 and still holds every answer', async (t) => {
      const original = await loadFixture(fixture);

      const h = await hub(t, fixture);
      await h.post('/api/ask', {
        id: 'TRIGGER-WRITE', section: '9 · Trigger', question: 'Force a persist.',
        kind: 'text', askedBy: 'test',
      });
      const onDisk = await h.readDb();

      assert.equal(onDisk.version, 3, 'the server did not write the migrated shape back');
      for (const before of original.questions) {
        const after = onDisk.questions.find((q) => q.id === before.id);
        assert.ok(after, before.id + ' was dropped from the file the server wrote');
        assert.deepEqual(after.answer, before.answer, before.id + ' answer changed in the written file');
      }
    });
  }

  test('the curly-apostrophe answer is reconciled to its option, not demoted to free text', async (t) => {
    const h = await hub(t, 'legacy-v1-curly-apostrophe.json');

    const body = await (await h.get('/api/questions?status=answered')).json();

    const q = body.questions.find((x) => x.id === 'C-01');
    assert.equal(q.answerDetail.match, 'normalised');
    assert.equal(q.answerDetail.other, null,
      'the fleet would read a deliberately-picked option as an off-menu answer');
    assert.ok(q.options.includes(q.answerDetail.selected[0]),
      'selected must be an exact member of options');
  });

  test('an unanswered question does not become answered by migrating', async (t) => {
    const h = await hub(t, 'legacy-v1-kinds.json');

    const body = await (await h.get('/api/questions')).json();

    const open = body.questions.find((q) => q.id === 'K-OPEN');
    assert.equal(open.status, 'open');
    assert.equal(open.answer, null);
    assert.equal(open.answerDetail, null);
  });
});

describe('the server backs itself up before it rewrites anything', () => {
  test('a pre-migration backup is on disk before the first write of a migrated DB', async (t) => {
    const h = await hub(t, 'legacy-v1-kinds.json');

    await h.post('/api/answer', { id: 'K-OPEN', answer: 'MapLibre' });

    const files = await readdir(h.dataDir);
    const backups = files.filter((f) => f.startsWith('questions.backup-v1-'));
    assert.equal(backups.length >= 1, true,
      'loadDb() did not write its own backup; a human remembering to back up is not a mechanism. Saw: ' + files.join(', '));
    const backup = JSON.parse(await readFile(join(h.dataDir, backups[0]), 'utf8'));
    assert.equal(backup.version, 1, 'the backup is of the migrated shape, which is not a backup');
  });

  test('an answering write leaves a rolling snapshot behind', async (t) => {
    const h = await hub(t, 'e2e-seed.json');

    await h.post('/api/answer', { id: 'S-01', answer: 'A demoable MVP of one journey' });

    const snapshots = await readdir(join(h.dataDir, 'snapshots')).catch(() => []);
    assert.ok(snapshots.length >= 1,
      'no snapshot was written, so a bad batch or a rogue agent is unrecoverable');
  });

  test('snapshots are pruned to twenty, so the directory cannot grow without bound', async (t) => {
    const h = await hub(t, 'e2e-seed.json');

    for (let i = 0; i < 25; i += 1) {
      await h.post('/api/answer', { id: 'T-01', answer: 'tone revision ' + i });
    }

    const snapshots = await readdir(join(h.dataDir, 'snapshots')).catch(() => []);
    assert.ok(snapshots.length <= 20, 'snapshots are never pruned: ' + snapshots.length + ' on disk');
    assert.ok(snapshots.length >= 15, 'snapshots are being pruned too aggressively: ' + snapshots.length);
  });
});

describe('a server that does not understand the file refuses to touch it', () => {
  test('version 99 makes the server exit non-zero instead of downgrading the file', async (t) => {
    const port = nextPort();
    let started = null;

    try {
      started = await startHub({ fixture: 'future-version-99.json', port });
      t.after(() => started.stop());
    } catch (err) {
      assert.match(err.message, /exited|Timed out/,
        'the server failed for an unexpected reason: ' + err.message);
      return;
    }

    assert.fail('the server started against a v99 database — the next persist() would ' +
      'rewrite it as v3 and drop every field it does not understand');
  });

  test('the v99 file is left byte-identical after the refusal', async (t) => {
    const before = await readFile(join(FIXTURES, 'future-version-99.json'), 'utf8');
    const port = nextPort();

    await startHub({ fixture: 'future-version-99.json', port }).then(
      (h) => { t.after(() => h.stop()); },
      () => {},
    );

    const after = await readFile(join(FIXTURES, 'future-version-99.json'), 'utf8');
    assert.equal(after, before, 'the fixture itself was modified by a test run');
  });
});
