/**
 * Local mock of `POST /chat/stream`. Development tool — never imported by app code.
 *
 * Purpose
 *   Lets the streaming client be proven end-to-end over a real HTTP socket without the
 *   FastAPI server, without a database, and above all without spending a cent at
 *   OpenRouter. It emits exactly the wire format documented in
 *   `docs/architecture/flutter-port-map.md` §5, endpoint 3, and reproduced from
 *   `server/app/routers/chat.py:141-162`.
 *
 * Key responsibilities
 *   - Serve `POST /chat/stream` as `text/event-stream`.
 *   - Emit the `meta` frame before any token, as the real server does.
 *   - Write each frame in *deliberately hostile* pieces: a `data:` line is flushed in two
 *     TCP writes, and a multi-byte character is split across a write boundary. A client
 *     that only works against tidy frames fails here, which is the point.
 *
 * Modes, chosen by the path prefix, so a client that only knows how to append
 * `/chat/stream` to a base URL can still reach all three
 *   - `POST /chat/stream`        — meta, tokens, `[DONE]`.
 *   - `POST /error/chat/stream`  — meta, tokens, an `error` frame, `[DONE]`.
 *   - `POST /silent/chat/stream` — headers only, then nothing. Exercises the idle timeout.
 *   - `POST /burst/chat/stream`  — {@link BURST_TOKEN_COUNT} tokens with no delay between
 *     them, the way a fast model actually streams. Exercises the per-frame commit throttle.
 *
 * Usage
 *   ```
 *   node apps/mobile/src/api/stream/mock-sse-server.mjs --port 8791
 *   ```
 *   Prints the listening URL on stdout and streams one reply per request. Stop with
 *   Ctrl-C, or by killing the process.
 */

/*
 * This file runs under Node, not under React Native. The workspace ESLint config only
 * grants Node globals to `tools/**`, and that config is owned by another agent, so the
 * globals are declared here instead of widening the shared rules for one dev-only script.
 */
/* global Buffer, process, setTimeout */

import { createServer } from 'node:http';

/** The reply the mock streams, one array entry per SSE `delta` frame. */
const TOKENS = ['Ruth ', 'is ', "David's ", 'great-grandmother ', '— ', 'see ', 'Ruth 4:17 ', '🕊'];

/** The tool-use frame, emitted before the model would have been called. */
const META = { rag: true, web: false, sources: ['Study notes — Ruth 4'] };

/** Milliseconds between tokens. Fast enough to keep the harness quick, slow enough to be real. */
const TOKEN_INTERVAL_MS = 12;

/** Default port. Chosen high and unusual so it does not collide with Expo or FastAPI. */
const DEFAULT_PORT = 8791;

/** Bytes from the end of a frame at which the two TCP writes are split. */
const MULTIBYTE_SPLIT_OFFSET = 6;

/** How many tokens the burst mode emits back to back. */
const BURST_TOKEN_COUNT = 400;

/** Read `--port` from argv. */
function resolvePort(argv) {
  const at = argv.indexOf('--port');
  if (at === -1) return DEFAULT_PORT;
  const value = Number.parseInt(argv[at + 1] ?? '', 10);
  return Number.isFinite(value) ? value : DEFAULT_PORT;
}

/** Drain and discard the request body, so the socket is not left half-read. */
function readBody(request) {
  return new Promise((resolve) => {
    const parts = [];
    request.on('data', (part) => parts.push(part));
    request.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
  });
}

/** The path suffix every mode shares. */
const STREAM_PATH = '/chat/stream';

/** Which scenario the caller asked for, taken from the path prefix. */
function resolveMode(url) {
  if (!url.endsWith(STREAM_PATH)) return null;
  const prefix = url.slice(0, -STREAM_PATH.length);
  if (prefix === '') return 'normal';
  if (prefix === '/error') return 'error';
  if (prefix === '/silent') return 'silent';
  if (prefix === '/burst') return 'burst';
  return null;
}

/** Sleep. */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Write one SSE frame, split across two TCP writes at a byte offset.
 *
 * Splitting inside the payload is the whole reason this mock exists: it forces the
 * client's parser to carry a partial line, and — for the last token — a partial UTF-8
 * character, across a real socket boundary.
 */
async function writeSplitFrame(response, payload, splitAt) {
  const frame = Buffer.from(`data: ${payload}\n\n`, 'utf8');
  const cut = Math.min(Math.max(splitAt, 1), frame.length - 1);
  response.write(frame.subarray(0, cut));
  await delay(1);
  response.write(frame.subarray(cut));
}

/** Stream the normal reply. */
async function streamTokens(response, withError) {
  await writeSplitFrame(response, JSON.stringify({ meta: META }), 20);

  for (const token of TOKENS) {
    await delay(TOKEN_INTERVAL_MS);
    // Six bytes from the end lands inside the closing run for an ASCII token, and *inside
    // the character itself* for the em dash and the dove emoji — the boundary that breaks
    // a naive parser.
    const payload = JSON.stringify({ delta: token });
    const frameLength = Buffer.byteLength(`data: ${payload}\n\n`, 'utf8');
    await writeSplitFrame(response, payload, frameLength - MULTIBYTE_SPLIT_OFFSET);
  }

  if (withError) {
    await delay(TOKEN_INTERVAL_MS);
    response.write(`data: ${JSON.stringify({ error: 'mock upstream refused' })}\n\n`);
  }

  await delay(TOKEN_INTERVAL_MS);
  response.write('data: [DONE]\n\n');
  response.end();
}

/**
 * Stream many tokens as fast as the socket accepts them.
 *
 * A real model on a fast provider emits far more deltas per second than the display can
 * paint. This mode reproduces that so the client's per-frame commit throttle is exercised
 * against a genuine firehose rather than a simulated one.
 */
function streamBurst(response) {
  response.write(`data: ${JSON.stringify({ meta: META })}\n\n`);
  for (let index = 0; index < BURST_TOKEN_COUNT; index += 1) {
    const delta = `${String(index)} `;
    response.write(`data: ${JSON.stringify({ delta })}\n\n`);
  }
  response.write('data: [DONE]\n\n');
  response.end();
}

/**
 * Permissive CORS, mirroring `server/app/main.py:31` in the Flutter prototype's backend.
 *
 * Without it the Expo *web* build cannot reach this mock at all, which would leave the
 * browser half of the spike unprovable.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Handle one request. */
async function handle(request, response) {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, CORS_HEADERS);
    response.end();
    return;
  }

  const mode = request.method === 'POST' ? resolveMode(request.url ?? '') : null;
  if (mode === null) {
    response.writeHead(404, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    response.end(JSON.stringify({ detail: 'Not found' }));
    return;
  }

  await readBody(request);

  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
    ...CORS_HEADERS,
  });

  if (mode === 'silent') return;
  if (mode === 'burst') {
    streamBurst(response);
    return;
  }
  await streamTokens(response, mode === 'error');
}

const port = resolvePort(process.argv);
const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    process.stderr.write(`mock-sse-server: ${String(error)}\n`);
    response.end();
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`mock-sse-server listening on http://127.0.0.1:${port}/chat/stream\n`);
});
