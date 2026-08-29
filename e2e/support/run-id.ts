/**
 * The identity of one walkthrough run, and where its evidence is written.
 *
 * Purpose
 *   Every walkthrough writes a screenshot per step into `docs/qa/walkthroughs/<run>/`
 *   (CLAUDE.md, "The walkthrough loop"). All three viewport projects and all Playwright
 *   workers must agree on that one directory, or a run's evidence scatters across half a
 *   dozen folders and nobody can flip through it.
 *
 * How the id is shared across processes
 *   Playwright spawns each worker as a child process, so a worker inherits the environment
 *   of the main process. `playwright.config.ts` imports this module first, which stamps
 *   `ATLAS_WALKTHROUGH_RUN` before any worker exists; the worker re-imports this module,
 *   finds the variable already set, and reuses it. `e2e/run-walkthrough.mjs` sets the same
 *   variable ahead of Playwright when it wants to name the run itself.
 *
 *   Do NOT replace the environment variable with a module-level constant. Module state is
 *   per-process; the workers would each mint their own timestamp.
 *
 * Dependencies
 *   Node's `path` and `url` only. No Playwright import — the runner script (plain `.mjs`)
 *   must be able to reason about the same paths without loading the test framework.
 */

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the repository root, derived from this file's own location. */
export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where every run's evidence lives, one subdirectory per run. */
export const WALKTHROUGH_ROOT = join(REPO_ROOT, 'docs', 'qa', 'walkthroughs');

/** The environment variable that carries the run id from the main process to the workers. */
export const RUN_ID_ENV_VAR = 'ATLAS_WALKTHROUGH_RUN';

/**
 * Mint a filesystem-safe, sortable run id from the current clock.
 *
 * @returns An id of the form `2026-08-29T05-59-12-431Z`, which sorts chronologically.
 */
function mintRunId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * The id of the run in progress, minted once per process tree.
 *
 * @returns The shared run id.
 */
function resolveRunId(): string {
  const inherited = process.env[RUN_ID_ENV_VAR];
  if (inherited !== undefined && inherited.trim() !== '') return inherited;

  const minted = mintRunId();
  process.env[RUN_ID_ENV_VAR] = minted;
  return minted;
}

/** The id of the run in progress. Identical in the main process and in every worker. */
export const WALKTHROUGH_RUN_ID = resolveRunId();

/** Absolute path of this run's evidence directory. */
export const WALKTHROUGH_RUN_DIR = join(WALKTHROUGH_ROOT, WALKTHROUGH_RUN_ID);
