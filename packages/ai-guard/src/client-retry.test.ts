/**
 * Tests for `AiClient` retries and request shaping.
 *
 * Purpose
 *   Prove that a retried call is charged once and not twice, that an attempt the provider
 *   rejected outright costs nothing, that an attempt which may have been billed is charged
 *   pessimistically, and that the caller cannot inflate the cost of a single request.
 *
 * Cache and refusal behaviour lives in `client.test.ts`.
 */

import { writeFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LedgerUnavailableError, ProviderRequestError, RequestTimeoutError } from './errors';
import {
  FakeProvider,
  buildGuardedClient,
  createTemporaryWorkspace,
  scriptedSuccess,
  type TemporaryWorkspace,
} from './testing/test-support';
import type { ChatMessage, ChatProvider, ProviderCompletion } from './types';

let workspace: TemporaryWorkspace;

beforeEach(() => {
  workspace = createTemporaryWorkspace();
});

afterEach(() => {
  workspace.cleanup();
});

const MESSAGES: readonly ChatMessage[] = [{ role: 'user', content: 'Summarise Acts 16:11-15.' }];

describe('AiClient — retries', () => {
  it('does not double-charge the ledger when an attempt is retried', async () => {
    const costUsd = 0.0004;
    const provider = new FakeProvider([
      { kind: 'failure', error: new ProviderRequestError('engine_overloaded', 429) },
      scriptedSuccess('succeeded on the second attempt', costUsd),
    ]);
    const { client, ledger } = buildGuardedClient(workspace, provider);

    const result = await client.complete({ task: 'grounded_chat', messages: MESSAGES });

    expect(provider.callCount).toBe(2);
    expect(result.costUsd).toBe(costUsd);
    // One call's cost, not two, and no reservation left dangling.
    expect(ledger.snapshot().committedUsd).toBeCloseTo(costUsd, 12);
    expect(ledger.snapshot().openReservationCount).toBe(0);
  });

  it('charges the same whether or not a retry was needed', async () => {
    const costUsd = 0.0004;
    const withoutRetry = buildGuardedClient(
      workspace,
      new FakeProvider([scriptedSuccess('first time', costUsd)]),
    );
    await withoutRetry.client.complete({ task: 'grounded_chat', messages: MESSAGES });
    const cleanRunTotal = withoutRetry.ledger.snapshot().committedUsd;

    const retryWorkspace = createTemporaryWorkspace();
    try {
      const withRetry = buildGuardedClient(
        retryWorkspace,
        new FakeProvider([
          { kind: 'failure', error: new ProviderRequestError('engine_overloaded', 429) },
          { kind: 'failure', error: new ProviderRequestError('engine_overloaded', 429) },
          scriptedSuccess('third time', costUsd),
        ]),
      );
      await withRetry.client.complete({ task: 'grounded_chat', messages: MESSAGES });

      expect(withRetry.ledger.snapshot().committedUsd).toBeCloseTo(cleanRunTotal, 12);
    } finally {
      retryWorkspace.cleanup();
    }
  });

  it('charges nothing at all for an attempt the provider rejected outright', async () => {
    const provider = new FakeProvider([
      { kind: 'failure', error: new ProviderRequestError('engine_overloaded', 429) },
    ]);
    const { client, ledger } = buildGuardedClient(workspace, provider, { maxAttempts: 3 });

    await expect(client.complete({ task: 'grounded_chat', messages: MESSAGES })).rejects.toThrow(
      ProviderRequestError,
    );

    expect(provider.callCount).toBe(3);
    expect(ledger.snapshot().committedUsd).toBe(0);
    expect(ledger.snapshot().openReservationCount).toBe(0);
  });

  it('gives up after the configured number of attempts', async () => {
    const provider = new FakeProvider([
      { kind: 'failure', error: new ProviderRequestError('overloaded', 503) },
    ]);
    const { client } = buildGuardedClient(workspace, provider, { maxAttempts: 2 });

    await expect(client.complete({ task: 'editorial', messages: MESSAGES })).rejects.toThrow(
      ProviderRequestError,
    );
    expect(provider.callCount).toBe(2);
  });

  it('does not retry a request the provider called malformed', async () => {
    const provider = new FakeProvider([
      { kind: 'failure', error: new ProviderRequestError('invalid schema', 400) },
    ]);
    const { client } = buildGuardedClient(workspace, provider, { maxAttempts: 3 });

    await expect(client.complete({ task: 'editorial', messages: MESSAGES })).rejects.toThrow(
      ProviderRequestError,
    );
    expect(provider.callCount).toBe(1);
  });

  it('commits the full reservation for a timeout, because a billed answer may be in flight', async () => {
    const provider = new FakeProvider([{ kind: 'hang' }]);
    const { client, ledger } = buildGuardedClient(workspace, provider, {
      maxAttempts: 1,
      requestTimeoutMs: 20,
    });

    await expect(client.complete({ task: 'grounded_chat', messages: MESSAGES })).rejects.toThrow(
      RequestTimeoutError,
    );

    expect(ledger.snapshot().committedUsd).toBeGreaterThan(0);
    expect(ledger.snapshot().openReservationCount).toBe(0);
  });

  it('does not cache a failed call, so the next attempt is a real one', async () => {
    const provider = new FakeProvider([
      { kind: 'failure', error: new ProviderRequestError('overloaded', 503) },
    ]);
    const { client } = buildGuardedClient(workspace, provider, { maxAttempts: 1 });

    await expect(client.complete({ task: 'editorial', messages: MESSAGES })).rejects.toThrow(
      ProviderRequestError,
    );
    await expect(client.complete({ task: 'editorial', messages: MESSAGES })).rejects.toThrow(
      ProviderRequestError,
    );
    expect(provider.callCount).toBe(2);
  });
});

describe('AiClient — request shaping', () => {
  it('sends the registry model for the task, never a caller-chosen one', async () => {
    const provider = new FakeProvider([scriptedSuccess('answer', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider);

    await client.complete({ task: 'extract_structured', messages: MESSAGES });

    expect(provider.requests[0]?.model.id).toBe('mistralai/mistral-small-3.2-24b-instruct');
  });

  it('clamps an oversized output request down to the registry cap', async () => {
    const provider = new FakeProvider([scriptedSuccess('answer', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider);

    await client.complete({
      task: 'classify_cheap',
      messages: MESSAGES,
      params: { maxOutputTokens: 500_000 },
    });

    expect(provider.requests[0]?.params.maxOutputTokens).toBe(500);
  });

  it('defaults to temperature zero, which is what makes a response cacheable', async () => {
    const provider = new FakeProvider([scriptedSuccess('answer', 0.0004)]);
    const { client } = buildGuardedClient(workspace, provider);

    await client.complete({ task: 'grounded_chat', messages: MESSAGES });

    expect(provider.requests[0]?.params.temperature).toBe(0);
  });
});

describe('AiClient — a failing ledger is not masked', () => {
  it('surfaces a commit failure rather than an InvalidReservationError from re-settling', async () => {
    // The ledger becomes unreadable between the reservation and the settlement. The caller
    // must see that, not a confusing "reservation already settled" error raised while the
    // client tried to tidy up after itself.
    let ledgerPath = '';
    const sabotagingProvider: ChatProvider = {
      name: 'sabotage',
      createCompletion(): Promise<ProviderCompletion> {
        writeFileSync(ledgerPath, 'corrupted mid-call', 'utf8');
        return Promise.resolve({
          modelId: 'test/model',
          content: 'answer',
          finishReason: 'stop',
          usage: { promptTokens: 10, completionTokens: 10, reportedCostUsd: 0.0001 },
          raw: {},
        });
      },
    };

    const { client, config } = buildGuardedClient(workspace, sabotagingProvider, {
      maxAttempts: 1,
    });
    ledgerPath = config.ledgerPath;

    await expect(client.complete({ task: 'grounded_chat', messages: MESSAGES })).rejects.toThrow(
      LedgerUnavailableError,
    );
  });
});
