/**
 * The dev server's life and death, for `e2e/run-walkthrough.mjs`.
 *
 * Purpose
 *   "Re-runnable a hundred times without manual cleanup" is a claim about teardown, and
 *   teardown is where unattended loops actually rot. Expo spawns Metro through `pnpm` and
 *   `mise`, so the pid this process holds is two links up a chain from the thing listening
 *   on the port. Killing that pid is not the same as freeing the port, and a leaked Metro
 *   is invisible — the next run finds a server answering, reuses it, and quietly tests a
 *   build from an hour ago.
 *
 *   This module therefore does not kill and hope. It kills the tree, then **polls until the
 *   port stops answering**, and if something is still holding it, kills the listener by
 *   port and checks again. Teardown either succeeds or says out loud that it did not.
 *
 * Why plain `.mjs`
 *   The runner must be able to start, and to clean up after, a Playwright run that never
 *   compiled — so it cannot depend on Playwright's TypeScript loader.
 *
 * Dependencies
 *   Node standard library only.
 */

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** How often the readiness and shutdown polls ask again. Never a sleep-and-hope. */
const POLL_INTERVAL_MS = 750;

/** How long one poll request may hang before it is abandoned and retried. */
const POLL_REQUEST_TIMEOUT_MS = 3_000;

/** How long to wait for a killed server to actually let go of its port. */
const SHUTDOWN_TIMEOUT_MS = 20_000;

/**
 * Ask a URL for a real response.
 *
 * @param {string} url The URL to probe.
 * @returns {Promise<boolean>} True when the server answered with any HTTP status.
 */
export async function respondsToHttp(url) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), POLL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: abort.signal, redirect: 'manual' });
    return response.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Poll a URL until it answers, or give up.
 *
 * @param {string} url The URL to wait for.
 * @param {number} timeoutMs How long to keep asking.
 * @param {() => boolean} stillStarting Returns false if the server process has died, so a
 *   crashed server fails in a second rather than after the full timeout.
 * @returns {Promise<boolean>} True when the server answered in time.
 */
export async function waitForHttp(url, timeoutMs, stillStarting) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!stillStarting()) return false;
    if (await respondsToHttp(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Poll a URL until it stops answering.
 *
 * @param {string} url The URL that should go quiet.
 * @param {number} timeoutMs How long to keep asking.
 * @returns {Promise<boolean>} True once nothing answers.
 */
async function waitForSilence(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await respondsToHttp(url))) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  return false;
}

/**
 * Start the Expo web build, logging its output into the run directory.
 *
 * `shell: true` is required on Windows, where `pnpm` is a `.cmd` shim.
 *
 * @param {string} runDir Where to write `web-server.log`.
 * @returns {Promise<import('node:child_process').ChildProcess>} The spawned process.
 */
export async function startWebServer(runDir) {
  await mkdir(runDir, { recursive: true });
  const log = createWriteStream(join(runDir, 'web-server.log'), { flags: 'a' });
  const child = spawn('pnpm', ['--filter', '@atlas/mobile', 'run', 'web'], {
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', BROWSER: 'none' },
  });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

/**
 * Run a command to completion, ignoring its output.
 *
 * @param {string} command The executable.
 * @param {string[]} args Its arguments.
 * @returns {Promise<string>} Everything it wrote to stdout.
 */
function run(command, args) {
  return new Promise((resolve) => {
    let out = '';
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    child.stdout?.on('data', (chunk) => (out += String(chunk)));
    child.on('close', () => resolve(out));
    child.on('error', () => resolve(''));
  });
}

/**
 * Kill a process and everything it started.
 *
 * @param {number | undefined} pid The process id to kill, with its tree.
 * @returns {Promise<void>} Resolves once the kill has been issued.
 */
export async function stopProcessTree(pid) {
  if (pid === undefined) return;
  if (process.platform === 'win32') {
    await run('taskkill', ['/pid', String(pid), '/T', '/F']);
    return;
  }
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Already gone, which is the outcome we wanted.
    }
  }
}

/**
 * Find the process listening on a TCP port.
 *
 * @param {number} port The port to look up.
 * @returns {Promise<number | undefined>} The listener's pid, if one can be found.
 */
async function listenerPid(port) {
  if (process.platform !== 'win32') {
    const out = await run('lsof', ['-ti', `tcp:${String(port)}`]);
    const first = out.split('\n')[0]?.trim();
    return first === undefined || first === '' ? undefined : Number(first);
  }
  const out = await run('netstat', ['-ano']);
  for (const line of out.split('\n')) {
    if (!line.includes(`:${String(port)}`) || !line.includes('LISTENING')) continue;
    const pid = Number(line.trim().split(/\s+/).at(-1));
    if (Number.isInteger(pid) && pid > 0) return pid;
  }
  return undefined;
}

/**
 * Stop a server this runner started, and prove the port is free.
 *
 * Three escalating steps, because each one alone has been observed to fail: kill the tree,
 * wait for the port to go quiet, and — only if it does not — kill whatever still holds it.
 * Killing by port is safe here precisely because it is reached only for a server we
 * started and have already tried to stop.
 *
 * @param {import('node:child_process').ChildProcess} child The server we own.
 * @param {string} url Its base URL.
 * @returns {Promise<string | undefined>} A warning to print, or `undefined` on success.
 */
export async function stopOwnedServer(child, url) {
  await stopProcessTree(child.pid);
  if (await waitForSilence(url, SHUTDOWN_TIMEOUT_MS)) return undefined;

  const port = Number(new URL(url).port === '' ? '80' : new URL(url).port);
  const stubborn = await listenerPid(port);
  if (stubborn === undefined) {
    return `warning: ${url} still answers but no listener could be identified on port ${String(port)}.`;
  }
  await stopProcessTree(stubborn);
  if (await waitForSilence(url, SHUTDOWN_TIMEOUT_MS)) return undefined;
  return (
    `warning: could not free ${url}. Process ${String(stubborn)} is still listening; ` +
    'the next run will reuse it and test a stale bundle.'
  );
}
