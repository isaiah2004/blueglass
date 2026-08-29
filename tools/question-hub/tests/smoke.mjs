/**
 * The one command that proves the Question Hub still works.
 *
 *   node tools/question-hub/tests/smoke.mjs
 *
 * Boots disposable servers on 7788+ against temp directories, runs every layer of the
 * suite, and exits non-zero on anything. The instance on 7777 is never touched.
 *
 * The first and last steps are the ones that matter most: every answer in the live file is
 * recorded before the run and compared after it. A changed or missing answer fails the run
 * even if every test passed, because a suite that quietly rewrote the human's answers would
 * otherwise look exactly like a suite that did not. New questions arriving from the live
 * fleet mid-run are expected and are not a failure.
 *
 * Flags:
 *   --no-e2e          skip Playwright (units and API only — useful with no browser)
 *   --migration-gate  also run the full §4.6 gate against the live file's backup
 */
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveAnswerCensus, answerCensusDiff } from './helpers/hub-server.mjs';

const TESTS_DIR = dirname(fileURLToPath(import.meta.url));
const HUB_DIR = join(TESTS_DIR, '..');
const REPO_ROOT = join(HUB_DIR, '..', '..');
const flags = new Set(process.argv.slice(2));

const log = (line = '') => process.stdout.write(line + '\n');
const rule = () => log('─'.repeat(72));

/** Run a command, streaming its output, and resolve with the exit code. */
function run(label, args, opts = {}) {
  return new Promise((resolve) => {
    log();
    rule();
    log('▸ ' + label);
    rule();
    const child = spawn(process.execPath, args, { cwd: HUB_DIR, stdio: 'inherit', ...opts });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

/** Every .mjs and .js the hub owns, so a syntax error is found before a server needs it. */
function hubSources(dir = HUB_DIR, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['data', 'node_modules', '.artifacts', 'media'].includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) hubSources(full, out);
    else if (/\.(mjs|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * R-2: the server must never fail to start because of a package install.
 * Anything under lib/ or the CLIs importing a bare specifier would break that promise,
 * and it would only show up as a dead page on someone's phone.
 */
async function checkNoDependencies() {
  log();
  rule();
  log('▸ zero-dependency check (node:* imports only)');
  rule();
  const { readFile } = await import('node:fs/promises');
  // The rule covers everything the running server loads and every CLI an agent invokes.
  // Test tooling is exempt: playwright.config.mjs must import @playwright/test, and no
  // agent or server ever loads it.
  const exempt = [join(HUB_DIR, 'public'), TESTS_DIR, join(HUB_DIR, 'playwright.config.mjs')];
  const serverSide = hubSources().filter((f) => !exempt.some((prefix) => f.startsWith(prefix)));
  const offenders = [];

  for (const file of serverSide) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/^\s*import\s[^'"]*from\s+['"]([^'"]+)['"]/gm)) {
      const specifier = match[1];
      const isLocal = specifier.startsWith('.') || specifier.startsWith('/');
      if (!isLocal && !specifier.startsWith('node:')) {
        offenders.push(relative(REPO_ROOT, file) + ' imports "' + specifier + '"');
      }
    }
  }

  if (offenders.length === 0) {
    log('  ok — ' + serverSide.length + ' server-side files import nothing but node:*');
    return 0;
  }
  for (const line of offenders) log('  FAIL ' + line);
  return 1;
}

async function checkSyntax() {
  const files = hubSources();
  const code = await run('syntax check (' + files.length + ' files)',
    ['--check', ...files.slice(0, 1)], { stdio: 'ignore' });
  if (code !== 0) return code;

  for (const file of files) {
    const result = await new Promise((resolve) => {
      spawn(process.execPath, ['--check', file], { stdio: 'inherit' }).on('exit', (c) => resolve(c ?? 1));
    });
    if (result !== 0) {
      log('  FAIL ' + relative(REPO_ROOT, file) + ' does not parse');
      return 1;
    }
  }
  log('  ok — every hub source parses');
  return 0;
}

const testFiles = (dir) => readdirSync(dir)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join(dir, f));

async function main() {
  const before = liveAnswerCensus();
  log('Question Hub — full test gate');
  log('live answers file: ' + (before.missing ? '(absent)' :
    before.questions + ' questions, ' + Object.keys(before.answers).length + ' answers, ' + before.size + ' bytes'));
  log('test servers use ports 7788+ and temp directories; 7777 is not touched.');

  const steps = [];
  steps.push(['syntax', await checkSyntax()]);
  steps.push(['zero-dependency', await checkNoDependencies()]);
  steps.push(['unit tests', await run('node:test — units', ['--test', ...testFiles(TESTS_DIR)])]);
  steps.push(['api tests', await run('node:test — API integration', ['--test', ...testFiles(join(TESTS_DIR, 'api'))])]);

  if (!flags.has('--no-e2e')) {
    steps.push(['playwright', await runPlaywright()]);
  }
  if (flags.has('--migration-gate')) {
    steps.push(['migration gate', await run('verify-migration --backup --report',
      [join(HUB_DIR, 'verify-migration.mjs'), '--backup', '--report'])]);
  }

  steps.push(['live answers intact', checkLiveUnchanged(before)]);
  return report(steps);
}

/** Playwright is resolved from the repo root's node_modules; the hub adds no dependency. */
function runPlaywright() {
  return new Promise((resolve) => {
    const cli = join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
    log();
    rule();
    log('▸ Playwright — UI walkthroughs');
    rule();
    try {
      statSync(cli);
    } catch {
      log('  SKIP — @playwright/test is not installed at the repo root');
      return resolve(0);
    }
    spawn(process.execPath, [cli, 'test', '--config', join(HUB_DIR, 'playwright.config.mjs')],
      { cwd: HUB_DIR, stdio: 'inherit' }).on('exit', (code) => resolve(code ?? 1));
  });
}

/**
 * The assertion the whole suite is built around. If this fails, something in the tests
 * rewrote the human's answers, and that is a stop-everything result regardless of the
 * other columns.
 *
 * New questions and new answers appearing mid-run are expected — the hub on 7777 is live
 * and the fleet keeps using it while the tests run. Only losing or altering an EXISTING
 * answer is a failure.
 */
function checkLiveUnchanged(before) {
  const after = liveAnswerCensus();
  log();
  rule();
  log('▸ the human’s answers, after the run');
  rule();
  if (before.missing && after.missing) {
    log('  ok — no live data file on this machine; nothing could be touched');
    return 0;
  }

  const problems = answerCensusDiff(before, after);
  if (problems.length === 0) {
    const grew = after.questions - before.questions;
    log('  ok — all ' + Object.keys(before.answers).length + ' answers intact, byte-for-byte' +
      (grew > 0 ? ' (the live fleet asked ' + grew + ' new question(s) meanwhile, which is fine)' : ''));
    return 0;
  }
  log('  FAIL — THE HUMAN’S ANSWERS CHANGED DURING THE TEST RUN:');
  for (const problem of problems) log('    ' + problem);
  log('    Stop and restore from data/questions.backup-* before doing anything else.');
  return 1;
}

function report(steps) {
  log();
  rule();
  for (const [name, code] of steps) {
    log('  ' + (code === 0 ? 'PASS' : 'FAIL') + '  ' + name);
  }
  rule();
  const failed = steps.filter(([, code]) => code !== 0);
  log(failed.length === 0 ? 'SMOKE PASSED' : 'SMOKE FAILED — ' + failed.map(([n]) => n).join(', '));
  return failed.length === 0 ? 0 : 1;
}

process.exit(await main());
