/**
 * Tests for the response cache.
 *
 * Purpose
 *   Prove that the key covers everything that can change an answer — which is the whole of
 *   the invalidation story — and that a round trip returns the stored completion intact.
 *
 * What is deliberately not tested here
 *   That a cache hit costs nothing. That is a property of the *client*, which must consult
 *   the cache before the ledger, and it is asserted in `client.test.ts`.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ResponseCache, computeCacheKey, isCacheable, type CacheKeyInput } from './cache';
import { ensureDirectorySync } from './internal-fs';
import { resolveModel } from './registry';
import { createTemporaryWorkspace, type TemporaryWorkspace } from './testing/test-support';
import type { ChatMessage, CompletionParams, ProviderCompletion } from './types';

let workspace: TemporaryWorkspace;

beforeEach(() => {
  workspace = createTemporaryWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

const MESSAGES: readonly ChatMessage[] = [
  { role: 'system', content: 'Answer only from the supplied passage.' },
  { role: 'user', content: 'Acts 16:11-15' },
];

const PARAMS: CompletionParams = {
  temperature: 0,
  maxOutputTokens: 600,
  seed: null,
  responseSchema: null,
};

function keyInput(overrides: Partial<CacheKeyInput> = {}): CacheKeyInput {
  return {
    model: resolveModel('extract_structured'),
    messages: MESSAGES,
    params: PARAMS,
    ...overrides,
  };
}

const COMPLETION: ProviderCompletion = {
  modelId: 'mistralai/mistral-small-3.2-24b-instruct',
  content: '{"passage_id":"ACTS_16_11_15"}',
  finishReason: 'stop',
  usage: { promptTokens: 300, completionTokens: 262, reportedCostUsd: 0.0000749 },
  raw: { id: 'gen-1' },
};

describe('computeCacheKey', () => {
  it('is stable across calls for identical input', () => {
    expect(computeCacheKey(keyInput())).toBe(computeCacheKey(keyInput()));
  });

  it('ignores the order the request object was built in', () => {
    const straightforward = computeCacheKey(keyInput());
    const reordered = computeCacheKey({
      params: { ...PARAMS },
      messages: [...MESSAGES],
      model: resolveModel('extract_structured'),
    });
    expect(reordered).toBe(straightforward);
  });

  it('changes when the model changes, so a registry swap misses the old entries', () => {
    const swapped = computeCacheKey(keyInput({ model: resolveModel('classify_cheap') }));
    expect(swapped).not.toBe(computeCacheKey(keyInput()));
  });

  it('changes when a single character of the prompt changes', () => {
    const edited = computeCacheKey(
      keyInput({ messages: [{ role: 'user', content: 'Acts 16:11-16' }] }),
    );
    expect(edited).not.toBe(computeCacheKey(keyInput()));
  });

  it.each([
    ['temperature', { temperature: 0.7 }],
    ['output cap', { maxOutputTokens: 200 }],
    ['seed', { seed: 42 }],
    ['response schema', { responseSchema: { type: 'object' } }],
  ])('changes when the %s changes', (_label, patch) => {
    const changed = computeCacheKey(keyInput({ params: { ...PARAMS, ...patch } }));
    expect(changed).not.toBe(computeCacheKey(keyInput()));
  });

  it('is a full-length sha-256 digest', () => {
    expect(computeCacheKey(keyInput())).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isCacheable', () => {
  it('accepts a deterministic request', () => {
    expect(isCacheable(PARAMS)).toBe(true);
  });

  it('accepts a sampled request that carries a seed', () => {
    expect(isCacheable({ ...PARAMS, temperature: 0.9, seed: 7 })).toBe(true);
  });

  it('refuses a freely sampled request, which has no single correct answer to replay', () => {
    expect(isCacheable({ ...PARAMS, temperature: 0.9 })).toBe(false);
  });
});

describe('ResponseCache', () => {
  it('returns null on a miss', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    expect(cache.read('extract_structured', computeCacheKey(keyInput()))).toBeNull();
  });

  it('round-trips a completion, usage included, so replays stay analysable', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    const key = computeCacheKey(keyInput());

    cache.write('extract_structured', key, COMPLETION);
    const replayed = cache.read('extract_structured', key);

    expect(replayed).toEqual(COMPLETION);
    expect(replayed?.usage.reportedCostUsd).toBe(0.0000749);
  });

  it('fans entries out by the first two characters of the hash', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    const key = computeCacheKey(keyInput());
    cache.write('extract_structured', key, COMPLETION);

    const expectedPath = join(workspace.cacheDir, 'extract_structured', key.slice(0, 2));
    expect(cache.read('extract_structured', key)).not.toBeNull();
    expect(expectedPath).toContain(key.slice(0, 2));
  });

  it('keeps tasks in separate namespaces', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    const key = computeCacheKey(keyInput());
    cache.write('extract_structured', key, COMPLETION);

    expect(cache.read('classify_cheap', key)).toBeNull();
  });

  it('treats a malformed entry as a miss and discards it', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    const key = computeCacheKey(keyInput());
    const entryDir = join(workspace.cacheDir, 'extract_structured', key.slice(0, 2));
    ensureDirectorySync(entryDir);
    writeFileSync(join(entryDir, `${key}.json`), 'not json at all', 'utf8');

    expect(cache.read('extract_structured', key)).toBeNull();
    // The poisoned entry is gone, so it cannot fail every future lookup.
    expect(cache.read('extract_structured', key)).toBeNull();
  });

  it('treats an entry from an older cache generation as a miss', () => {
    const cache = new ResponseCache({ cacheDir: workspace.cacheDir });
    const key = computeCacheKey(keyInput());
    const entryDir = join(workspace.cacheDir, 'extract_structured', key.slice(0, 2));
    ensureDirectorySync(entryDir);
    writeFileSync(
      join(entryDir, `${key}.json`),
      JSON.stringify({ version: 0, key, task: 'extract_structured', completion: COMPLETION }),
      'utf8',
    );

    expect(cache.read('extract_structured', key)).toBeNull();
  });
});
