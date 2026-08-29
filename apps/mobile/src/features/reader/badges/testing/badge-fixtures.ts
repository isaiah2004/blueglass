/**
 * A real badge response, and the helpers that bend it.
 *
 * Purpose
 *   `acts16.sample.json` was captured from the running API
 *   (`GET /badges/chapters/BSB/Acts/16`), trimmed to one badge of each of the five kinds and
 *   to three of the Route's twenty waypoints. Nothing in it was hand-written, which is the
 *   point: a decoder tested against a hand-written body proves the decoder agrees with the
 *   test author, not with the server.
 *
 * How to refresh it
 *   `curl -s http://localhost:8010/badges/chapters/BSB/Acts/16`, then keep the first badge of
 *   each kind. If the shape has drifted, the decoder tests fail — which is the alarm the
 *   fixture exists to ring.
 *
 * Dependencies
 *   None beyond the JSON. Test-only; never imported by shipped code.
 */

import sample from './acts16.sample.json';

/** The captured body, as `unknown` — the type a response actually has. */
export const ACTS_16_BADGES: unknown = sample;

/** One badge from the captured body, by kind, still as raw JSON. */
export function rawBadge(kind: string): unknown {
  const found = sample.badges.find((badge) => badge.kind === kind);
  if (found === undefined) {
    throw new Error(`The Acts 16 fixture carries no ${kind} badge.`);
  }
  return found;
}

/** The captured body with one badge replaced by whatever the caller wants to test. */
export function bodyWithBadges(badges: readonly unknown[]): unknown {
  return { ...sample, badges };
}

/** A shallow clone of one fixture badge with some fields overridden or deleted. */
export function badgeWith(kind: string, overrides: Readonly<Record<string, unknown>>): unknown {
  return { ...(rawBadge(kind) as Record<string, unknown>), ...overrides };
}
