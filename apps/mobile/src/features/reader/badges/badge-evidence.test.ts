/**
 * Tests for the rule that stops a badge printing one sentence four times.
 *
 * The shipped defect this pins
 *   Every Root badge listed "STEP Bible — www.STEPBible.org (CC BY 4.0)" twice as two
 *   identical evidence chips, because `stepbible_tbesg` and `stepbible_tagnt` are two files
 *   of one project under one attribution string. The Sources strip below then printed the
 *   whole set again. Two distinct facts consumed four chips and four lines on a 375 dp sheet.
 */

import { describe, expect, it } from 'vitest';

import type { Citation, SourceAttribution } from './badge-models';
import { distinctEvidence } from './badge-evidence';

/** One STEPBible file, as the wire sends it. */
function stepSource(key: string): SourceAttribution {
  return {
    key,
    name: `STEP Bible (${key})`,
    license: 'CC-BY-4.0',
    attribution: 'STEP Bible — www.STEPBible.org (CC BY 4.0)',
    shareAlike: false,
  };
}

/** A citation whose label is a dataset's attribution line — every M2 citation is one. */
function sourceCitation(id: string, label: string): Citation {
  return { id, kind: 'reference-work', label };
}

describe('distinctEvidence', () => {
  it('drops a chip the attribution strip is already going to print in full', () => {
    const sources = [stepSource('stepbible_tbesg'), stepSource('stepbible_tagnt')];
    const citations = [
      sourceCitation('root-0', sources[0]!.attribution),
      sourceCitation('root-1', sources[1]!.attribution),
    ];

    expect(distinctEvidence(citations, sources)).toEqual([]);
  });

  it('keeps a citation that says something the sources cannot', () => {
    const sources = [stepSource('stepbible_tbesg')];
    const specific = sourceCitation('root-2', 'Acts 16:14, BSB');

    expect(
      distinctEvidence([sourceCitation('root-0', sources[0]!.attribution), specific], sources),
    ).toEqual([specific]);
  });

  it('folds two chips carrying the same sentence into one', () => {
    const repeated = 'Place data © OpenBible.info, CC BY 4.0';

    const chips = distinctEvidence(
      [sourceCitation('a', repeated), sourceCitation('b', repeated)],
      [],
    );

    expect(chips.map((chip) => chip.id)).toEqual(['a']);
  });

  it('never renders an empty chip', () => {
    expect(distinctEvidence([sourceCitation('a', '   ')], [])).toEqual([]);
  });

  it('keeps first-seen order, so the server decides what leads', () => {
    const first = sourceCitation('a', 'One');
    const second = sourceCitation('b', 'Two');

    expect(distinctEvidence([first, second], [])).toEqual([first, second]);
  });
});
