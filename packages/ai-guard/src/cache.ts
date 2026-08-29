/**
 * Disk response cache — the reason repeated test and dev runs cost exactly nothing.
 *
 * Purpose
 *   Store every provider response under a stable hash of everything that could change it,
 *   so a repeated request is answered from disk. A cache hit is checked *before* the ledger
 *   is touched, so it consumes no budget and no rate quota.
 *
 * Key responsibilities
 *   - Derive a stable key from model, messages, and parameters.
 *   - Decide which requests are cacheable at all.
 *   - Read and write entries atomically under `.cache/ai/responses/`.
 *
 * Invalidation story — deliberately by construction, with no TTL
 *   The key covers the model id, every message, the temperature, the seed, the output cap,
 *   and the response schema. Change any of them and the hash changes, so a stale entry is
 *   simply never looked up; it is not overwritten, it is orphaned. There is no expiry,
 *   because scripture does not change and a TTL would silently re-spend money on a cron.
 *
 *   Three ways to invalidate, all explicit:
 *     1. Bump `CACHE_SCHEMA_VERSION` below — a global bust of every entry at once. Do this
 *        when the *shape* of a stored entry changes, or when a provider's behaviour changes
 *        for an unchanged prompt.
 *     2. Delete a subtree: `rm -rf .cache/ai/responses/extract_structured` re-runs one task.
 *        `rm -rf .cache/ai` resets the cache and the ledger together.
 *     3. Pass `bypassCache: true` on one request. This skips the *read* only; the call still
 *        reserves and commits against the ledger, and its result is written back. It is a
 *        cache control, never a budget control.
 *
 * Storage layout
 *   `<cacheDir>/<task>/<first two hex chars>/<full hash>.json`. The two-level fan-out keeps
 *   any one directory to a few hundred files. Entries store the full response envelope
 *   including `usage`, so replayed traffic stays analysable after the fact.
 *
 * Dependencies
 *   `node:fs`, `node:crypto`, and `internal-fs` for the atomic write.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorCode, removeIfPresentSync, writeFileAtomicSync } from './internal-fs';
import { NULL_LOGGER, type StructuredLogger } from './logger';
import type { AiTask, CompletionParams, ChatMessage, ModelSpec, ProviderCompletion } from './types';

/**
 * Global cache generation. Bumping it orphans every existing entry at once.
 *
 * History:
 *   1 — initial format.
 */
export const CACHE_SCHEMA_VERSION = 1;

/** Hex characters of the hash used as the fan-out directory name. */
const FANOUT_PREFIX_LENGTH = 2;

/** Everything that can change a response, and therefore everything in the key. */
export interface CacheKeyInput {
  readonly model: ModelSpec;
  readonly messages: readonly ChatMessage[];
  readonly params: CompletionParams;
}

/** What gets written to disk for one entry. */
interface CacheEntry {
  readonly version: number;
  readonly key: string;
  readonly task: AiTask;
  readonly storedAtMs: number;
  readonly completion: ProviderCompletion;
}

/**
 * Compute the cache key for a request.
 *
 * The payload is serialised with sorted keys so that two structurally identical requests
 * hash identically regardless of the order their fields were built in.
 *
 * @param input Model, messages, and parameters for the request.
 * @returns A 64-character lowercase SHA-256 hex digest.
 */
export function computeCacheKey(input: CacheKeyInput): string {
  const payload = {
    v: CACHE_SCHEMA_VERSION,
    model: input.model.id,
    messages: input.messages.map((message) => ({ role: message.role, content: message.content })),
    temperature: input.params.temperature,
    maxOutputTokens: input.params.maxOutputTokens,
    seed: input.params.seed,
    // A schema edit must invalidate: the same prompt under a different schema is a
    // different request and will produce a differently shaped answer.
    schema: input.params.responseSchema ?? null,
  };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

/**
 * Serialise a value to JSON with object keys in sorted order.
 *
 * `JSON.stringify` preserves insertion order, which would make the key depend on how the
 * request object happened to be constructed. Sorting removes that dependency.
 *
 * @param value Any JSON-serialisable value.
 * @returns Canonical JSON text.
 */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (typeof nested !== 'object' || nested === null || Array.isArray(nested)) {
      return nested;
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(nested).sort()) {
      sorted[key] = (nested as Record<string, unknown>)[key];
    }
    return sorted;
  });
}

/**
 * Whether a request may be cached.
 *
 * Deterministic requests only: `temperature: 0`, or any temperature with an explicit seed.
 * Replaying a freely sampled generation as though it were fresh would misrepresent the
 * model's behaviour, and the money saved is not worth that.
 *
 * @param params Resolved completion parameters.
 * @returns True when the response may be stored and replayed.
 */
export function isCacheable(params: CompletionParams): boolean {
  return params.temperature === 0 || params.seed !== null;
}

/** Narrow an unknown parsed value to a `CacheEntry`. */
function isCacheEntry(candidate: unknown): candidate is CacheEntry {
  if (typeof candidate !== 'object' || candidate === null) {
    return false;
  }
  const entry = candidate as Partial<Record<keyof CacheEntry, unknown>>;
  if (entry.version !== CACHE_SCHEMA_VERSION || typeof entry.key !== 'string') {
    return false;
  }
  const completion = entry.completion;
  if (typeof completion !== 'object' || completion === null) {
    return false;
  }
  const shape = completion as Partial<Record<keyof ProviderCompletion, unknown>>;
  return typeof shape.content === 'string' && typeof shape.modelId === 'string';
}

/**
 * Content-addressed store for provider responses.
 *
 * Owns: entry layout, serialisation, and read/write. Does not own: the decision to consult
 * the cache, which belongs to `AiClient`, nor any notion of cost — a cache hit is free by
 * construction because this class never touches the ledger.
 */
export class ResponseCache {
  readonly #cacheDir: string;
  readonly #logger: StructuredLogger;

  constructor(options: { readonly cacheDir: string; readonly logger?: StructuredLogger }) {
    this.#cacheDir = options.cacheDir;
    this.#logger = options.logger ?? NULL_LOGGER;
  }

  /**
   * Look up a stored response.
   *
   * @param task Logical task, used only for the directory name.
   * @param key  Key from `computeCacheKey`.
   * @returns The stored completion, or `null` on a miss.
   */
  read(task: AiTask, key: string): ProviderCompletion | null {
    const entryPath = this.#pathFor(task, key);
    let text: string;
    try {
      text = readFileSync(entryPath, 'utf8');
    } catch (readError) {
      if (errorCode(readError) === 'ENOENT') {
        return null;
      }
      // An unreadable cache entry is a miss, never a failure: the worst case is that the
      // call is made again and paid for again, which the ledger still bounds.
      this.#logger.warn('AI cache entry could not be read', { task, cache_key: key });
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
    if (!isCacheEntry(parsed)) {
      this.#logger.warn('AI cache entry was malformed and has been discarded', {
        task,
        cache_key: key,
      });
      this.#discard(entryPath, task, key);
      return null;
    }
    return parsed.completion;
  }

  /**
   * Store a response.
   *
   * @param task       Logical task.
   * @param key        Key from `computeCacheKey`.
   * @param completion Response to store, including its `usage` block.
   */
  write(task: AiTask, key: string, completion: ProviderCompletion): void {
    const entry: CacheEntry = {
      version: CACHE_SCHEMA_VERSION,
      key,
      task,
      storedAtMs: Date.now(),
      completion,
    };
    try {
      writeFileAtomicSync(this.#pathFor(task, key), `${JSON.stringify(entry, null, 2)}\n`);
    } catch (writeError) {
      // The call already succeeded and the money is already spent. Failing here would throw
      // away a paid response, which is strictly worse than not caching it.
      const reason = writeError instanceof Error ? writeError.message : 'unknown';
      this.#logger.warn('AI cache entry could not be written; response not stored', {
        task,
        cache_key: key,
        reason,
      });
    }
  }

  /** Remove a poisoned entry so it cannot fail every future lookup. */
  #discard(entryPath: string, task: AiTask, key: string): void {
    try {
      removeIfPresentSync(entryPath);
    } catch (removeError) {
      const reason = removeError instanceof Error ? removeError.message : 'unknown';
      this.#logger.warn('Malformed AI cache entry could not be removed', {
        task,
        cache_key: key,
        reason,
      });
    }
  }

  /** Resolve the on-disk path for one entry. */
  #pathFor(task: AiTask, key: string): string {
    return join(this.#cacheDir, task, key.slice(0, FANOUT_PREFIX_LENGTH), `${key}.json`);
  }
}
