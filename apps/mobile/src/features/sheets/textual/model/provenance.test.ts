/**
 * Tests for the provenance gate.
 *
 * What is worth asserting here
 *   `AI-05` is the rule most likely to be quietly weakened by a later refactor, because
 *   nothing visibly breaks when it is: the sheet still renders, it just stops naming its
 *   source. These tests pin the two halves that matter — an unattributed badge is refused,
 *   and a repeated attribution line is printed once.
 */

import { describe, expect, it } from 'vitest';

import type { SourceAttribution } from '@atlas/shared';

import {
  hasProvenance,
  hasShareAlikeSource,
  isPrintableSource,
  printableSources,
  provenanceSummary,
} from './provenance';

/**
 * Build a source entry with sane defaults.
 *
 * @param overrides - Fields to replace.
 * @returns The entry. Side effects: none.
 */
function source(overrides: Partial<SourceAttribution> = {}): SourceAttribution {
  return {
    key: 'openbible_xref',
    name: 'OpenBible.info Cross References',
    license: 'CC-BY-4.0',
    attribution: 'Cross-references © OpenBible.info, CC BY 4.0',
    shareAlike: false,
    ...overrides,
  };
}

describe('isPrintableSource', () => {
  it('accepts an entry with both an attribution line and a licence', () => {
    expect(isPrintableSource(source())).toBe(true);
  });

  it('refuses an entry with no attribution line', () => {
    expect(isPrintableSource(source({ attribution: '   ' }))).toBe(false);
  });

  it('refuses an entry with no licence', () => {
    expect(isPrintableSource(source({ license: '' }))).toBe(false);
  });
});

describe('printableSources', () => {
  it('keeps the first occurrence of a repeated attribution line', () => {
    const stepBible = 'STEP Bible — www.STEPBible.org (CC BY 4.0)';
    const kept = printableSources([
      source({ key: 'stepbible_tbesg', name: 'TBESG', attribution: stepBible }),
      source({ key: 'stepbible_tagnt', name: 'TAGNT', attribution: stepBible }),
      source({ key: 'dodson', name: 'Dodson', attribution: 'Dodson — public domain' }),
    ]);

    expect(kept.map((entry) => entry.key)).toEqual(['stepbible_tbesg', 'dodson']);
  });

  it('treats surrounding whitespace as the same line', () => {
    const kept = printableSources([
      source(),
      source({ key: 'other', attribution: '  Cross-references © OpenBible.info, CC BY 4.0  ' }),
    ]);

    expect(kept).toHaveLength(1);
  });

  it('drops entries that cannot name their licence', () => {
    expect(printableSources([source({ license: '' })])).toEqual([]);
  });
});

describe('hasProvenance', () => {
  it('is false for an empty source list', () => {
    expect(hasProvenance([])).toBe(false);
  });

  it('is false when every entry is unprintable', () => {
    expect(hasProvenance([source({ attribution: '' }), source({ license: '' })])).toBe(false);
  });

  it('is true when one entry survives', () => {
    expect(hasProvenance([source({ license: '' }), source()])).toBe(true);
  });
});

describe('provenanceSummary', () => {
  it('is empty when nothing is printable', () => {
    expect(provenanceSummary([])).toBe('');
  });

  it('names each dataset with its licence', () => {
    const summary = provenanceSummary([
      source(),
      source({
        key: 'murai',
        name: 'Literary Structure of the Bible',
        attribution: 'Murai, CC BY 4.0',
      }),
    ]);

    expect(summary).toBe(
      'Sources: OpenBible.info Cross References (CC-BY-4.0); Literary Structure of the Bible (CC-BY-4.0).',
    );
  });
});

describe('hasShareAlikeSource', () => {
  it('is true when a copyleft dataset is behind the sheet', () => {
    const theographic = source({
      key: 'theographic_events',
      name: 'Theographic Bible Metadata — Events',
      license: 'CC-BY-SA-4.0',
      attribution: 'Event dating from Theographic Bible Metadata, CC BY-SA 4.0',
      shareAlike: true,
    });

    expect(hasShareAlikeSource([source(), theographic])).toBe(true);
  });

  it('ignores a copyleft entry that is not printable', () => {
    expect(hasShareAlikeSource([source({ shareAlike: true, attribution: '' })])).toBe(false);
  });
});
