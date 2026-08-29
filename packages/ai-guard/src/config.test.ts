/**
 * Tests for configuration loading.
 *
 * Purpose
 *   Prove that the environment can only ever move the money limits *downward*. A budget
 *   ceiling a caller can raise is not a ceiling, so these are the tests that keep
 *   `ATLAS_AI_CEILING_USD` from becoming an override flag by another name.
 */

import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_MAX_ATTEMPTS,
  ABSOLUTE_MAX_CEILING_USD,
  ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK,
  loadConfig,
} from './config';
import { ConfigInvalidError } from './errors';

describe('loadConfig — limits the environment cannot raise', () => {
  it('refuses a spend ceiling above the absolute maximum', () => {
    expect(() => loadConfig({ ATLAS_AI_CEILING_USD: '500' })).toThrow(ConfigInvalidError);
  });

  it('refuses a spend ceiling one cent above the absolute maximum', () => {
    const justOver = String(ABSOLUTE_MAX_CEILING_USD + 0.01);
    expect(() => loadConfig({ ATLAS_AI_CEILING_USD: justOver })).toThrow(ConfigInvalidError);
  });

  it('allows the environment to lower the ceiling', () => {
    expect(loadConfig({ ATLAS_AI_CEILING_USD: '0.02' }).ceilingUsd).toBe(0.02);
  });

  it('refuses a model price ceiling above $1.00 per million tokens', () => {
    const justOver = String(ABSOLUTE_MAX_MODEL_PRICE_PER_MTOK + 0.5);
    expect(() => loadConfig({ ATLAS_AI_PRICE_CEILING_PER_MTOK: justOver })).toThrow(
      ConfigInvalidError,
    );
  });

  it('refuses an attempt count above the absolute maximum, because retries multiply cost', () => {
    const justOver = String(ABSOLUTE_MAX_ATTEMPTS + 1);
    expect(() => loadConfig({ ATLAS_AI_MAX_ATTEMPTS: justOver })).toThrow(ConfigInvalidError);
  });

  it('refuses a per-process call cap above the absolute maximum', () => {
    expect(() => loadConfig({ ATLAS_AI_MAX_CALLS_PER_PROCESS: '10000000' })).toThrow(
      ConfigInvalidError,
    );
  });
});

describe('loadConfig — validation', () => {
  it('refuses a ceiling that is not a number, rather than falling back to the default', () => {
    expect(() => loadConfig({ ATLAS_AI_CEILING_USD: 'unlimited' })).toThrow(ConfigInvalidError);
  });

  it('refuses a negative ceiling', () => {
    expect(() => loadConfig({ ATLAS_AI_CEILING_USD: '-1' })).toThrow(ConfigInvalidError);
  });

  it('treats an empty value as absent', () => {
    expect(loadConfig({ ATLAS_AI_CEILING_USD: '   ' }).ceilingUsd).toBe(loadConfig({}).ceilingUsd);
  });
});

describe('loadConfig — defaults', () => {
  it('is far tighter under CI than on a developer machine', () => {
    const local = loadConfig({});
    const continuousIntegration = loadConfig({ CI: 'true' });

    expect(continuousIntegration.ceilingUsd).toBeLessThan(local.ceilingUsd);
    expect(continuousIntegration.maxCallsPerProcess).toBeLessThan(local.maxCallsPerProcess);
  });

  it('never defaults to anything close to the whole budget', () => {
    expect(loadConfig({}).ceilingUsd).toBeLessThanOrEqual(ABSOLUTE_MAX_CEILING_USD / 2);
  });

  it('does not treat CI=false or CI=0 as continuous integration', () => {
    expect(loadConfig({ CI: 'false' }).ceilingUsd).toBe(loadConfig({}).ceilingUsd);
    expect(loadConfig({ CI: '0' }).ceilingUsd).toBe(loadConfig({}).ceilingUsd);
  });

  it('puts the ledger and cache under the gitignored .cache/ai directory', () => {
    const config = loadConfig({});
    expect(config.ledgerPath).toContain('.cache/ai');
    expect(config.cacheDir).toContain('.cache/ai');
  });
});
