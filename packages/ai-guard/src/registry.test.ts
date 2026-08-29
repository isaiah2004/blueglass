/**
 * Tests for the model registry and its price ceiling.
 *
 * Purpose
 *   Prove that registering an expensive model fails loudly, that an expensive *fallback*
 *   fails just as loudly, and that the catalogue actually shipped is inside the ceiling.
 *
 * The last one is a regression guard
 *   `the shipped catalogue is entirely open-weight and cheap` is the test that fails if
 *   someone edits `models.ts` in a hurry. It is cheap insurance on the single constraint
 *   the human called non-negotiable.
 */

import { describe, expect, it } from 'vitest';
import { ModelPriceCeilingError, RegistryConfigError } from './errors';
import { AI_TASKS, MODEL_REGISTRY, defineRegistry, resolveModel } from './registry';
import type { AiTask, ModelSpec } from './types';

/** A minimal, valid, cheap model used as the base for each mutation below. */
function cheapModel(overrides: Partial<ModelSpec> = {}): ModelSpec {
  return {
    id: 'vendor/cheap-model',
    host: 'openrouter',
    inputPerMTok: 0.02,
    outputPerMTok: 0.03,
    contextWindow: 131_072,
    maxOutputTokens: 500,
    supportsStructuredOutput: true,
    supportsTools: true,
    reasoning: 'none',
    providerOrder: null,
    fallback: null,
    ...overrides,
  };
}

/** Build a full five-task catalogue from one spec, so a single mutation is the only variable. */
function catalogueOf(spec: ModelSpec): Readonly<Record<AiTask, ModelSpec>> {
  return {
    grounded_chat: spec,
    extract_structured: spec,
    editorial: spec,
    classify_cheap: spec,
    embed: spec,
  };
}

describe('defineRegistry — the price ceiling', () => {
  it('rejects a model whose output price is over the ceiling', () => {
    const expensive = cheapModel({ id: 'vendor/frontier-xl', outputPerMTok: 15 });

    expect(() => defineRegistry(catalogueOf(expensive), 1)).toThrow(ModelPriceCeilingError);
  });

  it('names the offending model, its price, and the ceiling in the error', () => {
    const expensive = cheapModel({ id: 'vendor/frontier-xl', outputPerMTok: 15 });

    try {
      defineRegistry(catalogueOf(expensive), 1);
      expect.unreachable('defineRegistry should have thrown');
    } catch (failure) {
      expect(failure).toBeInstanceOf(ModelPriceCeilingError);
      const priceFailure = failure as ModelPriceCeilingError;
      expect(priceFailure.code).toBe('MODEL_PRICE_CEILING');
      expect(priceFailure.modelId).toBe('vendor/frontier-xl');
      expect(priceFailure.pricePerMTok).toBe(15);
      expect(priceFailure.ceilingPerMTok).toBe(1);
      expect(priceFailure.message).toContain('vendor/frontier-xl');
    }
  });

  it('rejects a model whose *input* price is over the ceiling', () => {
    const expensive = cheapModel({ id: 'vendor/expensive-context', inputPerMTok: 3 });
    expect(() => defineRegistry(catalogueOf(expensive), 1)).toThrow(ModelPriceCeilingError);
  });

  it('rejects an expensive fallback hiding behind a cheap primary', () => {
    const smuggler = cheapModel({
      id: 'vendor/cheap-front',
      fallback: cheapModel({ id: 'vendor/frontier-understudy', outputPerMTok: 30 }),
    });

    try {
      defineRegistry(catalogueOf(smuggler), 1);
      expect.unreachable('an expensive fallback must be rejected');
    } catch (failure) {
      expect(failure).toBeInstanceOf(ModelPriceCeilingError);
      expect((failure as ModelPriceCeilingError).modelId).toBe('vendor/frontier-understudy');
    }
  });

  it('accepts a model exactly at the ceiling', () => {
    const atLimit = cheapModel({ inputPerMTok: 1, outputPerMTok: 1 });
    expect(() => defineRegistry(catalogueOf(atLimit), 1)).not.toThrow();
  });

  it('rejects a model one hundredth of a cent over the ceiling', () => {
    const justOver = cheapModel({ outputPerMTok: 1.00001 });
    expect(() => defineRegistry(catalogueOf(justOver), 1)).toThrow(ModelPriceCeilingError);
  });
});

describe('defineRegistry — structural validation', () => {
  it('rejects a negative price', () => {
    expect(() => defineRegistry(catalogueOf(cheapModel({ outputPerMTok: -1 })), 1)).toThrow(
      RegistryConfigError,
    );
  });

  it('rejects an empty model id', () => {
    expect(() => defineRegistry(catalogueOf(cheapModel({ id: '  ' })), 1)).toThrow(
      RegistryConfigError,
    );
  });

  it('rejects an output cap larger than the context window', () => {
    const oversized = cheapModel({ contextWindow: 1_000, maxOutputTokens: 2_000 });
    expect(() => defineRegistry(catalogueOf(oversized), 1)).toThrow(RegistryConfigError);
  });

  it('rejects a fallback chain that loops back on itself', () => {
    const looping = cheapModel({ id: 'vendor/loop', fallback: cheapModel({ id: 'vendor/loop' }) });
    expect(() => defineRegistry(catalogueOf(looping), 1)).toThrow(RegistryConfigError);
  });

  it('refuses a price ceiling above the absolute maximum, closing the obvious back door', () => {
    // Without this, any caller could simply ask for a $999/M ceiling and validate anything.
    expect(() => defineRegistry(catalogueOf(cheapModel()), 999)).toThrow(RegistryConfigError);
  });

  it('rejects a nonsensical ceiling', () => {
    expect(() => defineRegistry(catalogueOf(cheapModel()), Number.NaN)).toThrow(
      RegistryConfigError,
    );
  });
});

describe('the shipped catalogue', () => {
  it('is entirely open-weight and cheap: no entry exceeds $1.00 per million tokens', () => {
    for (const task of AI_TASKS) {
      const model = resolveModel(task);
      expect(model.inputPerMTok, `${task} input price`).toBeLessThanOrEqual(1);
      expect(model.outputPerMTok, `${task} output price`).toBeLessThanOrEqual(1);
      expect(
        model.fallback?.outputPerMTok ?? 0,
        `${task} fallback output price`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it('covers every logical task exactly once', () => {
    expect([...AI_TASKS].sort()).toEqual([
      'classify_cheap',
      'editorial',
      'embed',
      'extract_structured',
      'grounded_chat',
    ]);
    expect(Object.keys(MODEL_REGISTRY)).toHaveLength(AI_TASKS.length);
  });

  it('uses the benchmarked models from the model strategy document', () => {
    expect(resolveModel('extract_structured').id).toBe('mistralai/mistral-small-3.2-24b-instruct');
    expect(resolveModel('grounded_chat').id).toBe('qwen/qwen3-235b-a22b-2507');
    expect(resolveModel('classify_cheap').id).toBe('mistralai/mistral-nemo');
  });

  it('keeps the measured 600-token extraction cap, because 200 truncates the schema', () => {
    expect(resolveModel('extract_structured').maxOutputTokens).toBe(600);
  });

  it('marks embeddings as self-hosted, because OpenRouter sells none', () => {
    expect(resolveModel('embed').host).toBe('self_hosted');
    expect(resolveModel('embed').outputPerMTok).toBe(0);
  });
});
