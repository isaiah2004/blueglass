/**
 * The wire's closed vocabularies, and the two failure styles they use.
 *
 * What is worth asserting
 *   Not that a known value passes — that a value the server does not currently send is
 *   handled the way the decision says. `AI-05` is a rule about not showing what cannot be
 *   supported, and these six functions are where that rule turns into a `null`.
 */

import { describe, expect, it } from 'vitest';

import {
  asCitationKind,
  asCrossReferenceRelation,
  asDatingOrigin,
  asLocationRole,
  asOriginalLanguage,
  asReaderBadgeKind,
  READER_BADGE_KINDS,
} from './badge-vocabularies';

describe('fail closed — an unknown value drops the badge', () => {
  it('rejects a badge kind this client does not ship', () => {
    expect(asReaderBadgeKind('manuscript')).toBeNull();
    expect(asReaderBadgeKind('city3d')).toBeNull();
  });

  it('accepts every kind the reader claims to ship', () => {
    for (const kind of READER_BADGE_KINDS) {
      expect(asReaderBadgeKind(kind)).toBe(kind);
    }
  });

  it('rejects a pin role that would misshape the route line', () => {
    expect(asLocationRole('departure')).toBe('departure');
    expect(asLocationRole('arrival')).toBeNull();
  });

  it('rejects a language whose reading direction it cannot set', () => {
    expect(asOriginalLanguage('hebrew')).toBe('hebrew');
    expect(asOriginalLanguage('ugaritic')).toBeNull();
  });

  it('rejects a dating origin it cannot name, so a guess never reads as sourced', () => {
    expect(asDatingOrigin('sourced')).toBe('sourced');
    expect(asDatingOrigin('guessed')).toBeNull();
  });

  it('rejects a cross-reference relation it cannot explain', () => {
    expect(asCrossReferenceRelation('parallel')).toBe('parallel');
    expect(asCrossReferenceRelation('inspired-by')).toBeNull();
  });
});

describe('fall back — only where the fallback understates', () => {
  it('keeps a citation kind it recognises', () => {
    expect(asCitationKind('gazetteer')).toBe('gazetteer');
    expect(asCitationKind('scripture')).toBe('scripture');
  });

  it('calls anything else external rather than claiming it is a manuscript', () => {
    expect(asCitationKind('podcast')).toBe('external');
    expect(asCitationKind('')).toBe('external');
  });
});
