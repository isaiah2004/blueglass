/**
 * Scans the remote for testing branches that are waiting on a result.
 *
 * The contract is in docs/testing/TESTING-BRANCH-PROTOCOL.md: a collaborator who cannot run
 * Docker pushes `test/<slug>` carrying `.testing/request.md`; this machine runs it and pushes
 * results back. This module answers one question — which branches need attention right now.
 *
 * A branch is "waiting" when its tip commit has no result recorded against it. That is the
 * whole staleness rule: results name the commit they tested, so pushing again always earns a
 * fresh run and a run can never be silently attributed to the wrong code.
 *
 * Read-only. It fetches and inspects; it never checks out, commits, or pushes.
 *
 * Usage:
 *   node tools/test-runner/scan.mjs           # human-readable
 *   node tools/test-runner/scan.mjs --json    # machine-readable
 *   node tools/test-runner/scan.mjs --quiet   # print only when something is waiting
 */
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const BRANCH_PREFIX = 'test/';
const REQUEST_PATH = '.testing/request.md';
const RESULTS_DIR = '.testing/results';

const flags = new Set(process.argv.slice(2));

/**
 * Runs a git command and returns trimmed stdout.
 *
 * @param args - Arguments after `git`.
 * @param allowFail - Return '' instead of throwing when git exits non-zero.
 * @returns Trimmed stdout, or '' when the command failed and failure was allowed.
 */
function git(args, allowFail = false) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw new Error('git ' + args.join(' ') + ' failed: ' + (err.stderr ?? err.message));
  }
}

/**
 * Parses the `---` header block of a request file.
 *
 * Deliberately lenient: a collaborator hand-writing this under time pressure should not have
 * a run refused over spacing. Only `id` and `title` are required, and their absence is
 * reported as a parse failure the runner turns into a BLOCKED result rather than silence.
 *
 * @param source - Full text of `.testing/request.md`.
 * @returns The header fields plus the remaining body, or an error describing what is wrong.
 */
export function parseRequest(source) {
  if (typeof source !== 'string' || source.trim() === '') {
    return { ok: false, error: 'request.md is empty' };
  }

  const match = /^\s*---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(source);
  if (!match) {
    return { ok: false, error: 'no `---` header block found at the top of request.md' };
  }

  const [, rawHeader, body] = match;
  const header = {};
  for (const line of rawHeader.split(/\r?\n/)) {
    if (line.trim() === '' || line.trimStart().startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 0) continue;
    header[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }

  const missing = ['id', 'title'].filter((field) => !header[field]);
  if (missing.length > 0) {
    return { ok: false, error: 'header is missing required field(s): ' + missing.join(', ') };
  }

  return {
    ok: true,
    request: {
      id: header.id,
      title: header.title,
      priority: ['high', 'normal', 'low'].includes(header.priority) ? header.priority : 'normal',
      needs: (header.needs ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      body: (body ?? '').trim(),
    },
  };
}

/** Reads a file at a ref without checking anything out. */
function fileAtRef(ref, path) {
  return git(['show', ref + ':' + path], true);
}

/**
 * Highest result number already recorded on a branch, and whether the tip was tested.
 *
 * @param ref - The remote ref to inspect.
 * @param tip - Tip commit sha of that ref.
 * @returns Result count, and whether a result already names the tip commit.
 */
function resultState(ref, tip) {
  const listing = git(['ls-tree', '--name-only', ref, RESULTS_DIR + '/'], true);
  const files = listing.split(/\r?\n/).filter((f) => f.endsWith('.md'));

  let testedTip = false;
  for (const file of files) {
    const body = fileAtRef(ref, file);
    // Results record the sha they tested; a prefix match is enough and tolerates short shas.
    if (body && (body.includes(tip) || body.includes(tip.slice(0, 7)))) {
      testedTip = true;
      break;
    }
  }
  return { count: files.length, testedTip };
}

/**
 * Finds every testing branch and works out which are waiting on a run.
 *
 * @returns One entry per `test/*` branch, newest activity first, waiting ones ranked first.
 */
export function scanBranches() {
  git(['fetch', '--prune', 'origin'], true);

  const raw = git(['for-each-ref', '--format=%(refname:short)%09%(objectname)%09%(committerdate:iso8601)', 'refs/remotes/origin/' + BRANCH_PREFIX], true);
  if (raw === '') return [];

  const branches = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const [ref, tip, committed] = line.split('\t');
    const branch = ref.replace(/^origin\//, '');

    const source = fileAtRef(ref, REQUEST_PATH);
    if (source === '') {
      branches.push({
        branch, ref, tip, committed,
        status: 'invalid',
        reason: 'no ' + REQUEST_PATH + ' on this branch',
        request: null,
        results: 0,
      });
      continue;
    }

    const parsed = parseRequest(source);
    if (!parsed.ok) {
      branches.push({
        branch, ref, tip, committed,
        status: 'invalid',
        reason: parsed.error,
        request: null,
        results: 0,
      });
      continue;
    }

    const { count, testedTip } = resultState(ref, tip);
    branches.push({
      branch, ref, tip, committed,
      status: testedTip ? 'done' : 'waiting',
      reason: null,
      request: parsed.request,
      results: count,
    });
  }

  const rank = { high: 0, normal: 1, low: 2 };
  return branches.sort((a, b) => {
    const waiting = Number(b.status === 'waiting') - Number(a.status === 'waiting');
    if (waiting !== 0) return waiting;
    const priority = (rank[a.request?.priority] ?? 1) - (rank[b.request?.priority] ?? 1);
    if (priority !== 0) return priority;
    return String(b.committed).localeCompare(String(a.committed));
  });
}

// ── CLI ────────────────────────────────────────────────────────────────────
// `pathToFileURL` rather than string-building the URL: on Windows the drive letter and the
// separators do not survive a naive comparison, so the guard silently never fired and the
// CLI printed nothing at all.
const invokedDirectly = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;

if (invokedDirectly) {
  const branches = scanBranches();
  const waiting = branches.filter((b) => b.status === 'waiting');
  const invalid = branches.filter((b) => b.status === 'invalid');

  if (flags.has('--json')) {
    console.log(JSON.stringify({ branches, waiting: waiting.length }, null, 2));
  } else if (branches.length === 0) {
    if (!flags.has('--quiet')) console.log('[scan] no test/* branches on the remote');
  } else if (waiting.length === 0 && invalid.length === 0 && flags.has('--quiet')) {
    // Nothing to say.
  } else {
    console.log('[scan] ' + branches.length + ' testing branch(es), ' + waiting.length + ' waiting');
    for (const b of branches) {
      const mark = b.status === 'waiting' ? 'WAITING' : b.status === 'invalid' ? 'INVALID' : 'done   ';
      console.log('  ' + mark + '  ' + b.branch + '  @' + b.tip.slice(0, 7) +
        (b.request ? '  [' + b.request.priority + '] ' + b.request.title : '  — ' + b.reason));
    }
  }

  // Exit 10 signals "work is waiting" so a monitor can act without parsing stdout.
  process.exitCode = waiting.length > 0 ? 10 : 0;
}
