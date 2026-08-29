/**
 * The badge decoder, against a real response body.
 *
 * What these assert, and why here rather than in a render
 *   Three of this milestone's rules are decode-time rules, and all three are invisible on
 *   screen when they work: `AI-05`'s "no provenance, no badge", the drop-one-not-all
 *   resilience rule, and the narrowing of the wire's small string unions. A component test
 *   would show an absent pill and could not tell you which of the three caused it.
 *
 * The fixture is not hand-written
 *   `testing/acts16.sample.json` came off the running API. A decoder tested against a body
 *   the test author typed proves only that the two agree with each other.
 */

import { describe, expect, it } from 'vitest';

import { decodeChapterBadges, decodeOneBadge } from './badge-decoders';
import { ACTS_16_BADGES, badgeWith, bodyWithBadges, rawBadge } from './testing/badge-fixtures';

/** Decode the whole fixture, failing the test rather than the assertion if it will not. */
function decodeFixture(body: unknown = ACTS_16_BADGES): ReturnType<typeof decodeChapterBadges> {
  return decodeChapterBadges(body, '');
}

describe('decodeChapterBadges', () => {
  it('decodes the captured Acts 16 body', () => {
    const result = decodeFixture();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reference).toBe('Acts 16');
    expect(result.value.translation).toBe('BSB');
    expect(result.value.badges).toHaveLength(5);
    expect(result.value.droppedCount).toBe(0);
  });

  it('resolves the anchor key into a verse the client can name', () => {
    const result = decodeFixture();
    if (!result.ok) throw new Error('fixture did not decode');

    const route = result.value.badges.find((badge) => badge.kind === 'route');
    expect(route?.anchor.verse.book.name).toBe('Acts');
    expect(route?.anchor.verse.chapter).toBe(16);
    expect(route?.anchor.verse.verse).toBe(1);
    expect(route?.anchor.text).toBe('Derbe');
  });

  it('keeps every badge kind on its own payload', () => {
    const result = decodeFixture();
    if (!result.ok) throw new Error('fixture did not decode');

    const byKind = new Map(result.value.badges.map((badge) => [badge.kind, badge]));
    expect([...byKind.keys()].sort()).toEqual(
      ['3d-city', 'cross-ref', 'history', 'root', 'route'].sort(),
    );

    const root = byKind.get('root');
    if (root?.kind !== 'root') throw new Error('no root badge');
    expect(root.payload.language).toBe('greek');
    expect(root.payload.strongsNumber).toMatch(/^G\d+$/);
  });

  it('omits an absent optional field rather than carrying null into a sheet', () => {
    const result = decodeFixture();
    if (!result.ok) throw new Error('fixture did not decode');

    const root = result.value.badges.find((badge) => badge.kind === 'root');
    if (root?.kind !== 'root') throw new Error('no root badge');
    expect(root.payload.morphology).toBeUndefined();
    expect('morphology' in root.payload).toBe(false);
  });

  it('carries every source attribution verbatim', () => {
    const result = decodeFixture();
    if (!result.ok) throw new Error('fixture did not decode');

    const route = result.value.badges.find((badge) => badge.kind === 'route');
    expect(route?.sources[0]?.attribution).toBe('Place data © OpenBible.info, CC BY 4.0');
    expect(route?.sources[0]?.license).toBe('CC-BY-4.0');
    expect(route?.sources[0]?.shareAlike).toBe(false);
  });

  it('answers a chapter with no enrichment successfully, not as an error', () => {
    const result = decodeFixture(bodyWithBadges([]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.badges).toEqual([]);
    expect(result.value.droppedCount).toBe(0);
  });

  it('drops one malformed badge and keeps the rest, counting the drop', () => {
    const result = decodeFixture(bodyWithBadges([rawBadge('route'), { id: 'broken' }]));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.badges).toHaveLength(1);
    expect(result.value.droppedCount).toBe(1);
  });

  it('fails the whole read when the envelope itself is wrong', () => {
    const result = decodeFixture({ reference: 'Acts 16' });

    expect(result.ok).toBe(false);
  });
});

describe('decodeOneBadge — the rules that refuse a badge', () => {
  it('refuses a badge with no sources (AI-05)', () => {
    expect(decodeOneBadge(badgeWith('route', { sources: [] }), '')).toBeNull();
  });

  it('refuses a kind this client cannot draw', () => {
    expect(decodeOneBadge(badgeWith('route', { kind: 'manuscript' }), '')).toBeNull();
  });

  it('refuses an anchor whose verse key is outside the canon', () => {
    const anchor = { verse_key: 99016001, text: 'Derbe', start_offset: 13, end_offset: 18 };
    expect(decodeOneBadge(badgeWith('route', { anchor }), '')).toBeNull();
  });

  it('refuses a Root badge in a language it cannot set the direction for', () => {
    const raw = rawBadge('root') as { payload: Record<string, unknown> };
    const payload = { ...raw.payload, language: 'ugaritic' };
    expect(decodeOneBadge(badgeWith('root', { payload }), '')).toBeNull();
  });

  it('refuses a History badge whose dating origin it cannot name', () => {
    const raw = rawBadge('history') as { payload: Record<string, unknown> };
    const payload = { ...raw.payload, dating_origin: 'guessed' };
    expect(decodeOneBadge(badgeWith('history', { payload }), '')).toBeNull();
  });

  it('refuses a pin whose role would draw a journey that did not happen', () => {
    const raw = rawBadge('route') as { payload: { waypoints: readonly Record<string, unknown>[] } };
    const [first, ...rest] = raw.payload.waypoints;
    const payload = {
      ...raw.payload,
      waypoints: [{ ...first, role: 'arrival' }, ...rest],
    };
    expect(decodeOneBadge(badgeWith('route', { payload }), '')).toBeNull();
  });

  it('accepts an unfamiliar citation kind as external rather than dropping the badge', () => {
    const raw = rawBadge('route') as { citations: readonly Record<string, unknown>[] };
    const citations = raw.citations.map((citation) => ({ ...citation, kind: 'podcast' }));
    const badge = decodeOneBadge(badgeWith('route', { citations }), '');

    expect(badge?.citations[0]?.kind).toBe('external');
  });
});
