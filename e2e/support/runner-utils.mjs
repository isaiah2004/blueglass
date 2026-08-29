/**
 * Run bookkeeping for `e2e/run-walkthrough.mjs`.
 *
 * Purpose
 *   Turning Playwright's JSON report into the summary that sits beside the screenshots, and
 *   keeping the evidence folder from growing without bound. The dev server's lifecycle lives
 *   next door in `runner-server.mjs`; combined, neither file is worth reading in one sitting.
 *
 * Why plain `.mjs`
 *   The runner must be able to summarise a Playwright run that never compiled, so it cannot
 *   depend on Playwright's TypeScript loader.
 *
 * Dependencies
 *   Node standard library only.
 */

import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Strip terminal colour codes from a reporter message.
 *
 * Playwright colours its own assertion text, and the escape sequences survive into the JSON
 * report. Left in, they turn a Markdown table into line noise.
 *
 * @param {string} text Any reporter string.
 * @returns {string} The same text, plain.
 */
export function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex -- matching the escape codes is the point.
  return text.replace(/\[[0-9;]*m/g, '');
}

/**
 * Flatten Playwright's nested JSON report into one row per test result.
 *
 * @param {unknown} report The parsed `results.json`.
 * @returns {{title: string, file: string, project: string, status: string, error: string}[]} Rows.
 */
export function flattenReport(report) {
  const rows = [];
  const visit = (suite, file) => {
    const suiteFile = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = (test.results ?? []).at(-1) ?? {};
        rows.push({
          title: spec.title ?? '(untitled)',
          file: suiteFile ?? '(unknown file)',
          project: test.projectName ?? '(unknown project)',
          status: last.status ?? 'unknown',
          error: stripAnsi((last.error?.message ?? '').split('\n')[0] ?? '').trim(),
        });
      }
    }
    for (const child of suite.suites ?? []) visit(child, suiteFile);
  };
  for (const suite of report?.suites ?? []) visit(suite, undefined);
  return rows;
}

/**
 * Count the screenshots written under a run directory.
 *
 * @param {string} runDir The run directory.
 * @returns {Promise<number>} How many `.png` files it contains, at any depth.
 */
export async function countScreenshots(runDir) {
  let total = 0;
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) await walk(join(dir, entry.name));
      else if (entry.name.endsWith('.png')) total += 1;
    }
  };
  await walk(runDir).catch(() => undefined);
  return total;
}

/**
 * Bucket failures by what actually went wrong.
 *
 * One missing test id can fail sixty tests. Listed one per row that is sixty rows of the
 * same sentence, and every *other* finding in the run is buried underneath it. Normalising
 * away the viewport name and any measured pixel value collapses those sixty into one line
 * that says "sixty tests, this cause", which is the sentence a human needs.
 *
 * @param {{title: string, file: string, project: string, status: string, error: string}[]} failures Rows.
 * @returns {[string, typeof failures][]} Cause and its rows, commonest cause first.
 */
export function groupFailures(failures) {
  const buckets = new Map();
  for (const row of failures) {
    const cause = row.error
      .replace(/\b\d+x\d+px\b/g, '<n>x<n>px')
      .replace(/\b\d+px\b/g, '<n>px')
      .replace(/\b(phone|tablet|desktop)\b/g, '<viewport>')
      .slice(0, 200);
    buckets.set(cause, [...(buckets.get(cause) ?? []), row]);
  }
  return [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
}

/**
 * Render the grouped failures as Markdown.
 *
 * @param {[string, {title: string, file: string, project: string}[]][]} groups From {@link groupFailures}.
 * @returns {string[]} Lines.
 */
function renderFailureGroups(groups) {
  const lines = ['## Failures, grouped by cause', ''];
  for (const [cause, rows] of groups) {
    const where = [...new Set(rows.map((row) => `${row.file} · ${row.title}`))];
    lines.push(`### ${String(rows.length)} test(s) — ${cause}`, '');
    for (const entry of where.slice(0, 12)) lines.push(`- ${entry}`);
    if (where.length > 12) lines.push(`- …and ${String(where.length - 12)} more`);
    lines.push('');
  }
  return lines;
}

/**
 * Write the human-readable summary that sits beside the screenshots.
 *
 * @param {string} runDir The run directory.
 * @param {number} exitCode Playwright's exit code.
 * @returns {Promise<void>} Resolves once `RESULTS.md` is on disk.
 */
export async function writeResultsSummary(runDir, exitCode) {
  const report = await readFile(join(runDir, 'results.json'), 'utf8')
    .then((raw) => JSON.parse(raw))
    .catch(() => undefined);
  const rows = report === undefined ? [] : flattenReport(report);
  const failures = rows.filter((row) => row.status !== 'passed' && row.status !== 'skipped');
  const skipped = rows.filter((row) => row.status === 'skipped');
  // Skipped is its own column. Counting it as "passed" — `rows.length - failures.length` —
  // reported 58 passed for a run Playwright called 52 passed, 50 failed, 6 skipped, in the
  // one artefact a human actually reads. A summary that inflates the pass count is the one
  // number nobody should have to cross-check.
  const passed = rows.length - failures.length - skipped.length;
  const shots = await countScreenshots(runDir);
  const lines = [
    '# Walkthrough run',
    '',
    `- Finished: ${new Date().toISOString()}`,
    `- Playwright exit code: ${String(exitCode)}`,
    `- Tests: ${String(rows.length)} — ${String(passed)} passed, ${String(failures.length)} failed, ${String(skipped.length)} skipped`,
    `- Screenshots: ${String(shots)}`,
    '',
    ...(failures.length === 0
      ? ['## No failures', '']
      : renderFailureGroups(groupFailures(failures))),
  ];
  await writeFile(join(runDir, 'RESULTS.md'), `${lines.join('\n')}\n`);
}

/**
 * Delete all but the newest few run directories.
 *
 * Screenshots are committed evidence, not build output, so they are pruned rather than
 * ignored — an unbounded folder of PNGs would make the repository unpleasant within a day
 * of running this loop continuously.
 *
 * @param {string} root The `docs/qa/walkthroughs` directory.
 * @param {number} keep How many runs to retain, newest first.
 * @returns {Promise<string[]>} The directory names that were removed.
 */
export async function pruneOldRuns(root, keep) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const runs = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}T/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const doomed = runs.slice(0, Math.max(runs.length - keep, 0));
  for (const name of doomed) await rm(join(root, name), { recursive: true, force: true });
  return doomed;
}
