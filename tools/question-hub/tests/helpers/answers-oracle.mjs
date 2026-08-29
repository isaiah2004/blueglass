/**
 * The old-reader equivalence oracle (hub-platform.md §4.6.4).
 *
 * The whole fleet reads the human's decisions through `answers.mjs --json`. If that
 * tool cannot tell the migration happened, the migration is backward-compatible in the
 * only sense that matters to the agents downstream.
 *
 * To compare pre- and post-migration output we need to serve *both* shapes to the real
 * `answers.mjs`. Rather than start the hub twice (which would migrate on load, so the
 * "pre" case would be unobtainable), we stand up a throwaway stub that answers exactly
 * one route with a supplied in-memory DB. It listens on an ephemeral port, so it can
 * never collide with 7777 or 7788, and it is torn down before the function returns.
 */
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HUB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANSWERS_CLI = join(HUB_DIR, 'answers.mjs');

/** Reproduces `buildStats()` from the hub server, which `answers.mjs` echoes verbatim. */
function buildStats(questions) {
  return {
    total: questions.length,
    open: questions.filter((q) => q.status === 'open').length,
    answered: questions.filter((q) => q.status === 'answered').length,
    blockingOpen: questions.filter((q) => q.status === 'open' && q.blocking).length,
  };
}

/**
 * Serve one in-memory DB over `GET /api/questions` on an ephemeral port.
 *
 * @param {object} db
 * @param {{ excludeWithdrawn?: boolean }} opts `true` emulates the v3 server, `false`
 *   the v1 server that had no such status. Both are supplied explicitly so the
 *   comparison is between two honestly-modelled readers, not one reader twice.
 */
async function serveDb(db, { excludeWithdrawn }) {
  const all = db.questions ?? [];
  const questions = excludeWithdrawn ? all.filter((q) => q.status !== 'withdrawn') : all;
  const payload = JSON.stringify({ questions, stats: buildStats(questions), status: db.status ?? null });

  const server = createServer((req, res) => {
    if (!req.url.startsWith('/api/questions')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end('{"error":"stub serves /api/questions only"}');
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(payload);
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: 'http://127.0.0.1:' + server.address().port };
}

/** Run the real `answers.mjs` against a stub serving `db`, and return its stdout verbatim. */
export async function answersJson(db, { excludeWithdrawn = false } = {}) {
  const { server, url } = await serveDb(db, { excludeWithdrawn });
  try {
    return await new Promise((resolve, reject) => {
      execFile(
        process.execPath,
        [ANSWERS_CLI, '--json'],
        { env: { ...process.env, HUB_URL: url }, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)),
      );
    });
  } finally {
    server.close();
    await once(server, 'close');
  }
}

/**
 * The gate itself: byte-identical `answers.mjs --json` before and after.
 *
 * @returns {{ ok: boolean, before: string, after: string, firstDifference: object|null }}
 */
export async function oldReaderEquivalence(beforeDb, afterDb) {
  const before = await answersJson(beforeDb, { excludeWithdrawn: false });
  const after = await answersJson(afterDb, { excludeWithdrawn: true });
  if (before === after) return { ok: true, before, after, firstDifference: null };
  return { ok: false, before, after, firstDifference: describeDifference(before, after) };
}

/** Point at the first differing line so a failure is actionable, not just "not equal". */
function describeDifference(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) {
      return { line: i + 1, before: a[i] ?? '<end of output>', after: b[i] ?? '<end of output>' };
    }
  }
  return { line: null, before: '<identical lines, differing length>', after: '' };
}
