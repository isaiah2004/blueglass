/**
 * The fleet status board — so the human can see what the fleet is doing from the same
 * phone they answer on.
 *
 * The orchestrator replaces the whole board on every update rather than patching rows. A
 * patch-based board accumulates stale entries and quietly stops reflecting reality; a
 * wholesale replace cannot.
 */
import { getDb, persist } from './db.mjs';
import { logEvent } from './events.mjs';
import { HttpError } from './http.mjs';

export const VALID_STATES = Object.freeze(['done', 'running', 'blocked', 'queued']);

/** Replace the board wholesale. Returns the stored board including its updatedAt stamp. */
export async function handleStatus(body) {
  if (!Array.isArray(body.entries)) throw new HttpError(400, 'status needs an "entries" array.');
  for (const [i, entry] of body.entries.entries()) {
    const where = 'status entry ' + (i + 1);
    if (!entry || typeof entry !== 'object') throw new HttpError(400, where + ' must be an object.');
    if (typeof entry.title !== 'string' || entry.title.trim() === '') {
      throw new HttpError(400, where + ' needs a non-empty "title".');
    }
    if (!VALID_STATES.includes(entry.state)) {
      throw new HttpError(400, where + ' has state "' + entry.state + '" — expected one of ' + VALID_STATES.join(', ') + '.');
    }
  }
  const db = getDb();
  db.status = {
    headline: typeof body.headline === 'string' ? body.headline : '',
    entries: body.entries,
    updatedAt: new Date().toISOString(),
  };
  logEvent(db, 'status', { entries: body.entries.length });
  await persist();
  return db.status;
}
