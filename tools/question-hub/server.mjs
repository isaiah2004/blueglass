/**
 * Question Hub — the async decision channel between the agent fleet and the human.
 *
 * HTTP wiring and startup only: create the server, look up a route, listen, print the LAN
 * addresses. All business logic lives in lib/, so the thing the whole fleet depends on stays
 * small enough to read in one sitting. Zero runtime dependencies, forever (invariant I-4):
 * the hub must never fail to start because of a package install. `node:*` imports only.
 *
 * Startup order matters. The migration is the ONLY thing allowed to abort startup; media is
 * loaded defensively, so if it ever fails to import the hub still serves questions and still
 * saves answers — it just cannot serve images (risk R-2).
 *
 * Env: HUB_PORT (default 7777), HUB_DATA_DIR (default tools/question-hub/data).
 */
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { DB_PATH, getDb, loadDb, onPersisted, persist } from './lib/db.mjs';
import { HttpError, dispatch } from './lib/http.mjs';
import { currentSeq, releaseWaiters, waitForEvents, wakeWaiters } from './lib/events.mjs';
import { SCHEMA_VERSION } from './lib/migrate.mjs';
import * as questions from './lib/questions.mjs';
import { handleStatus } from './lib/status-board.mjs';
import { serveStatic } from './lib/static.mjs';

const PORT = Number(process.env.HUB_PORT ?? 7777);

/** Loaded defensively: /media/ is a feature, not a precondition for answering. */
let media = null;
try {
  media = await import('./lib/media.mjs');
  questions.configureMediaCheck((src) => media.resolveMediaPath(src) !== null);
} catch (err) {
  console.error('[hub] media module failed to load, images are disabled: ' + err.message);
}

async function serveMedia(req, res, relative) {
  if (media) return media.serveMedia(req, res, relative);
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  return res.end('Not found');
}

/** GET /api/events — long-poll. Held open outside the write queue, so it never delays a save. */
async function readEvents(url) {
  const since = Number(url.searchParams.get('since') ?? 0);
  const seconds = Math.min(60, Math.max(1, Number(url.searchParams.get('timeout') ?? 30)));
  return waitForEvents(getDb(), Number.isFinite(since) ? since : 0, seconds * 1000);
}

const ROUTES = {
  get: {
    '/api/questions': (url) => questions.listQuestions(getDb(), url),
    '/api/health': () => ({ ok: true, stats: questions.buildStats(getDb()), version: SCHEMA_VERSION, seq: currentSeq(getDb()) }),
    '/api/events': readEvents,
  },
  post: {
    '/api/ask': questions.handleAsk,
    '/api/answer': questions.handleAnswer,
    '/api/answer-batch': questions.handleAnswerBatch,
    '/api/accept-recommendations': questions.handleAcceptRecommendations,
    '/api/withdraw': questions.handleWithdraw,
    '/api/status': handleStatus,
  },
  // Ordered. /media/ is tested first; the /api/ guard keeps an unknown API path answering
  // JSON rather than falling through to the static handler's plain-text 404.
  prefixes: [
    ['/media/', serveMedia],
    ['/api/', () => {
      throw new HttpError(404, 'No such API route. See tools/question-hub/README.md for the endpoint list.');
    }],
    ['/', serveStatic],
  ],
};

const server = createServer((req, res) => {
  dispatch(req, res, ROUTES).catch((err) => {
    console.error('[hub] dispatch crashed:', err);
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json' });
    res.end('{"error":"The hub hit an unexpected error."}');
  });
});

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

// A migration failure is fatal on purpose: better a loud dead port than a silent rollback.
const loaded = await loadDb();
const db = getDb();

/** Keeps the referenced-only media gate from going stale. Never fatal: no images beats no hub. */
function refreshMediaIndex(current) {
  try {
    media?.rebuildReferencedSet(current);
  } catch (err) {
    console.warn('[hub] media index rebuild failed, images may 404: ' + err.message);
  }
}

// Waiters are woken after persist has resolved, never from inside the write queue, so a
// listener holding a request open can never delay the human's answer reaching disk (I-6).
onPersisted((current) => {
  refreshMediaIndex(current);
  wakeWaiters(current);
});
refreshMediaIndex(db);

// The pre-migration backup is written by this first persist, before anything else can write.
if (loaded.from !== loaded.to) {
  await persist();
  console.log('[hub] migrated storage v' + loaded.from + ' -> v' + loaded.to + ' (backup: ' + loaded.backup + ')');
}

// Shutdown must actually free the port. Long-polls are held open for up to 60s, so waiters
// are released and sockets closed rather than waited on — the one deliberate restart cannot
// afford a previous process still holding 7777.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    releaseWaiters(getDb());
    server.close(() => process.exit(0));
    server.closeAllConnections?.();
    setTimeout(() => process.exit(0), 2000).unref();
  });
}

// A busy port must be loud. Silently failing to bind is how a caller ends up talking to
// somebody else's instance and drawing confident conclusions from the wrong data.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[hub] port ' + PORT + ' is already in use. Another hub is running — stop it, or set HUB_PORT to a free port.');
  } else {
    console.error('[hub] could not listen on port ' + PORT + ': ' + err.message);
  }
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[hub] Question Hub listening on port ' + PORT + ' (schema v' + SCHEMA_VERSION + ')');
  console.log('[hub] local:   http://localhost:' + PORT);
  for (const address of lanAddresses()) console.log('[hub] network: http://' + address + ':' + PORT);
  console.log('[hub] loaded ' + db.questions.length + ' question(s) from ' + DB_PATH);
});
