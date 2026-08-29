/**
 * Tests for `AiClient` — the cache is free, and refusals reach the caller.
 *
 * Purpose
 *   Prove the two ordering claims the ledger and the cache cannot prove on their own: that a
 *   cache hit never reaches the ledger, and that a budget or rate refusal reaches the caller
 *   without the provider ever being dialled.
 *
 * Retry behaviour lives in `client-retry.test.ts`, to keep both files inside the 300-line
 * limit.
 *
 * No network
 *   Every test injects `FakeProvider`. `OpenRouterProvider` is never constructed here, so
 *   this suite cannot spend money even if a ceiling were misconfigured.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BudgetExhaustedError, RateLimitExceededError, TaskNotRoutableError } from './errors';
import {
  FakeProvider,
  buildGuardedClient,
  createTemporaryWorkspace,
  scriptedSuccess,
  type TemporaryWorkspace,
} from './testing/test-support';
import type { ChatMessage } from './types';

let workspace: TemporaryWorkspace;

beforeEach(() => {
  workspace = createTemporaryWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

const MESSAGES: readonly ChatMessage[] = [{ role: 'user', content: 'Summarise Acts 16:11-15.' }];

describe('AiClient — the cache is free', () => {
  it('does not increment the ledger on a cache hit', async () => {
    const provider = new FakeProvider([scriptedSuccess('Paul sailed to Samothrace.', 0.0004)]);
    const { client, ledger } = buildGuardedClient(workspace, provider);

    const first = await client.complete({ task: 'grounded_chat', messages: MESSAGES });
    const afterFirst = ledger.snapshot();

    const second = await client.complete({ task: 'grounded_chat', messages: MESSAGES });
    const afterSecond = ledger.snapshot();

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.content).toBe(first.content);
    expect(second.costUsd).toBe(0);

    // The whole point: nothing about the ledger moved on the second call.
    expect(afterSecond.committedUsd).toBe(afterFirst.committedUsd);
    expect(afterSecond.callCount).toBe(afterFirst.callCount);
    expect(afterSecond.openReservationCount).toBe(0);
    expect(provider.callCount).toBe(1);
  });

  it('stays free across a thousand repeats of the same request', async () => {
    const provider = new FakeProvider([scriptedSuccess('cached answer', 0.0004)]);
    const { client, ledger } = buildGuardedClient(workspace, provider);

    await client.complete({ task: 'classify_cheap', messages: MESSAGES });
    const afterFirst = ledger.snapshot();

    for (let repeat = 0; repeat < 1_000; repeat += 1) {
      const result = await client.complete({ task: 'classify_cheap', messages: MESSAGES });
      expect(result.cacheHit).toBe(true);
    }

    expect(provider.callCount).toBe(1);
    expect(ledger.snapshot().committedUsd).toBe(afterFirst.committedUsd);
    expect(ledger.snapshot().callCount).toBe(afterFirst.callCount);
  }, 30_000);

  it('does not consult the cache for a freely sampled request', async () => {
    const provider = new FakeProvider([scriptedSuccess('sampled', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider);

    await client.complete({ task: 'editorial', messages: MESSAGES, params: { temperature: 0.9 } });
    const second = await client.complete({
      task: 'editorial',
      messages: MESSAGES,
      params: { temperature: 0.9 },
    });

    expect(second.cacheHit).toBe(false);
    expect(provider.callCount).toBe(2);
  });

  it('bypassCache skips the read but still charges the ledger', async () => {
    const provider = new FakeProvider([scriptedSuccess('fresh', 0.0004)]);
    const { client, ledger } = buildGuardedClient(workspace, provider);

    await client.complete({ task: 'grounded_chat', messages: MESSAGES });
    const afterFirst = ledger.snapshot().committedUsd;

    const forced = await client.complete({
      task: 'grounded_chat',
      messages: MESSAGES,
      bypassCache: true,
    });

    expect(forced.cacheHit).toBe(false);
    expect(provider.callCount).toBe(2);
    // bypassCache is a cache control, never a budget control.
    expect(ledger.snapshot().committedUsd).toBeGreaterThan(afterFirst);
  });
});

describe('AiClient — refusals reach the caller', () => {
  it('throws BudgetExhaustedError without ever dialling the provider', async () => {
    const provider = new FakeProvider([scriptedSuccess('never reached', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider, { ceilingUsd: 0 });

    await expect(client.complete({ task: 'grounded_chat', messages: MESSAGES })).rejects.toThrow(
      BudgetExhaustedError,
    );
    expect(provider.callCount).toBe(0);
  });

  it('does not retry a budget refusal into three refusals', async () => {
    const provider = new FakeProvider([scriptedSuccess('never reached', 0.0004)]);
    const { client, ledger } = buildGuardedClient(workspace, provider, {
      ceilingUsd: 0,
      maxAttempts: 3,
    });

    await expect(client.complete({ task: 'editorial', messages: MESSAGES })).rejects.toThrow(
      BudgetExhaustedError,
    );
    expect(provider.callCount).toBe(0);
    expect(ledger.snapshot().callCount).toBe(0);
  });

  it('stops a runaway loop of client calls at the ceiling', async () => {
    // Priced below the reservation, which is what a real call always is: the reservation
    // assumes the full output allowance and the model rarely uses it.
    const provider = new FakeProvider([scriptedSuccess('answer', 0.0002)]);
    const { client, ledger } = buildGuardedClient(workspace, provider, {
      ceilingUsd: 0.01,
      maxAttempts: 1,
    });

    let refusal: unknown = null;
    let completed = 0;
    for (let iteration = 0; iteration < 200; iteration += 1) {
      try {
        // A distinct prompt each time, so the cache cannot mask the ledger's behaviour.
        await client.complete({
          task: 'grounded_chat',
          messages: [{ role: 'user', content: `unique prompt ${iteration}` }],
        });
        completed += 1;
      } catch (failure) {
        refusal = failure;
        break;
      }
    }

    expect(refusal).toBeInstanceOf(BudgetExhaustedError);
    expect(completed).toBeLessThan(200);
    expect(ledger.snapshot().committedUsd).toBeLessThanOrEqual(0.01);
  }, 30_000);

  it('throws RateLimitExceededError once the per-process cap is reached', async () => {
    const provider = new FakeProvider([scriptedSuccess('answer', 0.000001)]);
    const { client } = buildGuardedClient(workspace, provider, {
      ceilingUsd: 2,
      maxCallsPerProcess: 3,
    });

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await client.complete({
        task: 'classify_cheap',
        messages: [{ role: 'user', content: `prompt ${iteration}` }],
      });
    }

    await expect(
      client.complete({
        task: 'classify_cheap',
        messages: [{ role: 'user', content: 'one more' }],
      }),
    ).rejects.toThrow(RateLimitExceededError);
  });

  it('refuses the self-hosted embedding task rather than routing it to a chat endpoint', async () => {
    const provider = new FakeProvider([scriptedSuccess('never reached', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider);

    await expect(client.complete({ task: 'embed', messages: MESSAGES })).rejects.toThrow(
      TaskNotRoutableError,
    );
    expect(provider.callCount).toBe(0);
  });
});
