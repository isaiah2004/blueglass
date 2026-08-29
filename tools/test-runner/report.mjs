/**
 * Writes a test result onto a collaborator's testing branch and pushes it.
 *
 * The counterpart to `scan.mjs`. Given a verdict and findings, it produces the result file,
 * refreshes `.testing/STATUS.md`, commits, and pushes — **additively, always**.
 *
 * Two safety properties matter more than anything else here, because this tool writes to
 * someone else's branch while they are still working on it:
 *
 *   1. **Never force-push, rebase, or amend.** Results are new commits on top of whatever
 *      they have. If they pushed while a run was in flight, this rebases nothing — it
 *      fetches, replays onto the new tip, and pushes. Their work cannot be lost.
 *   2. **Never touch their source.** Only paths under `.testing/` are staged. A run that
 *      dirtied the working tree (a build artefact, a migration) cannot leak into their branch.
 *
 * Usage:
 *   node tools/test-runner/report.mjs result.json
 *   cat result.json | node tools/test-runner/report.mjs --stdin
 *
 * Input shape:
 *   {
 *     "branch": "test/lineage-sheet",
 *     "commit": "a1b2c3d...",            // the sha actually tested
 *     "id": "lineage-sheet-render",
 *     "title": "Does the Lineage sheet render?",
 *     "verdict": "PASS" | "NEEDS WORK" | "BLOCKED" | "INFO",
 *     "summary": "one short paragraph",
 *     "checks": [{ "asked": "...", "result": "pass"|"fail"|"warn"|"skip", "detail": "..." }],
 *     "commands": [{ "command": "pnpm typecheck", "exitCode": 0, "output": "..." }],
 *     "fixFirst": ["ranked, with file and line"],
 *     "screenshots": ["/abs/path/one.png"]
 *   }
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const RESULTS_DIR = '.testing/results';
const STATUS_PATH = '.testing/STATUS.md';
const VERDICTS = ['PASS', 'NEEDS WORK', 'BLOCKED', 'INFO'];
const MARK = { pass: '✅', fail: '❌', warn: '⚠️', skip: '⏭️' };
const MAX_OUTPUT_CHARS = 4000;

function git(args, allowFail = false) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw new Error('git ' + args.join(' ') + ' failed: ' + (err.stderr ?? err.message));
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function assertValid(input) {
  for (const field of ['branch', 'commit', 'id', 'verdict', 'summary']) {
    if (!input[field]) throw new Error('missing required field: ' + field);
  }
  if (!input.branch.startsWith('test/')) {
    throw new Error('refusing to write to "' + input.branch + '" — only test/* branches are in scope');
  }
  if (!VERDICTS.includes(input.verdict)) {
    throw new Error('verdict must be one of: ' + VERDICTS.join(', '));
  }
}

/** Truncates command output from the middle, so both the start and the failure survive. */
function trimOutput(text) {
  const body = String(text ?? '').trim();
  if (body.length <= MAX_OUTPUT_CHARS) return body;
  const half = Math.floor(MAX_OUTPUT_CHARS / 2);
  return body.slice(0, half) + '\n\n… [' + (body.length - MAX_OUTPUT_CHARS) + ' chars omitted] …\n\n' + body.slice(-half);
}

function nextSequence() {
  const listing = git(['ls-tree', '--name-only', 'HEAD', RESULTS_DIR + '/'], true);
  const numbers = listing
    .split(/\r?\n/)
    .map((f) => /(\d{3})-/.exec(basename(f)))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  return String((numbers.length > 0 ? Math.max(...numbers) : 0) + 1).padStart(3, '0');
}

function renderResult(input, seq, shotNames) {
  const when = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const checks = input.checks ?? [];
  const passed = checks.filter((c) => c.result === 'pass').length;

  const lines = [
    '# Result ' + seq + ' · ' + input.id,
    '',
    '**Verdict: ' + input.verdict + '**' +
      (checks.length > 0 ? ' — ' + passed + ' of ' + checks.length + ' checks passed.' : ''),
    'Ran against commit `' + input.commit + '` on ' + when + '.',
    '',
  ];

  if (input.title) lines.push('> ' + input.title, '');

  lines.push('## Summary', '', input.summary, '');

  if (checks.length > 0) {
    lines.push('## Your checks', '', '| # | What you asked | Result |', '|---|---|---|');
    checks.forEach((c, i) => {
      const detail = c.detail ? ' — ' + String(c.detail).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ') : '';
      lines.push('| ' + (i + 1) + ' | ' + String(c.asked).replace(/\|/g, '\\|') + ' | ' +
        (MARK[c.result] ?? '') + ' ' + (c.result ?? '') + detail + ' |');
    });
    lines.push('');
  }

  if (input.commands?.length > 0) {
    lines.push('## What I ran', '');
    for (const cmd of input.commands) {
      lines.push('### `' + cmd.command + '`', '', 'exit code: `' + cmd.exitCode + '`', '',
        '```', trimOutput(cmd.output), '```', '');
    }
  }

  if (shotNames.length > 0) {
    lines.push('## Screenshots', '');
    for (const name of shotNames) lines.push('![' + name + '](' + seq + '-' + input.id + '/' + name + ')', '');
  }

  if (input.fixFirst?.length > 0) {
    lines.push('## What I would fix first', '');
    input.fixFirst.forEach((item, i) => lines.push((i + 1) + '. ' + item));
    lines.push('');
  }

  lines.push('---', '',
    '_Written by the test machine. Your branch was not rebased, squashed or force-pushed;_',
    '_this is an additive commit and only touches `.testing/`._');

  return lines.join('\n');
}

function renderStatus(input, seq, resultFile) {
  const when = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const checks = input.checks ?? [];
  const failed = checks.filter((c) => c.result === 'fail');

  const lines = [
    '# Testing status — ' + input.branch,
    '',
    '| | |',
    '|---|---|',
    '| **Verdict** | ' + input.verdict + ' |',
    '| Commit tested | `' + input.commit + '` |',
    '| Run | ' + seq + ' |',
    '| When | ' + when + ' |',
    '| Checks passed | ' + checks.filter((c) => c.result === 'pass').length + ' of ' + checks.length + ' |',
    '',
    input.summary,
    '',
  ];

  if (failed.length > 0) {
    lines.push('## Failing', '');
    for (const c of failed) lines.push('- **' + c.asked + '** — ' + (c.detail ?? 'no detail'));
    lines.push('');
  }

  lines.push('Full detail: [`' + resultFile + '`](' + resultFile.replace('.testing/', '') + ')', '',
    'Push again to request a re-run. See `docs/testing/TESTING-BRANCH-PROTOCOL.md`.');
  return lines.join('\n');
}

// ── main ───────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.error('[report] usage: report.mjs <result.json> | --stdin');
  process.exit(1);
}

const raw = arg === '--stdin' ? await readStdin() : await readFile(resolve(arg), 'utf8');
const input = JSON.parse(raw);
assertValid(input);

const startingBranch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
const dirty = git(['status', '--porcelain'], true);
if (dirty !== '') {
  console.error('[report] refusing to run: the working tree is dirty. Commit or stash first,');
  console.error('[report] otherwise unrelated changes could be carried onto someone else\'s branch.');
  process.exit(1);
}

try {
  git(['fetch', 'origin', input.branch]);
  git(['checkout', '-B', input.branch, 'origin/' + input.branch]);

  const seq = nextSequence();
  const slug = seq + '-' + input.id;
  const resultFile = RESULTS_DIR + '/' + slug + '.md';

  await mkdir(RESULTS_DIR, { recursive: true });

  const shotNames = [];
  if (input.screenshots?.length > 0) {
    const shotDir = join(RESULTS_DIR, slug);
    await mkdir(shotDir, { recursive: true });
    for (const src of input.screenshots) {
      if (!existsSync(src)) continue;
      const name = basename(src);
      await copyFile(src, join(shotDir, name));
      shotNames.push(name);
    }
  }

  await writeFile(resultFile, renderResult(input, seq, shotNames) + '\n', 'utf8');
  await writeFile(STATUS_PATH, renderStatus(input, seq, resultFile) + '\n', 'utf8');

  // Only .testing/ — never their source, whatever else the run left behind.
  git(['add', '--', '.testing']);
  if (git(['diff', '--cached', '--name-only'], true) === '') {
    console.log('[report] nothing to write — result already present');
  } else {
    git(['-c', 'user.name=Atlas Test Machine', '-c', 'user.email=noreply@anthropic.com',
      'commit', '-m', 'test(' + input.id + '): ' + input.verdict + ' on ' + input.commit.slice(0, 7),
      '-m', input.summary]);
    git(['push', 'origin', input.branch]);
    console.log('[report] pushed ' + resultFile + ' (' + input.verdict + ') to ' + input.branch);
  }
} finally {
  git(['checkout', startingBranch], true);
}
