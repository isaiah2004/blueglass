/**
 * Shared fixtures for the `@atlas/ai-guard` test suite.
 *
 * Purpose
 *   Give every test an isolated temporary ledger and cache directory, a configuration that
 *   is fast and cheap rather than production-shaped, and a fake provider. Nothing here
 *   performs network I/O, so importing it can never cost money.
 *
 * Key responsibilities
 *   - `createTemporaryWorkspace` — a throwaway directory with ledger and cache paths in it.
 *   - `createTestConfig` — an `AiGuardConfig` built directly rather than through `loadConfig`,
 *     so tests can use timeouts and ceilings far below the production minimums.
 *   - `FakeProvider` — a scripted `ChatProvider` that records what it was asked.
 *   - `buildGuardedClient` — a fully wired `AiClient` over that workspace and provider.
 *   - `buildTestLedger` — a `SpendLedger` over that workspace with the rate caps stood down.
 *
 * Not exported from the package
 *   This module is deliberately absent from `src/index.ts`. It exists for tests only and
 *   must never be reachable from shipped code.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ResponseCache } from '../cache';
import { createAiClient, type AiClient } from '../client';
import { SpendLedger, type SpendLedgerOptions } from '../ledger';
import { NULL_LOGGER } from '../logger';
import type { AiGuardConfig } from '../config';
import type { ChatProvider, ProviderCompletion, ProviderRequest, TokenUsage } from '../types';

/** An isolated directory plus the two paths the guard writes inside it. */
export interface TemporaryWorkspace {
  readonly rootDir: string;
  readonly ledgerPath: string;
  readonly cacheDir: string;
  /** Remove the directory and everything in it. */
  cleanup(): void;
}

/**
 * Create a throwaway workspace under the OS temp directory.
 *
 * @returns Paths and a cleanup function; call `cleanup()` in `afterEach`.
 */
export function createTemporaryWorkspace(): TemporaryWorkspace {
  const rootDir = mkdtempSync(join(tmpdir(), 'atlas-ai-guard-'));
  return {
    rootDir,
    ledgerPath: join(rootDir, 'ledger.spend.json'),
    cacheDir: join(rootDir, 'responses'),
    cleanup: () => {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}

/**
 * Build a configuration for tests.
 *
 * Constructed directly rather than through `loadConfig` so a test can use a 10ms timeout or
 * a $0 ceiling, both of which `loadConfig` rightly refuses in production.
 *
 * @param workspace Temporary workspace supplying the paths.
 * @param overrides Fields to change.
 * @returns A complete configuration.
 */
export function createTestConfig(
  workspace: TemporaryWorkspace,
  overrides: Partial<AiGuardConfig> = {},
): AiGuardConfig {
  return {
    ledgerPath: workspace.ledgerPath,
    cacheDir: workspace.cacheDir,
    ceilingUsd: 0.1,
    modelPriceCeilingPerMTok: 1,
    requestTimeoutMs: 50,
    maxAttempts: 3,
    maxCallsPerProcess: 100_000,
    maxCallsPerWindow: 100_000,
    rateWindowMs: 60_000,
    ...overrides,
  };
}

/** Build a `TokenUsage` with sensible defaults. */
export function usage(overrides: Partial<TokenUsage> = {}): TokenUsage {
  return { promptTokens: 300, completionTokens: 262, reportedCostUsd: 0.0000749, ...overrides };
}

/** One scripted outcome: either a response or a failure to throw. */
export type ScriptedOutcome =
  | { readonly kind: 'success'; readonly completion: ProviderCompletion }
  | { readonly kind: 'failure'; readonly error: Error }
  | { readonly kind: 'hang' };

/** Build a scripted success with the given cost. */
export function scriptedSuccess(content: string, costUsd: number | null): ScriptedOutcome {
  return {
    kind: 'success',
    completion: {
      modelId: 'test/model',
      content,
      finishReason: 'stop',
      usage: usage({ reportedCostUsd: costUsd }),
      raw: { test: true },
    },
  };
}

/**
 * A `ChatProvider` that replays a script and records every call.
 *
 * Owns: nothing but its script and its call log. It exists so the whole package can be
 * exercised without a network, which is what guarantees the test suite costs $0.
 */
export class FakeProvider implements ChatProvider {
  readonly name = 'fake';
  readonly requests: ProviderRequest[] = [];
  readonly #outcomes: readonly ScriptedOutcome[];
  #nextIndex = 0;

  constructor(outcomes: readonly ScriptedOutcome[]) {
    this.#outcomes = [...outcomes];
  }

  /** Number of times the provider was actually reached. */
  get callCount(): number {
    return this.requests.length;
  }

  /**
   * Return the next scripted outcome.
   *
   * @param request Resolved request, recorded for assertions.
   * @param signal  Abort signal; a `hang` outcome rejects when it fires.
   * @returns The scripted completion.
   * @throws The scripted error, when the next outcome is a failure.
   */
  createCompletion(request: ProviderRequest, signal: AbortSignal): Promise<ProviderCompletion> {
    this.requests.push(request);
    // Past the end of the script the last outcome repeats, so a test that only cares about
    // the first two attempts does not have to spell out a third.
    const next = this.#outcomes[Math.min(this.#nextIndex, this.#outcomes.length - 1)];
    this.#nextIndex += 1;
    if (next === undefined) {
      return Promise.reject(new Error('FakeProvider was constructed with an empty script.'));
    }
    if (next.kind === 'failure') {
      return Promise.reject(next.error);
    }
    if (next.kind === 'hang') {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(new Error('aborted'));
        });
      });
    }
    return Promise.resolve(next.completion);
  }
}

/** A fully wired client plus the ledger behind it, so a test can assert on both. */
export interface GuardedClientFixture {
  readonly client: AiClient;
  readonly ledger: SpendLedger;
  readonly config: AiGuardConfig;
}

/**
 * Assemble an `AiClient` over a temporary workspace and a fake provider.
 *
 * Sleep is a no-op and jitter is fixed, so retry tests finish in microseconds and produce
 * the same timings on every run.
 *
 * @param workspace       Temporary workspace for the ledger and cache.
 * @param provider        Scripted provider.
 * @param configOverrides Configuration fields to change.
 * @returns The client, its ledger, and the configuration they share.
 */
export function buildGuardedClient(
  workspace: TemporaryWorkspace,
  provider: ChatProvider,
  configOverrides: Partial<AiGuardConfig> = {},
): GuardedClientFixture {
  const config = createTestConfig(workspace, configOverrides);
  const ledger = new SpendLedger({
    ledgerPath: config.ledgerPath,
    ceilingUsd: config.ceilingUsd,
    maxCallsPerProcess: config.maxCallsPerProcess,
    maxCallsPerWindow: config.maxCallsPerWindow,
    rateWindowMs: config.rateWindowMs,
  });
  const client = createAiClient({
    provider,
    ledger,
    config,
    logger: NULL_LOGGER,
    cache: new ResponseCache({ cacheDir: config.cacheDir }),
    sleep: () => Promise.resolve(),
    randomSource: () => 0.5,
  });
  return { client, ledger, config };
}

/**
 * Build a `SpendLedger` over a temporary workspace, with the rate caps out of the way.
 *
 * Defaults put the call caps far beyond anything a test will reach, so a test that means to
 * exercise the *money* ceiling is never stopped by the rate cap instead. Tests of the rate
 * cap lower them explicitly.
 *
 * @param workspace Temporary workspace supplying the ledger path.
 * @param overrides Ledger options to change.
 * @returns A ready ledger.
 */
export function buildTestLedger(
  workspace: TemporaryWorkspace,
  overrides: Partial<SpendLedgerOptions> = {},
): SpendLedger {
  return new SpendLedger({
    ledgerPath: workspace.ledgerPath,
    ceilingUsd: 0.1,
    maxCallsPerProcess: 1_000_000,
    maxCallsPerWindow: 1_000_000,
    rateWindowMs: 60_000,
    ...overrides,
  });
}
