# `@atlas/ai-guard`

The only permitted route from Atlas Bible code to a language model. It exists so that no
loop, however tight, and no test run, however unattended, can drain the project's AI budget.

The OpenRouter key holds a small, fixed amount of credit. Automated walkthrough and eval
loops run against this package continuously. So the design goal is not "try to be careful
with money" — it is **make overspending structurally impossible**, and be able to point at
the code that makes it so.

---

## Contents

- [The argument](#the-argument)
- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [The pipeline](#the-pipeline)
- [Cache invalidation](#cache-invalidation)
- [What the guard does _not_ guarantee](#what-the-guard-does-not-guarantee)
- [Operations](#operations)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## The argument

Five independent layers stand between a runaway loop and the credit card. Each one alone
would fail eventually; together they do not.

| #   | Layer                             | What it stops                                                                                                                                                                                                                                 | Where                   |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | **No model id in the public API** | Feature code selecting an expensive model. `complete()` takes an `AiTask` — a closed five-member union. There is no parameter that accepts a model id, so naming a frontier model is a _compile_ error.                                       | `types.ts`, `client.ts` |
| 2   | **Registry price ceiling**        | A maintainer adding an expensive model to the catalogue. Any entry — or any _fallback_ of any entry — priced above `$1.00`/M tokens throws `ModelPriceCeilingError` when the registry is first imported, before any caller runs.              | `registry.ts`           |
| 3   | **Disk response cache**           | Repeated work costing repeated money. The cache is consulted _before_ the ledger, so a hit costs exactly zero and consumes no ceiling and no rate quota.                                                                                      | `cache.ts`              |
| 4   | **Durable spend ledger**          | Cumulative overspend. A pessimistic worst-case cost is written to disk _before_ each request and reconciled to the provider's real `usage.cost` after. Past the ceiling, every call throws `BudgetExhaustedError`. There is no override flag. | `ledger.ts`             |
| 5   | **Per-process rate cap**          | A tight loop, faster than the money runs out. A lifetime cap and a sliding-window cap, both per process.                                                                                                                                      | `ledger.ts`             |

Three properties make layer 4 hold under real conditions:

- **Reserve first, settle later.** The worst case is debited before the request goes out, so
  a process killed mid-flight leaves the ledger _pessimistic_, never optimistic.
- **Serialised.** Every read-modify-write happens in a synchronous critical section under a
  cross-process file lock. Node runs JavaScript on one thread, so a critical section with no
  `await` in it cannot interleave with another caller in the same process; the lock file
  covers the other processes.
- **Fail closed.** A ledger that cannot be read, parsed, or locked raises
  `LedgerUnavailableError`. It is never interpreted as "nothing spent yet", because that
  would let anything able to damage the file reset the budget.

And the ceiling is itself ceilinged. `ATLAS_AI_CEILING_USD` can only ever _lower_ the limit;
asking for more than `ABSOLUTE_MAX_CEILING_USD` is a startup error rather than a clamp. The
same check runs inside the `SpendLedger` constructor and inside `defineRegistry`, so the
absolute maximum holds no matter which door the guard was built through —
`new SpendLedger({ ceilingUsd: 1000 })` throws, and so does `defineRegistry(catalogue, 999)`.
Raising either constant requires editing `config.ts`, which means a diff, which means a human
sees it.

---

## Quick start

```ts
import { createAiClient, BudgetExhaustedError } from '@atlas/ai-guard';

const client = createAiClient();

try {
  const answer = await client.complete({
    task: 'grounded_chat',
    messages: [{ role: 'user', content: 'Summarise Acts 16:11-15.' }],
  });
  console.log(answer.content, answer.cacheHit, answer.costUsd);
} catch (failure) {
  if (failure instanceof BudgetExhaustedError) {
    // The ceiling has been reached. This is final; there is no retry that helps.
  }
  throw failure;
}
```

The five logical tasks are `grounded_chat`, `extract_structured`, `editorial`,
`classify_cheap`, and `embed`. Which model serves each one is decided in `src/models.ts`;
swapping a model is a one-line change to that file and nothing else in the repository has to
change with it.

`embed` currently throws `TaskNotRoutableError`: OpenRouter sells no embedding models
(verified across all 388), so embeddings will be served by a self-hosted BGE-M3 beside
pgvector. See `docs/architecture/ai-model-strategy.md` §2 job 5, question `Q-010`.

---

## Environment variables

No variable can raise a limit past its hard-coded absolute maximum; an attempt to do so is a
`ConfigInvalidError` at startup, not a clamp.

| Name                              | Description                                                                   | Format                           | Example                       | Required                                    |
| --------------------------------- | ----------------------------------------------------------------------------- | -------------------------------- | ----------------------------- | ------------------------------------------- |
| `OPENROUTER_API_KEY`              | OpenRouter API key. Read at call time, never logged or cached.                | string                           | _(never printed)_             | Yes, for real calls                         |
| `ATLAS_AI_CEILING_USD`            | Cumulative spend ceiling across every process sharing the ledger. Max `2.00`. | decimal USD                      | `0.25`                        | No — defaults to `0.50`, or `0.05` under CI |
| `ATLAS_AI_PRICE_CEILING_PER_MTOK` | Highest per-million-token price a model may be registered at. Max `1.00`.     | decimal USD                      | `0.50`                        | No — defaults to `1.00`                     |
| `ATLAS_AI_DATA_DIR`               | Root for the ledger and cache.                                                | path                             | `.cache/ai`                   | No                                          |
| `ATLAS_AI_LEDGER_PATH`            | Ledger file.                                                                  | path                             | `.cache/ai/ledger.spend.json` | No                                          |
| `ATLAS_AI_CACHE_DIR`              | Response cache root.                                                          | path                             | `.cache/ai/responses`         | No                                          |
| `ATLAS_AI_REQUEST_TIMEOUT_MS`     | Per-request timeout. Range `1000`–`120000`.                                   | integer ms                       | `30000`                       | No — defaults to `30000`                    |
| `ATLAS_AI_MAX_ATTEMPTS`           | Attempts per call, including the first. Max `5`.                              | integer                          | `3`                           | No — defaults to `3`                        |
| `ATLAS_AI_MAX_CALLS_PER_PROCESS`  | Lifetime call cap for one process. Max `5000`.                                | integer                          | `200`                         | No — defaults to `500`, or `100` under CI   |
| `ATLAS_AI_MAX_CALLS_PER_WINDOW`   | Calls allowed inside the sliding window. Max `600`.                           | integer                          | `30`                          | No — defaults to `30`                       |
| `ATLAS_AI_RATE_WINDOW_MS`         | Sliding-window length. Range `1000`–`3600000`.                                | integer ms                       | `60000`                       | No — defaults to `60000`                    |
| `ATLAS_LOG_LEVEL`                 | Structured log level.                                                         | `debug`\|`info`\|`warn`\|`error` | `info`                        | No — defaults to `info`                     |
| `CI`                              | Any truthy value selects the tighter CI defaults.                             | string                           | `true`                        | No                                          |

---

## The pipeline

```
complete(task, messages)
  │
  ├─ 1. resolveModel(task) ............ price-checked registry; no model id crosses the API
  ├─ 2. cache.read(key) ............... HIT → return, cost $0, ledger untouched
  ├─ 3. ledger.reserve(worstCase) ..... may throw BudgetExhaustedError / RateLimitExceededError
  ├─ 4. provider.createCompletion() ... under an AbortSignal timeout
  ├─ 5. ledger.commit(usage.cost) ..... the provider's own figure, not GET /credits
  └─ 6. cache.write(key, response) .... so the identical request is free forever after
```

Retries wrap steps 3–5, so **each attempt takes and settles its own reservation** and no
attempt can be charged twice. Backoff is exponential with equal jitter, capped at
`maxAttempts`. A ledger refusal is never retried: it is a decision, not a fault.

A failed attempt settles according to what can be _proven_:

| Failure                            | Settlement                        | Why                                                                    |
| ---------------------------------- | --------------------------------- | ---------------------------------------------------------------------- |
| HTTP 4xx / 5xx from the provider   | Reservation released in full      | No tokens were delivered; a measured `429 engine_overloaded` billed $0 |
| Timeout, socket reset, DNS failure | Reservation **committed** in full | The model may have generated a billed answer that never reached us     |

Metering uses each response's `usage.cost` field, never `GET /api/v1/credits`. The credits
endpoint settles asynchronously — measured lag up to a minute — so a guard polling it
under-counts in-flight spend and can be raced through the ceiling by a fast loop.

---

## Cache invalidation

The key is a SHA-256 over canonical, key-sorted JSON of everything that can change an
answer: cache generation, model id, every message, temperature, output cap, seed, and the
response schema. **Invalidation is by construction** — change any of those and the hash
changes, so a stale entry is never looked up. It is orphaned, not overwritten.

There is deliberately **no TTL**. Scripture does not change, and a TTL would silently
re-spend money on a cron.

Three explicit ways to invalidate:

1. **Bump `CACHE_SCHEMA_VERSION`** in `src/cache.ts` — a global bust of every entry at once.
   Do this when the stored entry shape changes, or when a provider's behaviour changes for
   an unchanged prompt.
2. **Delete a subtree** — `rm -rf .cache/ai/responses/extract_structured` re-runs one task;
   `rm -rf .cache/ai` resets the cache and the ledger together.
3. **Pass `bypassCache: true`** on one request. This skips the cache _read_ only. The call
   still reserves and commits against the ledger, and its result is written back. It is a
   cache control, never a budget control.

Only deterministic requests are cached: `temperature: 0`, or any temperature with an
explicit seed. Replaying a freely sampled generation as though it were fresh would
misrepresent the model, and the money saved is not worth that.

---

## What the guard does _not_ guarantee

Being precise about the edges is part of the argument.

- **Committed spend can exceed the ceiling by at most one call's over-run.** If a provider
  bills more than the pessimistic reservation — because it raised its price since the
  registry snapshot, or emitted reasoning tokens on a model marked `none` — the ledger
  records the truth rather than hiding it. Every call after that is refused. The overshoot
  is bounded by a single call and cannot compound. Asserted by
  `records an over-billed call truthfully, then refuses every call after it`.
- **The invariant that always holds** is the one asserted by `never lets exposure at
reservation time exceed the ceiling`: no reservation is granted that would take
  committed-plus-reserved past the ceiling.
- **A crashed process permanently holds its reservation.** That is deliberate — it fails
  pessimistic — and there is no automatic expiry, because an automatic expiry is a budget
  reset with a friendlier name. The remedy is a human deleting the ledger file.
- **The rate cap is per process, by design.** Money is the cross-process limit; call count
  is the local one. A hundred processes each get their own call quota but share one ceiling.
- **Nothing here stops a new `fetch` call written elsewhere.** Enforcement is architectural:
  `OpenRouterProvider` is the only module that calls a model endpoint, and `AiClient` is the
  only thing that constructs it. A bypass would be a visible diff, not an accident. A lint
  rule banning `openrouter.ai` string literals outside this package would close it further.

---

## Operations

```bash
# Inspect current spend
node -e "import('@atlas/ai-guard').then(m=>console.log(m.createSpendLedger(m.loadConfig()).snapshot()))"

# Reset everything (deliberate human action — there is no API for this)
rm -rf .cache/ai

# Run a pre-compute with a raised, still-bounded ceiling
ATLAS_AI_CEILING_USD=1.50 node scripts/precompute.mjs
```

Both `.cache/ai/` and `*.spend.json` are gitignored, so the ledger and cache never reach a
commit.

---

## Testing

```bash
pnpm test                          # whole workspace
pnpm vitest run packages/ai-guard  # this package only
```

The suite makes **zero network calls**: every test injects `FakeProvider`, and
`OpenRouterProvider` is never constructed. Named proofs of the properties above:

| Claim                                                    | Test                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A 10,000-call loop stops at a $0.10 ceiling              | `stops a loop of 10,000 calls at a $0.10 ceiling and throws BudgetExhaustedError` |
| A cache hit does not increment the ledger                | `does not increment the ledger on a cache hit`                                    |
| A crash between reserve and commit keeps the reservation | `keeps a reservation that was never committed, so a crash cannot lose the money`  |
| Concurrent calls cannot race past the ceiling            | `cannot be raced past the ceiling by concurrent callers`                          |
| An over-priced model fails loudly at registration        | `rejects a model whose output price is over the ceiling`                          |
| A retry does not double-charge                           | `does not double-charge the ledger when an attempt is retried`                    |
| The environment cannot raise the ceiling                 | `refuses a spend ceiling above the absolute maximum`                              |
| Nor can a direct constructor call                        | `refuses a ceiling above the absolute maximum, closing the obvious back door`     |

---

## Project structure

```
src/
  index.ts                  Public API. Everything else is private.
  types.ts                  The type vocabulary, including the closed AiTask union.
  errors.ts                 One class per failure mode, each with a stable code.
  config.ts                 Env parsing, and the absolute limits config cannot escape.
  models.ts                 The model catalogue — the only file naming a model.
  registry.ts               Validation and the price ceiling.
  pricing.ts                Cost arithmetic, biased pessimistic by design.
  ledger.ts                 The spend ceiling and the rate caps.
  ledger-store.ts           Ledger persistence, fail-closed reads.
  file-lock.ts              Cross-process advisory lock.
  internal-fs.ts            Atomic write-temp-then-rename, synchronous sleep.
  cache.ts                  Content-addressed response cache.
  rate-limiter.ts           The per-process call rate cap.
  retry.ts                  Backoff with jitter; what may be retried.
  request-plan.ts           Parameter defaults, routability, failure settlement policy.
  client.ts                 The pipeline.
  openrouter-provider.ts    The only code that calls a model endpoint.
  logger.ts                 Structured NDJSON to stderr.
  testing/test-support.ts   Fixtures. Not exported from the package.
```

---

## Troubleshooting

**`BudgetExhaustedError` on the first call of the day.** The ledger is cumulative and
durable. Check it with the snapshot command above. If the spend is real, that is the guard
working. If it is an orphaned reservation from a crashed run, `rm -rf .cache/ai`.

**`LedgerUnavailableError: ... is not valid JSON`.** The ledger was truncated, probably by a
hard kill during a write, though the atomic write makes that unlikely. Inspect the file
before deleting it — it is the record of what has already been spent.

**`LOCK_ACQUISITION_TIMEOUT`.** Another process is holding the ledger lock, or a crashed one
left `<ledger>.lock` behind. Stale locks break automatically after 30 seconds.

**`ModelPriceCeilingError` at import.** Someone added a model priced above `$1.00`/M to
`models.ts`. That is the guard working; pick a cheaper model.

**`OPENROUTER_API_KEY is not set`.** Expected in any environment without the key. Tests never
need it.
