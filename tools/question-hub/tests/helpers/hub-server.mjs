/**
 * Boot a disposable Question Hub for a test, and make "it cannot touch the live data"
 * a mechanism rather than a promise.
 *
 * Three independent guards, because one is a promise and three is a system:
 *   1. `assertIsolated()` refuses to spawn if the resolved data directory is anywhere
 *      inside the real `tools/question-hub/data/`.
 *   2. `assertDataDirOverrideSupported()` greps the server source for `HUB_DATA_DIR`
 *      BEFORE spawning. A server that ignored the override would silently open the
 *      human's answers instead, so this check happens while nothing is running.
 *   3. After boot, `/api/health` must report exactly the fixture's question count. If a
 *      server loaded the live file anyway it reports ~97 and we kill it immediately,
 *      before any test has issued a single write.
 *
 * Never sleeps. Everything waits on a condition with a deadline.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, writeFile, readFile, rm, mkdir } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const HUB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = join(HUB_DIR, 'server.mjs');
const LIVE_DATA_DIR = join(HUB_DIR, 'data');
export const FIXTURES = join(HUB_DIR, 'tests', 'fixtures');
export const DEFAULT_TEST_PORT = Number(process.env.HUB_TEST_PORT ?? 7788);

/**
 * Hand out a fresh port for every boot, and never reuse one.
 *
 * `node --test` runs files in parallel, so a shared 7788 would make two suites fight over
 * a socket. Reusing a port *within* a file is just as bad and much harder to see: a server
 * that fails to bind leaves the previous test's server answering on that port, and the new
 * test then asserts against the old test's data. Monotonic ports remove the failure mode
 * rather than making it rarer.
 */
export function portAllocator(base) {
  let n = 0;
  return () => base + n++;
}

/** Fail loudly if something already owns the port, instead of talking to it by accident. */
async function assertPortFree(port) {
  const probe = createServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, '127.0.0.1', resolve);
    });
  } catch (err) {
    throw new Error('Port ' + port + ' is already in use (' + err.code + '). A previous test ' +
      'server was not stopped, or another process owns it. Refusing to bind, because the ' +
      'test would silently talk to whatever is already there.');
  } finally {
    probe.close();
    await once(probe, 'close').catch(() => {});
  }
}

/** Hard stop: a temp directory that overlaps the human's answers is not a temp directory. */
function assertIsolated(dataDir) {
  const candidate = resolve(dataDir);
  const live = resolve(LIVE_DATA_DIR);
  if (candidate === live || candidate.startsWith(live + sep)) {
    throw new Error('REFUSING TO RUN: test data dir resolves inside the live data dir (' + candidate + ')');
  }
}

/**
 * Confirm the server honours `HUB_DATA_DIR` before we hand it a temp directory.
 * Checked by reading the source, so the answer is known while nothing is running.
 */
function assertDataDirOverrideSupported() {
  const sources = [SERVER, join(HUB_DIR, 'lib', 'db.mjs')].filter((p) => existsSync(p));
  if (sources.length === 0) throw new Error('No server.mjs found at ' + SERVER);
  const supports = sources.some((p) => readFileSync(p, 'utf8').includes('HUB_DATA_DIR'));
  if (!supports) {
    throw new Error(
      'REFUSING TO RUN: neither server.mjs nor lib/db.mjs mentions HUB_DATA_DIR, so a test ' +
        'server would open the live data file. The server agent owns this override ' +
        '(hub-platform.md §8.5); tests stay red until it lands.',
    );
  }
}

/**
 * A census of the human's answers in the LIVE file, for before/after proof.
 *
 * Deliberately NOT a hash of the whole file. The running hub on 7777 is a live service:
 * a fleet agent posting a question changes those bytes for entirely legitimate reasons,
 * and a whole-file fingerprint would fail the test run every time that happened. A gate
 * that cries wolf gets ignored, and then it protects nothing.
 *
 * What must never change is the answers themselves, so that is what is compared: the id,
 * the answer text and the timestamp of every answered question.
 */
export function liveAnswerCensus() {
  const path = join(LIVE_DATA_DIR, 'questions.json');
  if (!existsSync(path)) return { path, missing: true, answers: {} };
  const bytes = readFileSync(path);
  const db = JSON.parse(bytes.toString('utf8'));
  const answers = {};
  for (const q of db.questions ?? []) {
    if (q.status === 'answered') answers[q.id] = { answer: q.answer, answeredAt: q.answeredAt };
  }
  return {
    path,
    missing: false,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    questions: (db.questions ?? []).length,
    answers,
  };
}

/**
 * Compare two censuses. Returns the list of ways the human's answers changed — empty is
 * the only acceptable result. New questions and new answers arriving from the live fleet
 * are NOT failures; losing or rewriting an existing answer is.
 */
export function answerCensusDiff(before, after) {
  const problems = [];
  if (before.missing || after.missing) return problems;
  for (const [id, was] of Object.entries(before.answers)) {
    const now = after.answers[id];
    if (!now) {
      problems.push(id + ' is no longer answered');
    } else if (now.answer !== was.answer) {
      problems.push(id + ' answer text changed');
    } else if (now.answeredAt !== was.answeredAt) {
      problems.push(id + ' answeredAt changed');
    }
  }
  return problems;
}

/** Poll a condition to a deadline. Returns the first truthy value; throws on timeout. */
export async function waitFor(probe, { timeout = 15000, interval = 50, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  for (;;) {
    try {
      const value = await probe();
      if (value) return value;
    } catch (err) {
      lastError = err;
    }
    if (Date.now() > deadline) {
      throw new Error('Timed out after ' + timeout + 'ms waiting for ' + label +
        (lastError ? ' — last error: ' + lastError.message : ''));
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

/**
 * Start a hub against a fresh temp directory seeded from a fixture.
 *
 * @param {object} opts
 * @param {string} [opts.fixture] filename in tests/fixtures to seed `questions.json` with
 * @param {object} [opts.db] an in-memory DB to seed with instead of a fixture file
 * @param {number} [opts.port]
 * @param {object} [opts.env] extra environment for the child
 */
export async function startHub({ fixture, db, port = DEFAULT_TEST_PORT, env = {} } = {}) {
  assertDataDirOverrideSupported();
  await assertPortFree(port);

  const dataDir = await mkdtemp(join(tmpdir(), 'hub-test-'));
  assertIsolated(dataDir);

  if (fixture || db) {
    const seed = db ?? JSON.parse(await readFile(join(FIXTURES, fixture), 'utf8'));
    delete seed._comment;
    await writeFile(join(dataDir, 'questions.json'), JSON.stringify(seed, null, 2), 'utf8');
  }

  const child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, HUB_PORT: String(port), HUB_DATA_DIR: dataDir, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = { out: '', err: '' };
  child.stdout.on('data', (c) => { logs.out += c; });
  child.stderr.on('data', (c) => { logs.err += c; });

  const exited = new Promise((r) => child.once('exit', (code) => r(code)));
  const url = 'http://127.0.0.1:' + port;
  const hub = buildHandle({ child, url, port, dataDir, logs, exited });

  await waitForHealth(hub, { fixture, db });
  return hub;
}

function buildHandle({ child, url, port, dataDir, logs, exited }) {
  return {
    url, port, dataDir, logs, child, exited,
    /** Read the temp database straight off disk — the ground truth a reload would see. */
    async readDb() {
      return JSON.parse(await readFile(join(dataDir, 'questions.json'), 'utf8'));
    },
    async get(path, init) {
      return fetch(url + path, { cache: 'no-store', ...init });
    },
    async post(path, body) {
      return fetch(url + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    },
    async stop() {
      if (child.exitCode === null) child.kill();
      await exited;
      await rm(dataDir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Wait for liveness, then prove the server is reading OUR data and not the human's. */
async function waitForHealth(hub, { fixture, db }) {
  // Race liveness against the child dying. Polling alone would swallow an immediate exit
  // (a refused version, a syntax error) and report it 15 seconds later as a timeout.
  const health = await Promise.race([
    waitFor(async () => {
      const res = await hub.get('/api/health');
      return res.ok ? await res.json() : null;
    }, { label: 'GET /api/health on port ' + hub.port }),
    hub.exited.then((code) => ({ __exited: code })),
  ]).catch(async (err) => { await hub.stop(); throw err; });

  if (health && health.__exited !== undefined) {
    const code = health.__exited;
    await hub.stop();
    throw new Error('server exited with code ' + code + ' during startup: ' + hub.logs.err.trim());
  }

  const expected = expectedQuestionCount({ fixture, db });
  if (expected !== null && health?.stats?.total !== expected) {
    const actual = health?.stats?.total;
    await hub.stop();
    throw new Error(
      'REFUSING TO CONTINUE: hub reported ' + actual + ' questions but the fixture has ' +
        expected + ' live ones. The server may not be using HUB_DATA_DIR, which would mean ' +
        'it is reading the live answers file.',
    );
  }
  hub.health = health;
  return health;
}

/**
 * What `stats.total` should report for this fixture.
 * Withdrawn questions are excluded, because that is what the API does — counting them
 * here would make the isolation guard fire on a fixture that loaded perfectly.
 */
function expectedQuestionCount({ fixture, db }) {
  const source = db ?? (fixture ? JSON.parse(readFileSync(join(FIXTURES, fixture), 'utf8')) : null);
  if (!source) return null;
  return (source.questions ?? []).filter((q) => q.status !== 'withdrawn').length;
}

/** Seed a temp data dir without starting anything — for tests that only read the file. */
export async function makeDataDir(fixture) {
  const dir = await mkdtemp(join(tmpdir(), 'hub-data-'));
  assertIsolated(dir);
  await mkdir(dir, { recursive: true });
  if (fixture) {
    const seed = JSON.parse(await readFile(join(FIXTURES, fixture), 'utf8'));
    delete seed._comment;
    await writeFile(join(dir, 'questions.json'), JSON.stringify(seed, null, 2), 'utf8');
  }
  return dir;
}

/** Load a fixture as a plain object, with the explanatory `_comment` stripped. */
export async function loadFixture(name) {
  const parsed = JSON.parse(await readFile(join(FIXTURES, name), 'utf8'));
  delete parsed._comment;
  return parsed;
}
