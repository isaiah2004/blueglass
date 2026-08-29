/**
 * The sequenced event log and the long-poll channel (spec §6).
 *
 * Every event carries a monotonic `seq`, so a listener that was away can ask for
 * "everything after 117" and get exactly that — no missed events, no duplicates, no
 * reconnect state machine.
 *
 * Invariant I-6 is enforced structurally here, not by convention: waiters live in a plain
 * in-memory set and are woken by `wakeWaiters`, which the db layer calls AFTER `persist()`
 * has already resolved. A listener holding a request open therefore cannot delay the human's
 * answer being written to disk. Answering never blocks on the fleet; the fleet never blocks
 * on answering.
 *
 * Chosen over SSE (no stream framing, no reconnect logic, trivially assertable in a test)
 * and over fs.watch (which on Windows fires for the temp file AND the rename, with no
 * ordering guarantee).
 */

/** Beyond this the oldest events are dropped; the log is a channel, not an archive. */
const MAX_EVENTS = 2000;

/** A runaway listener loop must not exhaust sockets and lock the human out of the UI. */
export const MAX_WAITERS = 32;

const waiters = new Set();

/** Append an event, stamping the next seq. Returns the stored event. */
export function logEvent(db, kind, detail) {
  db.seq = (db.seq ?? 0) + 1;
  const event = { kind, detail, at: new Date().toISOString(), seq: db.seq };
  db.events.push(event);
  if (db.events.length > MAX_EVENTS) db.events.splice(0, db.events.length - MAX_EVENTS);
  return event;
}

/** Every retained event newer than `since`. */
export function eventsSince(db, since) {
  return db.events.filter((event) => (event.seq ?? 0) > since);
}

export function currentSeq(db) {
  return db.seq ?? 0;
}

export function waiterCount() {
  return waiters.size;
}

/**
 * Long-poll for events newer than `since`.
 *
 * Returns immediately when the caller is behind, or when the waiter cap is reached (with a
 * `retryAfterMs` hint so a runaway caller backs off rather than hammering). Otherwise holds
 * the promise open for `timeoutMs` and resolves with an empty list on expiry.
 *
 * @returns {Promise<{events: object[], seq: number, retryAfterMs?: number}>}
 */
export function waitForEvents(db, since, timeoutMs) {
  const immediate = eventsSince(db, since);
  if (immediate.length > 0) return Promise.resolve({ events: immediate, seq: currentSeq(db) });
  if (waiters.size >= MAX_WAITERS) {
    return Promise.resolve({ events: [], seq: currentSeq(db), retryAfterMs: 1000, reason: 'listener-cap' });
  }
  return new Promise((resolve) => {
    const waiter = { since, timer: null, deliver: null };
    waiter.deliver = (payload) => {
      if (!waiters.has(waiter)) return;
      waiters.delete(waiter);
      clearTimeout(waiter.timer);
      resolve(payload);
    };
    waiter.timer = setTimeout(() => waiter.deliver({ events: [], seq: currentSeq(db) }), timeoutMs);
    waiter.timer.unref?.();
    waiters.add(waiter);
  });
}

/**
 * Wake every waiter that now has something to read. Called after a persist has resolved,
 * never from inside the write queue.
 */
export function wakeWaiters(db) {
  for (const waiter of [...waiters]) {
    const events = eventsSince(db, waiter.since);
    if (events.length > 0) waiter.deliver({ events, seq: currentSeq(db) });
  }
}

/** Release every waiter — used on shutdown and by tests so no timer keeps the loop alive. */
export function releaseWaiters(db) {
  for (const waiter of [...waiters]) waiter.deliver({ events: [], seq: currentSeq(db) });
}
