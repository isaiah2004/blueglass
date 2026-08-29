#!/usr/bin/env node
/**
 * The walkthrough runner — one command, re-runnable forever.
 *
 * Purpose
 *   CLAUDE.md's definition of done is a clean walkthrough of the real UI, run continuously
 *   and unattended (`Q-04`). That only works if starting the app, waiting for it, driving
 *   it, and cleaning up afterwards are a single command that leaves nothing behind. This
 *   script is that command.
 *
 * What it guarantees
 *   1. It waits for a real HTTP response from the web build — never a fixed sleep.
 *   2. It only kills a server it started. A dev server you already had running is reused
 *      and left running, so the loop never steals your terminal out from under you.
 *   3. It tears the server tree down on success, on failure, and on Ctrl-C. Expo spawns
 *      Metro which spawns workers, so the whole tree goes, not just the pid we hold.
 *   4. It writes `RESULTS.md` beside the screenshots and prunes ancient runs, so the
 *      hundredth run is as tidy as the first.
 *
 * Usage
 *   ```bash
 *   pnpm walkthrough                       # every chapter, all three viewports
 *   pnpm walkthrough --project=phone       # one viewport
 *   pnpm walkthrough -g "translation"      # one chapter, by title
 *   ```
 *   Any further arguments are passed straight through to `playwright test`.
 *
 * Environment
 *   `ATLAS_WEB_BASE_URL`   where the web build is served (default `http://localhost:8081`)
 *   `ATLAS_WALKTHROUGH_RUN` name the run yourself instead of using a timestamp
 *   `ATLAS_KEEP_RUNS`      how many run folders to retain (default 4; a run is roughly 5 MB)
 */

import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  respondsToHttp,
  startWebServer,
  stopOwnedServer,
  stopProcessTree,
  waitForHttp,
} from './support/runner-server.mjs';
import { pruneOldRuns, writeResultsSummary } from './support/runner-utils.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WALKTHROUGH_ROOT = join(REPO_ROOT, 'docs', 'qa', 'walkthroughs');
const BASE_URL = process.env.ATLAS_WEB_BASE_URL ?? 'http://localhost:8081';
const SERVER_READY_TIMEOUT_MS = 300_000;
const KEEP_RUNS = Number(process.env.ATLAS_KEEP_RUNS ?? '4');

/**
 * Name this run, and publish the name so Playwright's workers agree with it.
 *
 * @returns {string} The run id.
 */
function resolveRunId() {
  const existing = process.env.ATLAS_WALKTHROUGH_RUN;
  const runId =
    existing !== undefined && existing.trim() !== ''
      ? existing
      : new Date().toISOString().replace(/[:.]/g, '-');
  process.env.ATLAS_WALKTHROUGH_RUN = runId;
  return runId;
}

/**
 * Make sure the web build is serving, starting it if nobody else has.
 *
 * @param {string} runDir Where the server log goes if we start one.
 * @returns {Promise<import('node:child_process').ChildProcess | undefined>} The server we
 *   own, or `undefined` when an existing one was reused.
 * @throws {Error} If a server we started never answered.
 */
async function ensureWebServer(runDir) {
  if (await respondsToHttp(BASE_URL)) {
    process.stdout.write(`> reusing the web build already serving at ${BASE_URL}\n`);
    return undefined;
  }
  process.stdout.write(`> starting the Expo web build; waiting for ${BASE_URL}\n`);
  const server = await startWebServer(runDir);
  let alive = true;
  server.on('exit', () => {
    alive = false;
  });
  const ready = await waitForHttp(BASE_URL, SERVER_READY_TIMEOUT_MS, () => alive);
  if (ready) return server;

  await stopProcessTree(server.pid);
  throw new Error(
    `The Expo web build never answered on ${BASE_URL}. ` +
      `Its output is in ${join(runDir, 'web-server.log')}.`,
  );
}

/**
 * Quote one argument so a shell passes it through whole.
 *
 * `shell: true` concatenates arguments rather than escaping them, so
 * `pnpm walkthrough -g "cold launch|open"` reached `cmd` unquoted and it tried to run
 * `open` as a second command. Anything with whitespace or a shell metacharacter therefore
 * gets quoted here, and embedded quotes are doubled — the escape `cmd` understands.
 *
 * @param {string} argument One argument, as the user typed it.
 * @returns {string} The argument, safe to concatenate into a command line.
 */
function quoteForShell(argument) {
  if (argument !== '' && !/[\s"|&<>^()]/.test(argument)) return argument;
  return `"${argument.replace(/"/g, '""')}"`;
}

/**
 * Run the Playwright suite, inheriting this terminal.
 *
 * @param {string[]} args Extra arguments for `playwright test`.
 * @returns {Promise<number>} Playwright exit code.
 */
function runPlaywright(args) {
  return new Promise((resolveExit) => {
    const child = spawn('pnpm', ['exec', 'playwright', 'test', ...args.map(quoteForShell)], {
      cwd: REPO_ROOT,
      shell: true,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', () => resolveExit(1));
  });
}

/**
 * Drive one full walkthrough, then clean up whatever happened.
 *
 * @returns {Promise<number>} The exit code to leave with.
 */
async function main() {
  const runId = resolveRunId();
  const runDir = join(WALKTHROUGH_ROOT, runId);
  process.stdout.write(`> walkthrough run ${runId}\n> evidence: ${runDir}\n`);

  /** @type {import('node:child_process').ChildProcess | undefined} */
  let ownedServer;
  const teardown = async () => {
    if (ownedServer === undefined) return;
    const server = ownedServer;
    // Cleared before the await, so a second Ctrl-C cannot start a second teardown.
    ownedServer = undefined;
    const warning = await stopOwnedServer(server, BASE_URL);
    if (warning !== undefined) process.stderr.write(`${warning}\n`);
  };
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      void teardown().then(() => process.exit(130));
    });
  }

  let exitCode = 1;
  try {
    ownedServer = await ensureWebServer(runDir);
    exitCode = await runPlaywright(process.argv.slice(2));
  } catch (cause) {
    process.stderr.write(`${cause instanceof Error ? cause.message : String(cause)}\n`);
    exitCode = 1;
  } finally {
    await teardown();
    await writeResultsSummary(runDir, exitCode).catch(() => undefined);
    const pruned = await pruneOldRuns(WALKTHROUGH_ROOT, KEEP_RUNS).catch(() => []);
    if (pruned.length > 0) process.stdout.write(`> pruned ${String(pruned.length)} old run(s)\n`);
    process.stdout.write(`> summary: ${join(runDir, 'RESULTS.md')}\n`);
  }
  return exitCode;
}

process.exitCode = await main();
