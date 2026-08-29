/**
 * Tests for the attribution strip's de-duplication.
 *
 * What is worth asserting
 *   The one way this optimisation could do harm: losing a licence obligation. `AI-05` and
 *   `Q-007` both turn on being able to tell a share-alike source from a permissive one, so the
 *   assertion that a fold never drops that flag is the point of the file.
 */

import { describe, expect, it } from 'vitest';

import type { SourceAttribution } from '@atlas/shared';

import { attributionLines } from './attribution-lines';

/** A source, with only the fields the strip reads set. */
function source(overrides: Partial<SourceAttribution> & { key: string }): SourceAttribution {
  return {
    name: overrides.key,
    license: 'CC-BY-4.0',
    attribution: 'STEP Bible — www.STEPBible.org (CC BY 4.0)',
    shareAlike: false,
    ...overrides,
  };
}

describe('attributionLines', () => {
  it('prints one line per source when every obligation differs', () => {
    const lines = attributionLines([
      source({ key: 'a', attribution: 'Place data © OpenBible.info, CC BY 4.0' }),
      source({ key: 'b', attribution: 'Dodson Greek Lexicon — public domain (CC0 1.0)' }),
    ]);

    expect(lines).toHaveLength(2);
  });

  it('folds two datasets of one project onto one line', () => {
    const lines = attributionLines([source({ key: 'tagnt' }), source({ key: 'tbesg' })]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.key).toBe('tagnt');
  });

  it('keeps the same sentence apart when the licences differ', () => {
    const lines = attributionLines([
      source({ key: 'a' }),
      source({ key: 'b', license: 'CC-BY-SA-4.0' }),
    ]);

    expect(lines).toHaveLength(2);
  });

  it('never loses the share-alike obligation to a fold', () => {
    const lines = attributionLines([
      source({ key: 'permissive' }),
      source({ key: 'copyleft', shareAlike: true }),
    ]);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.shareAlike).toBe(true);
  });

  it('reproduces the attribution sentence unabridged', () => {
    const wording = 'Event dating from Theographic Bible Metadata, CC BY-SA 4.0 — github.com';
    const lines = attributionLines([source({ key: 'x', attribution: wording })]);

    expect(lines[0]?.attribution).toBe(wording);
  });

  it('renders nothing from nothing', () => {
    expect(attributionLines([])).toEqual([]);
  });
});
