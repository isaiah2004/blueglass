/**
 * Prove the v1 -> v3 migration is safe *before* it is ever allowed near the real file.
 *
 * The hub's data file holds answers a human already gave. Losing them means asking a
 * person to redo work, so the migration is not trusted on inspection — it is put through
 * the gate in hub-platform.md §4.6 and has to pass every step.
 *
 *   node verify-migration.mjs --backup     step 1  copy + verify by size and SHA-256
 *   node verify-migration.mjs --dry-run    steps 2,3,5  migrate the COPY, identity, idempotence
 *   node verify-migration.mjs --report     steps 2-5  the full gate, incl. old-reader equivalence
 *
 * THIS TOOL NEVER WRITES `data/questions.json`. It reads it once, during --backup, and
 * every later step loads the backup instead. The live server owns that file; an external
 * writer racing it would be silently rolled back on the next answer the human saves.
 */
import { createReadStream } from 'node:fs';
import { readFile, writeFile, copyFile, stat, readdir, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  identityGate,
  idempotenceGate,
  normalisedMatches,
  needsReview,
  countsByKind,
  addedFieldNames,
  answerCensus,
} from './tests/helpers/migration-gates.mjs';
import { oldReaderEquivalence } from './tests/helpers/answers-oracle.mjs';

const HUB_DIR = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HUB_DIR, 'data');
/** Read-only for the entire lifetime of this process. Never opened for writing. */
const LIVE_DB = join(DATA_DIR, 'questions.json');
/**
 * Scratch output goes in `data/working/`, never beside the live log. A file called
 * `questions.migrated-preview.json` sitting next to `questions.json` and the real backups is a
 * wrong-file restore waiting to happen: under pressure it reads as a restore candidate, and
 * copying it back would roll the human's answers to whatever this tool was last trying.
 */
const WORKING_DIR = join(DATA_DIR, 'working');
const PREVIEW = join(WORKING_DIR, 'questions.migrated-preview.json');

const log = (line = '') => process.stdout.write(line + '\n');

/** Stream rather than read: the file is small today, but a hash helper should not care. */
async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

/** Load the pure migrator, and say plainly whose job it is when it is not there yet. */
async function loadMigrate() {
  try {
    const mod = await import('./lib/migrate.mjs');
    if (typeof mod.migrate !== 'function') throw new Error('lib/migrate.mjs exports no migrate()');
    return mod.migrate;
  } catch (err) {
    throw new Error(
      'Cannot load lib/migrate.mjs — the server agent owns it and it is not ready.\n' +
        '  underlying error: ' + err.message,
    );
  }
}

// ── Step 1 · backup ──────────────────────────────────────────────────────────

/**
 * Copy the live file and verify the copy by BOTH byte length and SHA-256.
 *
 * Length alone would miss a corrupted-but-same-size copy; a hash alone would miss a
 * truncation that happens to collide on a short read. Checking both costs nothing here.
 */
async function backup() {
  const raw = await readFile(LIVE_DB, 'utf8');
  const version = JSON.parse(raw).version ?? 'unknown';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = join(DATA_DIR, 'questions.backup-v' + version + '-' + stamp + '.json');

  await copyFile(LIVE_DB, target);

  const [srcStat, dstStat, srcHash, dstHash] = await Promise.all([
    stat(LIVE_DB), stat(target), sha256(LIVE_DB), sha256(target),
  ]);

  log('step 1 · backup');
  log('  source   ' + LIVE_DB);
  log('  copy     ' + target);
  log('  bytes    ' + srcStat.size + ' -> ' + dstStat.size);
  log('  sha256   ' + srcHash);
  log('           ' + dstHash);

  if (srcStat.size !== dstStat.size || srcHash !== dstHash) {
    log('  FAIL     copy does not match the source. Nothing else runs.');
    process.exit(1);
  }
  log('  PASS     copy verified by byte length and SHA-256');
  return target;
}

/** Prefer the newest verified backup; every later step reads that, never the live file. */
async function newestBackup() {
  const files = (await readdir(DATA_DIR))
    .filter((f) => f.startsWith('questions.backup-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error('No backup found. Run --backup first.');
  return join(DATA_DIR, files[files.length - 1]);
}

// ── Steps 2, 3, 5 · dry run on the copy ──────────────────────────────────────

async function dryRun() {
  const migrate = await loadMigrate();
  const source = await newestBackup();
  const before = JSON.parse(await readFile(source, 'utf8'));
  const after = migrate(structuredClone(before));

  await mkdir(WORKING_DIR, { recursive: true });
  await writeFile(PREVIEW, JSON.stringify(after, null, 2), 'utf8');

  log('step 2 · dry run (on the backup, never the live file)');
  log('  input    ' + source);
  log('  preview  ' + PREVIEW);
  log('  version  ' + (before.version ?? 'unset') + ' -> ' + (after.version ?? 'unset'));
  reportCorpus(before, after);
  reportReconciliation(after);

  const identity = reportIdentity(before, after);
  const idempotent = reportIdempotence(migrate, before);
  return { before, after, ok: identity && idempotent };
}

function reportCorpus(before, after) {
  const census = answerCensus(after);
  const wasAnswered = answerCensus(before).answered;
  log('  questions ' + (before.questions ?? []).length + ' -> ' + (after.questions ?? []).length);
  log('  answers   ' + wasAnswered + ' -> ' + census.answered + ' (with text: ' + census.withText + ')');
  log('  by kind   ' + JSON.stringify(countsByKind(after)));
  log('  added     ' + addedFieldNames(before, after).join(', '));
}

/**
 * Print every answer the matcher had to work for. D-01 must appear here: its stored
 * answer carries a curly apostrophe its option does not, because the question was
 * re-asked with re-typed wording after the human answered it.
 */
function reportReconciliation(after) {
  const normalised = normalisedMatches(after);
  const review = needsReview(after);
  log('  normalised matches: ' + normalised.length);
  for (const row of normalised) log('    ~ ' + row.id + ' -> ' + JSON.stringify(row.selected));
  log('  needs review:       ' + review.length);
  for (const row of review) log('    ! ' + row.id + ' other=' + JSON.stringify(row.other));
  if (normalised.length === 0 && review.length === 0) {
    log('    (none — every answer matched an option exactly)');
  }
}

function reportIdentity(before, after) {
  const { ok, failures } = identityGate(before, after);
  log('step 3 · identity gate (the migration may only add)');
  if (ok) {
    log('  PASS     all frozen fields deep-equal across ' + (before.questions ?? []).length + ' questions');
    return true;
  }
  log('  FAIL     ' + failures.length + ' frozen field(s) changed:');
  for (const f of failures.slice(0, 20)) {
    log('    ' + f.id + '.' + f.field + ' — ' + f.reason);
    if ('before' in f) log('      before: ' + JSON.stringify(f.before));
    if ('after' in f) log('      after:  ' + JSON.stringify(f.after));
  }
  return false;
}

function reportIdempotence(migrate, before) {
  const { ok } = idempotenceGate(migrate, before);
  log('step 5 · idempotence');
  log(ok ? '  PASS     migrate(migrate(db)) deep-equals migrate(db)'
         : '  FAIL     a second migration changed the result — a restart would rewrite answers');
  return ok;
}

// ── Step 4 · old-reader equivalence ──────────────────────────────────────────

async function reportEquivalence(before, after) {
  log('step 4 · old-reader equivalence (answers.mjs --json, byte-identical)');
  const result = await oldReaderEquivalence(before, after);
  if (result.ok) {
    log('  PASS     ' + result.before.length + ' bytes identical pre and post');
    return true;
  }
  log('  FAIL     the fleet\'s decision reader can tell the migration happened');
  if (result.firstDifference) {
    log('    first difference at line ' + result.firstDifference.line);
    log('      pre:  ' + String(result.firstDifference.before).slice(0, 160));
    log('      post: ' + String(result.firstDifference.after).slice(0, 160));
  }
  return false;
}

// ── CLI ──────────────────────────────────────────────────────────────────────

const flags = new Set(process.argv.slice(2));

if (flags.size === 0 || flags.has('--help')) {
  log('usage: node verify-migration.mjs [--backup] [--dry-run] [--report]');
  log('  --backup   copy data/questions.json and verify the copy (size + SHA-256)');
  log('  --dry-run  migrate the backup in memory; identity and idempotence gates');
  log('  --report   the full §4.6 gate, including answers.mjs --json byte-equality');
  process.exit(flags.size === 0 ? 1 : 0);
}

let allPassed = true;

if (flags.has('--backup')) {
  await backup();
  log();
}

if (flags.has('--dry-run') || flags.has('--report')) {
  try {
    const { before, after, ok } = await dryRun();
    allPassed &&= ok;
    log();
    if (flags.has('--report')) {
      allPassed &&= await reportEquivalence(before, after);
      log();
    }
  } catch (err) {
    // The gate's whole job is to answer "is this safe?". An unhandled rejection answers it
    // with a stack trace, which reads like a broken tool rather than a refusal to proceed.
    allPassed = false;
    log();
    if (err.name === 'FutureSchemaError') {
      log('  REFUSED  ' + err.message);
      log('           Nothing was written. This is the gate working, not a fault.');
    } else {
      log('  ERROR    ' + err.message);
    }
    log();
  }
}

log(allPassed ? 'GATE PASSED' : 'GATE FAILED');
process.exit(allPassed ? 0 : 1);
