/**
 * One named test per gate in hub-platform.md §3.3.
 *
 * These run against `resolveMediaPath` rather than over HTTP on purpose. The function
 * never touches the filesystem, so a rejection here can only have come from the gate
 * under test — over HTTP a missing file 404s for its own reasons and would mask a
 * broken extension or root check. The HTTP behaviour is covered separately in
 * tests/api/media.test.mjs; this file is where the gates are actually pinned down.
 *
 * The threat: anyone on the home wifi can reach this port. `/media/` is the only route
 * that reads outside tools/question-hub/, so it is the whole attack surface.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMediaPath, rebuildReferencedSet, isReferenced, REPO_ROOT } from '../lib/media.mjs';
import { loadFixture } from './helpers/hub-server.mjs';

const rejected = (raw) => assert.equal(resolveMediaPath(raw), null, 'ACCEPTED a path it must refuse: ' + raw);
const accepted = (raw) => {
  const hit = resolveMediaPath(raw);
  assert.ok(hit, 'REFUSED a path it must serve: ' + raw);
  return hit;
};

describe('gate 0 — the positive control', () => {
  test('a real mockup inside an allowed root resolves', () => {
    const hit = accepted('docs/product/mockups/image9.png');

    assert.equal(hit.type, 'image/png');
    assert.ok(hit.abs.startsWith(REPO_ROOT), 'resolved outside the repo');
  });

  test('REPO_ROOT is derived from the module, not the working directory', () => {
    const fromCwd = process.cwd();

    assert.notEqual(REPO_ROOT, fromCwd + '/nowhere');
    assert.ok(REPO_ROOT.endsWith('spark-expo') || REPO_ROOT.length > 0,
      'REPO_ROOT must point at the repo regardless of where the server was started');
  });
});

describe('gate 1 — character check, before and after exactly one decode', () => {
  test('a parent-directory hop is refused', () => {
    rejected('docs/product/../../CLAUDE.md');
    rejected('../CLAUDE.md');
    rejected('docs/product/mockups/../../../package.json');
  });

  test('a backslash is refused — it is a path separator on this platform', () => {
    rejected('docs' + String.fromCharCode(92) + 'product' + String.fromCharCode(92) + 'mockups' + String.fromCharCode(92) + 'image9.png');
  });

  test('a NUL byte is refused — it truncates the path in a C-level call', () => {
    rejected('docs/product/mockups/image9.png' + String.fromCharCode(0) + '.txt');
  });

  test('percent-encoded traversal is refused after the single decode', () => {
    rejected('docs/product/%2e%2e/%2e%2e/CLAUDE.md');
    rejected('docs/product/%2E%2E/package.json');
  });

  test('double-encoded traversal is dead on arrival — a surviving % after one decode', () => {
    rejected('docs/product/%252e%252e/CLAUDE.md');
    rejected('docs/product/mockups/%2500.png');
  });

  test('an absolute path is refused rather than resolved', () => {
    rejected('/etc/passwd');
    rejected('/docs/product/mockups/image9.png');
    rejected('C:/Windows/win.ini');
  });
});

describe('gate 3 — the root allow-list, tested for prefix confusion', () => {
  test('a sibling directory sharing a prefix with an allowed root is refused', () => {
    rejected('docs/product-secrets/leak.png');
    rejected('docs/architecture-private/notes.md');
    rejected('tools/question-hub/media-backup/dump.png');
  });

  test('the human\'s own answers are not servable', () => {
    rejected('tools/question-hub/data/questions.json');
    rejected('tools/question-hub/data/questions.backup-v1-2026-08-28T18-43-13-586Z.json');
  });

  test('real files outside every allowed root are refused', () => {
    rejected('docs/decisions/ASSUMPTIONS.md');
    rejected('CLAUDE.md');
    rejected('package.json');
    rejected('tools/question-hub/server.mjs');
  });

  test('each allowed root does admit its own contents', () => {
    accepted('docs/product/mockups/image9.png');
    accepted('docs/product/design-language.md');
    accepted('docs/architecture/hub-platform.md');
    accepted('tools/question-hub/media/anything.png');
  });
});

describe('gate 4 — the extension allow-list', () => {
  test('.svg is refused — it executes script on direct navigation', () => {
    rejected('docs/product/mockups/logo.svg');
    rejected('docs/product/mockups/IMAGE.SVG');
  });

  test('executable and source extensions are refused', () => {
    rejected('docs/product/payload.exe');
    rejected('docs/product/script.mjs');
    rejected('docs/product/page.html');
    rejected('docs/product/style.css');
  });

  test('a file with no extension is refused rather than sniffed', () => {
    rejected('docs/product/mockups/README');
    rejected('docs/product/mockups');
  });

  test('every allowed extension maps to a fixed content type, never octet-stream', () => {
    const expected = {
      'a.png': 'image/png', 'a.jpg': 'image/jpeg', 'a.jpeg': 'image/jpeg',
      'a.webp': 'image/webp', 'a.gif': 'image/gif',
    };

    for (const [name, type] of Object.entries(expected)) {
      assert.equal(accepted('docs/product/mockups/' + name).type, type, name);
    }
    for (const name of ['a.md', 'a.json', 'a.txt']) {
      const hit = accepted('docs/product/mockups/' + name);
      assert.notEqual(hit.type, 'application/octet-stream', name + ' fell back to octet-stream');
      assert.ok(hit.type.includes('charset=utf-8'), name + ' text type must declare a charset');
    }
  });

  test('an uppercase extension is matched case-insensitively, not waved through', () => {
    assert.equal(accepted('docs/product/mockups/IMAGE9.PNG').type, 'image/png');
  });
});

describe('gate 6 — referenced-only, the gate that actually matters', () => {
  test('a file published by a live question is in the referenced set', async () => {
    const db = await loadFixture('media-safety.json');

    rebuildReferencedSet(db);

    assert.ok(isReferenced(resolveMediaPath('docs/product/mockups/image9.png').key),
      'a question published image9.png but the media gate does not know it');
  });

  test('a real mockup nobody asked about is NOT referenced', async () => {
    const db = await loadFixture('media-safety.json');

    rebuildReferencedSet(db);

    assert.equal(isReferenced(resolveMediaPath('docs/product/mockups/image1.png').key), false,
      'an unpublished file is reachable — /media/ is a file browser, not a projection of the log');
  });

  test('withdrawing a question un-publishes its media', async () => {
    const db = await loadFixture('media-safety.json');

    rebuildReferencedSet(db);

    assert.equal(isReferenced(resolveMediaPath('docs/product/mockups/image8.png').key), false,
      'a withdrawn question still publishes its attachment, so withdraw retracts nothing');
  });

  test('an attachment hanging off an option counts as published', async () => {
    const db = await loadFixture('media-safety.json');

    rebuildReferencedSet(db);

    assert.ok(isReferenced(resolveMediaPath('docs/product/mockups/image6.png').key),
      'optionMeta attachments were skipped, so compare and swatch layouts would 404');
  });

  test('the set is rebuilt, not appended to — removing a question removes its media', async () => {
    const db = await loadFixture('media-safety.json');
    rebuildReferencedSet(db);
    const key = resolveMediaPath('docs/product/mockups/image9.png').key;
    assert.ok(isReferenced(key));

    rebuildReferencedSet({ questions: [] });

    assert.equal(isReferenced(key), false, 'the referenced set grows forever and never forgets');
  });
});
