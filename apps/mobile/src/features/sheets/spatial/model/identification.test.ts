/**
 * The caveat a single pin owes the reader, and the case where it owes none.
 *
 * `DECISIONS.md` #10 has two halves and this module is the second one. The first —
 * "N proposed sites for this city" — has shipped since M2. The second reached the
 * database in revision `0008` as `homonym_count` and then nothing read it, so 1,122 of
 * the canon's 4,298 route waypoints presented one of two to nine identically named
 * places as the settled identification. These tests are the specification of the
 * replacement that revision's own CHANGELOG asked for.
 */

import { describe, expect, it } from 'vitest';

import { disputedSiteNote, identificationLine, sharedNameNote } from './identification';

describe('sharedNameNote', () => {
  it('says nothing when the name belongs to one place', () => {
    expect(sharedNameNote(1)).toBeNull();
  });

  it('counts the places that share the name', () => {
    // Nine ancient places are called Ramah. The label used to read "Ramah 2".
    expect(sharedNameNote(9)).toBe('One of 9 places of this name');
  });

  it('treats a missing or nonsensical count as nothing to say', () => {
    // Never a claim built on a number the gazetteer did not give.
    expect(sharedNameNote(0)).toBeNull();
  });
});

describe('disputedSiteNote', () => {
  it('says nothing when one site is proposed', () => {
    expect(disputedSiteNote(1)).toBeNull();
  });

  it('counts the rival sites', () => {
    expect(disputedSiteNote(3)).toBe('3 proposed sites');
  });
});

describe('identificationLine', () => {
  it('is the feature type alone when there is nothing to caveat', () => {
    expect(identificationLine('settlement', 1, 1)).toBe('settlement');
  });

  it('carries both caveats when both apply', () => {
    // Bethel: three places of the name, and rival sites for this one.
    expect(identificationLine('settlement', 3, 2)).toBe(
      'settlement · One of 3 places of this name · 2 proposed sites',
    );
  });

  it('carries only the caveat that applies', () => {
    expect(identificationLine('settlement', 1, 3)).toBe('settlement · 3 proposed sites');
    expect(identificationLine('region', 4, 1)).toBe('region · One of 4 places of this name');
  });
});
