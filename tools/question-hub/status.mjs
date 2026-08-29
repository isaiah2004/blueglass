/**
 * Publishes the fleet status board to the Question Hub.
 *
 * The orchestrator replaces the whole board on every update rather than patching
 * rows, so the board can never drift out of sync by accumulating stale entries.
 *
 * Usage:
 *   node tools/question-hub/status.mjs status-board.json
 *   echo '{"headline":"…","entries":[…]}' | node tools/question-hub/status.mjs --stdin
 *
 * Entry shape: { title, state: "done"|"running"|"blocked"|"queued", detail? }
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const HUB = process.env.HUB_URL ?? 'http://localhost:7777';

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const arg = process.argv[2];
if (!arg) {
  console.error('[status] usage: status.mjs <board.json> | --stdin');
  process.exit(1);
}

const raw = arg === '--stdin' ? await readStdin() : await readFile(resolve(arg), 'utf8');

let board;
try {
  board = JSON.parse(raw);
} catch (err) {
  console.error('[status] input is not valid JSON: ' + err.message);
  process.exit(1);
}

const res = await fetch(HUB + '/api/status', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(board),
});

const body = await res.json();
if (!res.ok) {
  console.error('[status] failed (' + res.status + '): ' + body.error);
  process.exit(1);
}
console.log('[status] published ' + body.entries.length + ' entries at ' + body.updatedAt);
