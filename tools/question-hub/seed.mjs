/**
 * Seeds the Question Hub from a JSON file of questions.
 *
 * Idempotent: re-running updates the wording of existing ids without
 * discarding answers already given, so the questionnaire can be revised
 * mid-flight without the human losing work.
 *
 * Usage: node tools/question-hub/seed.mjs [path-to-questions.json]
 */
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HUB = process.env.HUB_URL ?? 'http://localhost:7777';
const source = process.argv[2]
  ? resolve(process.argv[2])
  : join(HERE, 'seed', 'questionnaire.json');

const questions = JSON.parse(await readFile(source, 'utf8'));

let ok = 0;
const failures = [];

for (const question of questions) {
  const res = await fetch(HUB + '/api/ask', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(question),
  });
  if (res.ok) {
    ok += 1;
  } else {
    failures.push({ id: question.id, status: res.status, body: await res.text() });
  }
}

console.log('[seed] posted ' + ok + '/' + questions.length + ' question(s) to ' + HUB);
for (const f of failures) console.error('[seed] FAILED ' + f.id + ' (' + f.status + '): ' + f.body);
if (failures.length > 0) process.exitCode = 1;
