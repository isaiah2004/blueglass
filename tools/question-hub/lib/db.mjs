/**
 * Storage: load, migrate-on-load, atomic serialised writes, backups and rolling snapshots.
 *
 * This module is the guard on the one unforgivable failure — losing answers a human already
 * gave. Four independent mechanisms, because one is a promise and four is a system:
 *   1. The version gate (§4.4): a file newer than this server understands stops the process
 *      before any write path is armed, so an old build can never round-trip a new file back.
 *   2. The automatic pre-migration backup (§4.6.8): written and fsynced BEFORE the first
 *      persist of a migrated database. A human remembering to back up is not a mechanism.
 *   3. Atomic writes: fsynced temp file, then rename. A crash mid-write cannot truncate.
 *   4. Rolling snapshots (§4.7): the newest 20 answering writes, ~2 MB, covering the failure
 *      modes a migration backup does not — a bad batch, a rogue agent, a new code path.
 *
 * Writes are serialised through one promise queue so concurrent agents cannot interleave.
 * `HUB_DATA_DIR` relocates the whole directory, which is how a test instance runs against a
 * temp directory without ever touching the human's file.
 */
import { readFile, writeFile, rename, mkdir, open, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, SCHEMA_VERSION } from './migrate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const HUB_ROOT = path.resolve(HERE, '..');
export const DATA_DIR = path.resolve(process.env.HUB_DATA_DIR ?? path.join(HUB_ROOT, 'data'));
export const DB_PATH = path.join(DATA_DIR, 'questions.json');
const SNAPSHOT_DIR = path.join(DATA_DIR, 'snapshots');
const SNAPSHOT_KEEP = 20;

let db = emptyDb();
let writeQueue = Promise.resolve();
let pendingBackup = null;
let afterPersist = null;
let snapshotCounter = 0;

/** A fresh database at the current schema version. */
export function emptyDb() {
  return { questions: [], events: [], status: null, version: SCHEMA_VERSION, seq: 0 };
}

export function getDb() {
  return db;
}

/** Register a hook run after every successful persist, OUTSIDE the write queue (I-6). */
export function onPersisted(hook) {
  afterPersist = hook;
}

/** Filesystem-safe ISO timestamp: Windows rejects ':' in filenames. */
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/** Write a file and fsync it before returning, so the bytes are really on the platter. */
async function writeSynced(file, body) {
  const handle = await open(file, 'w');
  try {
    await handle.writeFile(body, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * Load the database, migrating it in memory. The ONLY migration point in the system:
 * an external script editing the file while a server is running would be silently rolled
 * back by that server's next persist, so startup is made the only place it can happen.
 *
 * @returns {Promise<{created: boolean, from: number, to: number, backup: string|null}>}
 */
export async function loadDb() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(DB_PATH)) {
    db = emptyDb();
    await persist();
    return { created: true, from: SCHEMA_VERSION, to: SCHEMA_VERSION, backup: null };
  }
  const raw = await readFile(DB_PATH, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('questions.json is not valid JSON (' + err.message + '). Nothing has been written; restore it from data/snapshots/ or a backup before starting the hub.');
  }
  const onDisk = parsed.version ?? 1;
  if (onDisk > SCHEMA_VERSION) {
    console.error('[hub] refusing to start: the data file is schema v' + onDisk + ' but this server only understands v' + SCHEMA_VERSION + '. Start the newer server instead — this one would drop every v' + onDisk + ' field on its next write.');
    process.exit(1);
  }
  db = migrate(parsed);
  if (onDisk !== SCHEMA_VERSION) {
    pendingBackup = { file: path.join(DATA_DIR, 'questions.backup-v' + onDisk + '-' + stamp() + '.json'), body: raw };
  }
  return { created: false, from: onDisk, to: SCHEMA_VERSION, backup: pendingBackup?.file ?? null };
}

/** Newest-20 rolling snapshot of an answering write. Best-effort: never fails a save. */
async function writeSnapshot(body) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  snapshotCounter = (snapshotCounter + 1) % 10000;
  const name = 'questions-' + stamp() + '-' + String(snapshotCounter).padStart(4, '0') + '.json';
  await writeFile(path.join(SNAPSHOT_DIR, name), body, 'utf8');
  const existing = (await readdir(SNAPSHOT_DIR)).filter((f) => f.startsWith('questions-') && f.endsWith('.json')).sort();
  for (const stale of existing.slice(0, Math.max(0, existing.length - SNAPSHOT_KEEP))) {
    await unlink(path.join(SNAPSHOT_DIR, stale));
  }
}

/**
 * Serialise and swap atomically. Every caller awaits the same queue, so two agents writing
 * at once produce two sequential complete files, never one interleaved one.
 *
 * @param {{snapshot?: boolean}} [opts] snapshot:true for writes that answer or un-answer.
 */
export function persist({ snapshot = false } = {}) {
  const task = async () => {
    if (pendingBackup) {
      await writeSynced(pendingBackup.file, pendingBackup.body);
      console.log('[hub] pre-migration backup written: ' + path.basename(pendingBackup.file));
      pendingBackup = null;
    }
    const body = JSON.stringify(db, null, 2);
    const tmp = DB_PATH + '.tmp';
    await writeSynced(tmp, body);
    await rename(tmp, DB_PATH);
    if (snapshot) await writeSnapshot(body).catch((err) => console.warn('[hub] snapshot skipped: ' + err.message));
  };
  // `.then(task, task)` keeps the queue running even if the previous write rejected.
  const result = writeQueue.then(task, task);
  writeQueue = result.catch(() => {});
  return result.then(async () => {
    if (!afterPersist) return;
    try {
      await afterPersist(db);
    } catch (err) {
      console.warn('[hub] post-persist hook failed: ' + err.message);
    }
  });
}
