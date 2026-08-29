/**
 * Tests for the cost arithmetic.
 *
 * Purpose
 *   Prove the bias rule holds: every pre-call estimate over-states the cost, and every
 *   post-call settlement prefers the provider's own figure. An estimate that came in *under*
 *   the real cost would be the one bug capable of letting a loop overshoot the ceiling.
 */

import { describe, expect, it } from 'vitest';
import { estimatePromptTokens, estimateWorstCaseCostUsd, resolveActualCostUsd } from './pricing';
import { resolveModel } from './registry';
import type { ModelSpec } from './types';

const EXTRACTION_MODEL = resolveModel('extract_structured');

/** A model identical to the extraction primary except that reasoning cannot be disabled. */
const REASONING_MODEL: ModelSpec = { ...EXTRACTION_MODEL, reasoning: 'mandatory' };

describe('estimatePromptTokens', () => {
  it('over-estimates against the measured benchmark prompt', () => {
    // Acts 16:11-15 plus system framing measured at 300 prompt tokens on the real call.
    const measuredPromptTokens = 300;
    const passage = 'x'.repeat(153 * 6); // 153 words at a generous 6 characters each

    const estimated = estimatePromptTokens([
      { content: 'Extract structured data from the passage.' },
      { content: passage },
    ]);

    expect(estimated).toBeGreaterThan(measuredPromptTokens);
  });

  it('never returns zero, so a reservation is never free by accident', () => {
    expect(estimatePromptTokens([])).toBe(1);
    expect(estimatePromptTokens([{ content: '' }])).toBeGreaterThan(0);
  });

  it('grows with the prompt', () => {
    const short = estimatePromptTokens([{ content: 'short' }]);
    const long = estimatePromptTokens([{ content: 'short'.repeat(100) }]);
    expect(long).toBeGreaterThan(short);
  });
});

describe('estimateWorstCaseCostUsd', () => {
  it('exceeds the measured cost of the benchmarked extraction call', () => {
    // Measured: 300 in / 262 out cost $0.00007490 on mistral-small-3.2-24b.
    const measuredCostUsd = 0.0000749;
    const worstCase = estimateWorstCaseCostUsd(EXTRACTION_MODEL, 300, 600);

    expect(worstCase).toBeGreaterThan(measuredCostUsd);
  });

  it('prices the full output allowance, not a hoped-for shorter answer', () => {
    const atFullCap = estimateWorstCaseCostUsd(EXTRACTION_MODEL, 300, 600);
    const expected =
      (300 * EXTRACTION_MODEL.inputPerMTok + 600 * EXTRACTION_MODEL.outputPerMTok) / 1e6;
    expect(atFullCap).toBeCloseTo(expected, 12);
  });

  it('adds a reasoning tax for models that always bill hidden tokens', () => {
    const plain = estimateWorstCaseCostUsd(EXTRACTION_MODEL, 300, 600);
    const withReasoning = estimateWorstCaseCostUsd(REASONING_MODEL, 300, 600);
    expect(withReasoning).toBeGreaterThan(plain);
  });

  it('prices a self-hosted model at zero', () => {
    expect(estimateWorstCaseCostUsd(resolveModel('embed'), 8_000)).toBe(0);
  });

  it('defaults the output allowance to the model cap', () => {
    expect(estimateWorstCaseCostUsd(EXTRACTION_MODEL, 300)).toBe(
      estimateWorstCaseCostUsd(EXTRACTION_MODEL, 300, EXTRACTION_MODEL.maxOutputTokens),
    );
  });
});

describe('resolveActualCostUsd', () => {
  it("prefers the provider's own reported cost", () => {
    const settled = resolveActualCostUsd(
      EXTRACTION_MODEL,
      { promptTokens: 300, completionTokens: 262, reportedCostUsd: 0.0000749 },
      0.000142,
    );
    expect(settled).toBe(0.0000749);
  });

  it('accepts a genuinely free call reported as zero', () => {
    const settled = resolveActualCostUsd(
      EXTRACTION_MODEL,
      { promptTokens: 0, completionTokens: 0, reportedCostUsd: 0 },
      0.000142,
    );
    expect(settled).toBe(0);
  });

  it('computes from token counts when the provider omitted a cost', () => {
    const settled = resolveActualCostUsd(
      EXTRACTION_MODEL,
      { promptTokens: 300, completionTokens: 262, reportedCostUsd: null },
      0.000142,
    );
    const expected =
      (300 * EXTRACTION_MODEL.inputPerMTok + 262 * EXTRACTION_MODEL.outputPerMTok) / 1e6;
    expect(settled).toBeCloseTo(expected, 12);
  });

  it('falls back to the whole reservation when nothing is usable, rather than releasing it', () => {
    const settled = resolveActualCostUsd(
      EXTRACTION_MODEL,
      { promptTokens: Number.NaN, completionTokens: Number.NaN, reportedCostUsd: null },
      0.000142,
    );
    expect(settled).toBe(0.000142);
  });

  it('ignores a negative reported cost rather than crediting the budget', () => {
    const settled = resolveActualCostUsd(
      EXTRACTION_MODEL,
      { promptTokens: 300, completionTokens: 262, reportedCostUsd: -5 },
      0.000142,
    );
    expect(settled).toBeGreaterThan(0);
  });
});
