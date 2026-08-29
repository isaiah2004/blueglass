# AI Model & Cost Strategy

> Scout: `model-scout` · Date: 2026-08-28 · Source data: live `GET /api/v1/models` (388 models) and
> six real paid calls against OpenRouter. Every price and every benchmark number below was measured,
> not recalled. Anything not measured is labelled **estimated** with its assumption shown.

---

## Recommended defaults

**Act on this box. The rest of the document is the evidence for it.**

| Logical task | Model id | $/M in | $/M out | Context | JSON / tools |
|---|---|---:|---:|---:|---|
| `grounded_chat` | `qwen/qwen3-235b-a22b-2507` | 0.0875 | 0.3500 | 262 144 | schema + tools |
| `extract_structured` | `mistralai/mistral-small-3.2-24b-instruct` | 0.0750 | 0.2000 | 131 072 | schema + tools |
| `editorial_longform` | `qwen/qwen3-235b-a22b-2507` | 0.0875 | 0.3500 | 262 144 | schema + tools |
| `classify_cheap` | `mistralai/mistral-nemo` | 0.0190 | 0.0300 | 131 072 | schema + tools |
| `embeddings` | **not available on OpenRouter** — self-host `BAAI/bge-m3` | 0 | 0 | 8 192 | n/a |

Four rules that ship with them:

1. **`max_tokens: 200` is too small for the enrichment schema.** Measured: all three candidates hit
   `finish_reason=length` and returned unparseable JSON at 200. Use **600** for extraction. This was
   the most expensive-to-discover finding in this exercise.
2. **Avoid `openai/gpt-oss-*` for extraction.** Reasoning is *mandatory* on these models, so reasoning
   tokens are billed on every call (measured: 93 billed reasoning tokens even at `effort: low`), and it
   was still the least accurate of the three.
3. **Pre-computing the entire New Testament costs about $0.40** (arithmetic in §5). The budget is not
   the constraint anyone assumed it was.
4. **OpenRouter sells zero embedding models.** Verified across all 388. Queued as `Q-010`.

---

## 1. Budget ledger

Read from `GET https://openrouter.ai/api/v1/credits` before and after all work.

| | `total_credits` | `total_usage` | Remaining |
|---|---:|---:|---:|
| **Start** | $5.000000 | $0.432982533 | **$4.567017** |
| **End (settled)** | $5.000000 | $0.433407502 | **$4.566593** |
| **Spent by this task** | | | **$0.000425** |

Against the $0.05 ceiling this task used **0.85% of its allowance** — 118x under budget.

Two things worth flagging:

- **The key holds more than assumed.** The task brief and `CLAUDE.md` both state "~$2 total". The key
  actually has **$5.00 provisioned with $4.57 remaining**. Someone should confirm whether $2 is a stale
  note or a deliberate self-imposed cap; §5's conclusions shift depending on which.
- **The credits ledger settles asynchronously — do not poll it as a live guard.** Read immediately after
  the last call it showed $0.000350 spent; re-read a minute later it showed **$0.000425**, which matches
  the sum of the six responses' `usage.cost` fields **exactly**. So the per-request `cost` field is
  accurate and immediate, while `/credits` lags by up to a minute. **The spend guard must meter on
  per-request `usage.cost`**, not on the credits endpoint — a guard polling `/credits` would
  systematically under-count in-flight spend and could be raced straight through the ceiling by a
  fast test loop.

---

## 2. Research — the field (no spend)

Filter applied to the live list: text output, `hugging_face_id` present (open-weight proxy), and
completion price at or below $1.00/M. **95 paid open-weight models qualify** (111 including `:free`
variants). No frontier model was called or considered.

### Job 1 — `grounded_chat`: grounded RAG with citations

Needs instruction-following strong enough to refuse when retrieved context does not support an answer,
and enough context to hold a chapter plus retrieved passages.

| Role | Model | $/M in | $/M out | Context | Structured / tools | Why |
|---|---|---:|---:|---:|---|---|
| **Primary** | `qwen/qwen3-235b-a22b-2507` | 0.0875 | 0.3500 | 262 144 | yes / yes | Largest open-weight instruct in the cheap tier (235B MoE, 22B active); non-reasoning so no hidden token tax; best refusal discipline available under $0.40/M output. |
| **Fallback** | `deepseek/deepseek-v4-flash` | 0.0868 | 0.1736 | 1 048 576 | yes / yes | Half the output price and a 1M window. Reasoning defaults to `high` — **pass `reasoning: {enabled: false}`** or it silently doubles cost. |
| **Floor** | `qwen/qwen3-30b-a3b-instruct-2507` | 0.0481 | 0.1930 | 262 144 | yes / yes | Cheapest model that still holds a citation contract. Use for dev loops. |

### Job 2 — `extract_structured`: passage to strict JSON

Highest-volume job, so quality-per-dollar matters most here. Benchmarked in §3.

| Role | Model | $/M in | $/M out | Context | Structured / tools | Why |
|---|---|---:|---:|---:|---|---|
| **Primary** | `mistralai/mistral-small-3.2-24b-instruct` | 0.0750 | 0.2000 | 131 072 | yes / yes | **Won the benchmark**: best coordinate accuracy (41 km mean error), correct emperor, tightest date range, no reasoning tax. |
| **Fallback** | `qwen/qwen3-30b-a3b-instruct-2507` | 0.0481 | 0.1930 | 262 144 | yes / yes | 36% cheaper input, ranked 2nd on accuracy (79 km). Note `max_completion_tokens` caps at 32 000. |
| **Floor** | `mistralai/mistral-nemo` | 0.0190 | 0.0300 | 131 072 | yes / yes | For schema-shape smoke tests where factual accuracy is not being asserted. |

**Rejected:** `openai/gpt-oss-120b` — cheapest sticker price in the tier ($0.037 / $0.17) but mandatory
reasoning tokens plus the worst measured geography (465 km error on one location, and a hallucinated
location not present in the passage). See §3.

### Job 3 — `editorial_longform`: chapter summaries, dual-host podcast scripts

| Role | Model | $/M in | $/M out | Context | Structured / tools | Why |
|---|---|---:|---:|---:|---|---|
| **Primary** | `qwen/qwen3-235b-a22b-2507` | 0.0875 | 0.3500 | 262 144 | yes / yes | Most capable cheap open-weight; holds voice and structure across a 1 500-token script. |
| **Fallback** | `google/gemma-4-31b-it` | 0.0900 | 0.3400 | 262 144 | yes / yes | The Gemma line is consistently the strongest prose stylist per dollar; marginally cheaper output. |
| **Floor** | `mistralai/mistral-small-3.2-24b-instruct` | 0.0750 | 0.2000 | 131 072 | yes / yes | 43% cheaper output; fine for summaries, thinner for podcast dialogue. |

Prose quality was **not** benchmarked — the spend went to the highest-volume job instead. Treat this
row as **estimated** from parameter count and model class, and re-test before committing the podcast
pipeline.

### Job 4 — `classify_cheap`: quiz generation, flashcards, badge tagging

| Role | Model | $/M in | $/M out | Context | Structured / tools | Why |
|---|---|---:|---:|---:|---|---|
| **Primary** | `mistralai/mistral-nemo` | 0.0190 | 0.0300 | 131 072 | yes / yes | **The cheapest model on all of OpenRouter that still supports structured outputs *and* tools.** Nothing else is close on output price. |
| **Fallback** | `meta-llama/llama-3.1-8b-instruct` | 0.0500 | 0.0800 | 131 072 | yes / yes | Better instruction-following if Nemo's tagging proves noisy. |
| **Floor** | `inclusionai/ling-3.0-flash` | 0.0210 | 0.0630 | 262 144 | **no** / yes | Tools but **no** structured outputs — needs manual JSON repair. Only if Nemo is unavailable. |

### Job 5 — `embeddings`

**OpenRouter offers no embedding models.** Verified programmatically: of 388 models, the set of
`architecture.modality` values contains no `*->embedding` variant, and no id or name matches
`embed|bge|e5|nomic|gte|rerank`. This is structural, not an oversight — OpenRouter is a
chat-completions router.

Self-hosting is the right answer regardless, because embeddings are the one workload that gets re-run
constantly (every re-chunk, every schema change, every retrieval experiment) and per-embedding billing
would make that painful.

| Option | Dims | Max ctx | Assessment |
|---|---:|---:|---|
| **`BAAI/bge-m3`** — recommended | 1024 | 8192 | Multilingual across 100+ languages including **Greek and Hebrew** — decisive for the word-roots feature. Long context handles whole-pericope chunks. 1024 dims sits well inside pgvector's 2000-dim HNSW limit. |
| `nomic-ai/nomic-embed-text-v1.5` | 768 | 8192 | Matryoshka — truncate to 256/512 dims to shrink the index. English-centric; weaker on Greek/Hebrew. |
| `intfloat/multilingual-e5-large` | 1024 | 512 | Solid multilingual baseline, but the 512-token context forces smaller chunks. |

Runs in the existing `docker compose` stack beside pgvector. Cost per embedding: **$0.00, forever.**
Queued as **`Q-010`** for the product owner; the recommendation is to self-host now behind a swappable
interface, and that provisional default is assumed until answered.

---

## 3. Benchmark — structured extraction (measured)

**Test.** Acts 16:11-15 (KJV, public domain) pasted inline, identical system prompt, `temperature: 0`,
and a **strict `json_schema` response format** matching the required shape. One call per model. Prompt
measured at 300-351 tokens depending on tokenizer — inside the 400-token cap.

### Pass 1 at `max_tokens: 200` — all three failed identically

| Model | Valid JSON | `finish_reason` | Latency | Completion tokens | Cost |
|---|---|---|---:|---:|---:|
| `qwen/qwen3-30b-a3b-instruct-2507` | **NO** | `length` | 1 884 ms | 200 | $0.00005320 |
| `openai/gpt-oss-120b` | **NO** | `length` | 6 348 ms | 200 (93 reasoning) | $0.00004453 |
| `mistralai/mistral-small-3.2-24b-instruct` | **NO** | `length` | 5 851 ms | 200 | $0.00006250 |

This is **not** a model failure — it is a schema-versus-budget failure. Five locations plus metadata
needs about 262 completion tokens; 200 truncates mid-object every time. Because scoring required
reading the `roman_emperor` field, which no model reached, the test was re-run at `max_tokens: 500`.

> **Deviation, declared.** The brief specified `max_tokens: 200`. It was raised to 500 for pass 2
> because the mandated scoring criteria ("factual accuracy of the coordinates **and the emperor**")
> were unobservable at 200. The hard money ceiling was never at risk: pass 2 cost $0.00019. Pass 1 is
> reported in full above rather than discarded, because "200 is too small" is a production-relevant fact.

### Pass 2 at `max_tokens: 500` — scored

| Model | Valid JSON 1st try | Emperor | Year (truth approx. AD 49-51) | Mean coord error | Latency | Cost |
|---|---|---|---|---:|---:|---:|
| **`mistralai/mistral-small-3.2-24b-instruct`** | **YES** | correct — Claudius | **"49-51"** correct | **41 km** — best | 5 910 ms | $0.00007490 |
| `qwen/qwen3-30b-a3b-instruct-2507` | **YES** | correct — Claudius | "50-52 AD" — slightly late | 79 km | 11 066 ms | $0.00010587 |
| `openai/gpt-oss-120b` | **YES** | correct — Claudius | "AD 53-54" — wrong | 131 km | 9 736 ms | $0.00008397 |

Coordinate error is haversine distance against accepted site locations: Alexandria Troas
(39.750, 26.159), Samothrace (40.450, 25.530), Neapolis / Kavala (40.938, 24.413), Philippi
(41.013, 24.286), Thyatira / Akhisar (38.917, 27.833).

Per-location error, km:

| Model | Troas | Samothrace | Neapolis | Philippi | Thyatira |
|---|---:|---:|---:|---:|---:|
| mistral-small-3.2-24b | 96 | 13 | 69 | **24** | **3** |
| qwen3-30b-a3b | 105 | **6** | 103 | 127 | 55 |
| gpt-oss-120b | **23** | 42 | **465** | 120 | **2** |

**All three named Claudius correctly** (reigned AD 41-54), so the emperor field is easy and not a
discriminator. Geography is where they separate.

### Raw outputs

`mistralai/mistral-small-3.2-24b-instruct` — provider DeepInfra, 300 in / 262 out:

```json
{
  "passage_id": "ACTS_16_11_15",
  "locations": [
    { "name": "Troas",       "coordinates": [39.95, 27.25],     "type": "city" },
    { "name": "Samothracia", "coordinates": [40.3333, 25.5],    "type": "island" },
    { "name": "Neapolis",    "coordinates": [40.6333, 23.7],    "type": "city" },
    { "name": "Philippi",    "coordinates": [40.8, 24.35],      "type": "city" },
    { "name": "Thyatira",    "coordinates": [38.9333, 27.8667], "type": "city" }
  ],
  "year_approx":   "49-51",
  "roman_emperor": "Claudius",
  "literary_type": "narrative"
}
```

`qwen/qwen3-30b-a3b-instruct-2507` — provider SiliconFlow, 303 in / 262 out:

```json
{
  "literary_type": "Biblical narrative",
  "locations": [
    { "coordinates": [40.55, 25.5],      "name": "Troas",       "type": "ancient city" },
    { "coordinates": [40.5, 25.5],       "name": "Samothracia", "type": "ancient city" },
    { "coordinates": [40.45, 25.45],     "name": "Neapolis",    "type": "ancient city" },
    { "coordinates": [40.4333, 22.9833], "name": "Philippi",    "type": "ancient city" },
    { "coordinates": [38.5, 27.5],       "name": "Thyatira",    "type": "ancient city" }
  ],
  "passage_id": "ACTS_16_11_15",
  "roman_emperor": "Claudius",
  "year_approx": "50-52 AD"
}
```

`openai/gpt-oss-120b` — provider CoreWeave, 351 in / 432 out (93 reasoning):

```json
{
  "passage_id": "ACTS_16_11_15",
  "locations": [
    { "name": "Troas (Alexandria Troas)", "coordinates": [39.9333, 26.2833], "type": "port city" },
    { "name": "Samothrace (Samothracia)", "coordinates": [40.1333, 25.2500], "type": "island sanctuary" },
    { "name": "Neapolis (Izmit, ancient Nicomedia)", "coordinates": [40.7667, 29.9333], "type": "coastal city" },
    { "name": "Philippi", "coordinates": [40.8667, 22.8667], "type": "colonial city" },
    { "name": "River Erigona (modern Erigon/Erigonas)", "coordinates": [40.8500, 22.8500], "type": "riverbank where Paul preached" },
    { "name": "Thyatira (modern Akhisar)", "coordinates": [38.9333, 27.8500], "type": "city of Lydia's origin" }
  ],
  "year_approx": "AD 53-54",
  "roman_emperor": "Claudius",
  "literary_type": "Acts of the Apostles"
}
```

### Findings that change how we build

1. **`mistral-small-3.2-24b` wins on the metric that matters.** 41 km mean error versus 79 and 131.
   For a product whose core feature is a *map*, coordinate accuracy is the whole game.
2. **gpt-oss-120b hallucinated a location.** "River Erigona ... riverbank where Paul preached" is not in
   the passage — Acts 16:13 says only "by a river side". It also misidentified Macedonian Neapolis
   (Kavala) as Anatolian Nicomedia / Izmit, 465 km away and on the wrong continent. Against pillar 3
   (zero-hallucination AI), this model is disqualified for extraction regardless of price.
3. **Even the winner is not map-ready.** A 41 km mean error will render pins in visibly wrong places.
   **Do not let the LLM emit coordinates.** Have it emit *place names only*, then resolve names to
   coordinates against an authoritative gazetteer (Pleiades, OpenBible.info) in code. Use the LLM for
   the linguistic task it is good at and a lookup table for the factual one. This is the most important
   architectural consequence of the benchmark.
4. **Provider assignment is non-deterministic and affects latency.** The same qwen model routed to
   StreamLake (1 884 ms) on one call and SiliconFlow (11 066 ms) on the next — a 5.9x swing. Pin
   `provider.order` or `provider.only` in the registry for any latency-sensitive path.
5. **Rate limits are real.** `mistral-small-3.2` returned an upstream 429 `engine_overloaded` on one
   attempt (billed $0). The client needs retry-with-backoff and a fallback model.
6. **Key ordering is not guaranteed.** Qwen's provider returned keys alphabetically. Never parse
   positionally; always parse by key.

---

## 4. Cost architecture

Backend is FastAPI (Python 3.12); the registry is shared TypeScript so client and server agree on
task names and pricing. All files below stay under the 300-line limit.

### 4.1 Model registry — `packages/shared/src/ai/registry.ts`

One module. Swapping a model is a one-line change; nothing else in the codebase names a model.

```ts
/** Logical jobs. Feature code references these, never a model id. */
export type AiTask =
  | 'grounded_chat'
  | 'extract_structured'
  | 'editorial_longform'
  | 'classify_cheap';

export interface ModelSpec {
  readonly id: string;              // OpenRouter model id
  readonly inputPerM: number;       // USD per 1M prompt tokens
  readonly outputPerM: number;      // USD per 1M completion tokens
  readonly contextWindow: number;
  readonly maxTokens: number;       // default completion cap for this task
  readonly structuredOutputs: boolean;
  readonly tools: boolean;
  /** Reasoning is billed as output. Explicitly disable where optional. */
  readonly reasoning: 'none' | 'optional' | 'mandatory';
  /** Pin providers to stabilise latency; omit to let OpenRouter route. */
  readonly providerOrder?: readonly string[];
  readonly fallback?: string;       // model id used on 429 / 5xx
}

export const MODEL_REGISTRY: Readonly<Record<AiTask, ModelSpec>> = {
  grounded_chat: {
    id: 'qwen/qwen3-235b-a22b-2507',
    inputPerM: 0.0875, outputPerM: 0.35,
    contextWindow: 262_144, maxTokens: 1_200,
    structuredOutputs: true, tools: true, reasoning: 'none',
    fallback: 'deepseek/deepseek-v4-flash',
  },
  extract_structured: {
    id: 'mistralai/mistral-small-3.2-24b-instruct',
    inputPerM: 0.075, outputPerM: 0.20,
    contextWindow: 131_072,
    maxTokens: 600,               // measured: 200 truncates, 262 typical, 600 = headroom
    structuredOutputs: true, tools: true, reasoning: 'none',
    providerOrder: ['DeepInfra'],
    fallback: 'qwen/qwen3-30b-a3b-instruct-2507',
  },
  editorial_longform: {
    id: 'qwen/qwen3-235b-a22b-2507',
    inputPerM: 0.0875, outputPerM: 0.35,
    contextWindow: 262_144, maxTokens: 2_000,
    structuredOutputs: true, tools: true, reasoning: 'none',
    fallback: 'google/gemma-4-31b-it',
  },
  classify_cheap: {
    id: 'mistralai/mistral-nemo',
    inputPerM: 0.019, outputPerM: 0.03,
    contextWindow: 131_072, maxTokens: 500,
    structuredOutputs: true, tools: true, reasoning: 'none',
    fallback: 'meta-llama/llama-3.1-8b-instruct',
  },
} as const;

/** Single pricing authority — the guard and the projector both call this. */
export function estimateCost(task: AiTask, inTok: number, outTok: number): number {
  const m = MODEL_REGISTRY[task];
  return (inTok * m.inputPerM + outTok * m.outputPerM) / 1e6;
}
```

A CI check should re-fetch `/api/v1/models` and fail the build if any registered price has risen.
Prices here are a snapshot of 2026-08-28 and providers do change them.

### 4.2 Hard spend guard — `apps/server/ai/spend_guard.py`

The requirement is that **an automated test loop cannot drain the key**. Four properties deliver that:

- **Reserve before call.** Worst-case cost (`prompt_tokens + max_tokens`) is debited *before* the
  request goes out, then reconciled to actual afterwards. A crash mid-flight leaves the ledger
  pessimistic, never optimistic.
- **Cross-process file lock.** A pytest-xdist fan-out of 16 workers shares one ledger safely.
- **Fail closed.** Ledger unreadable, corrupt, or unwritable means refuse. Never "assume zero and proceed".
- **Separate CI ceiling.** `ATLAS_AI_CEILING_USD` defaults lower under `CI=true` than on a laptop,
  so even total guard failure in CI cannot reach the whole budget.

> **As shipped.** The sketch below is the original Python design. The guard that exists is
> TypeScript — `packages/ai-guard` — and it is the authority on names and values:
> `ATLAS_AI_LEDGER_PATH` (not `ATLAS_AI_LEDGER`), `ATLAS_AI_CACHE_DIR`, and `ATLAS_AI_DATA_DIR`
> which relocates both. Defaults are `.cache/ai/ledger.spend.json` and `.cache/ai/responses`,
> both gitignored, and the ceiling defaults to **$0.50** locally and **$0.05** under CI.
> $2.00 is `ABSOLUTE_MAX_CEILING_USD`, the cap the ceiling itself cannot be raised past.
> The full table is in `packages/ai-guard/README.md`; the template is `.env.example`.

```python
from dataclasses import dataclass
from pathlib import Path
import json, os, time
from filelock import FileLock

LEDGER = Path(os.getenv("ATLAS_AI_LEDGER", ".atlas/ai-spend.json"))
CEILING = float(os.getenv("ATLAS_AI_CEILING_USD", "0.25" if os.getenv("CI") else "2.00"))


class BudgetExceeded(RuntimeError):
    """Raised instead of calling the provider. Never caught inside the AI layer."""


@dataclass(frozen=True)
class Reservation:
    request_id: str
    reserved_usd: float


class SpendGuard:
    """Durable, cross-process, fail-closed cost ceiling for all provider calls."""

    def __init__(self, ledger: Path = LEDGER, ceiling: float = CEILING) -> None:
        self._ledger = ledger
        self._lock = FileLock(f"{ledger}.lock", timeout=10)
        self._ceiling = ceiling
        self._ledger.parent.mkdir(parents=True, exist_ok=True)

    def _read(self) -> dict:
        if not self._ledger.exists():
            return {"total_usd": 0.0, "calls": 0, "entries": []}
        try:
            return json.loads(self._ledger.read_text("utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            # Fail closed: an unreadable ledger must never read as $0 spent.
            raise BudgetExceeded(f"spend ledger unreadable, refusing: {exc}") from exc

    def reserve(self, request_id: str, task: str, worst_case_usd: float) -> Reservation:
        """Debit the worst case up front. Raises BudgetExceeded rather than overspending."""
        with self._lock:
            state = self._read()
            projected = state["total_usd"] + worst_case_usd
            if projected > self._ceiling:
                raise BudgetExceeded(
                    f"call would reach ${projected:.6f} of ${self._ceiling:.2f} ceiling "
                    f"(task={task}, request_id={request_id}). Refusing."
                )
            state["total_usd"] = projected
            state["calls"] += 1
            state["entries"].append(
                {"id": request_id, "task": task, "usd": worst_case_usd,
                 "status": "reserved", "ts": time.time()}
            )
            self._ledger.write_text(json.dumps(state), "utf-8")
        return Reservation(request_id, worst_case_usd)

    def settle(self, res: Reservation, actual_usd: float) -> None:
        """Reconcile to the provider's reported usage.cost after the call returns."""
        with self._lock:
            state = self._read()
            state["total_usd"] += actual_usd - res.reserved_usd
            for e in reversed(state["entries"]):
                if e["id"] == res.request_id:
                    e.update(usd=actual_usd, status="settled")
                    break
            self._ledger.write_text(json.dumps(state), "utf-8")

    def remaining(self) -> float:
        with self._lock:
            return self._ceiling - self._read()["total_usd"]
```

Enforcement is architectural, not conventional: the OpenRouter HTTP client is private to
`apps/server/ai/`, and the only exported entry point is a `complete(task, messages)` that reserves,
calls, then settles. Feature code physically cannot reach `fetch`. A lint rule bans `openrouter.ai`
string literals outside that package.

Settle on `usage.cost` from the response. Measured in §1: it matches the settled credits ledger exactly
and is available immediately, whereas `/api/v1/credits` lags by up to a minute. Never make the ceiling
check depend on `/credits`.

### 4.3 Disk response cache — `apps/server/ai/cache.py`

**Location:** repo-local, gitignored, two-level fan-out so no directory holds more than a few
hundred files. Repo-local rather than `~/.cache` so that deleting one directory is a complete reset
and CI can restore it as a build cache. The shipped implementation writes under
`.cache/ai/responses/` (`ATLAS_AI_CACHE_DIR`), so `rm -rf .cache/ai` is that reset.

**Key:** `sha256` over canonical, key-sorted JSON of everything that can change the output:

```python
def cache_key(model: str, messages: list[dict], params: dict, schema: dict | None) -> str:
    payload = {
        "model": model,                    # includes the id, so a registry swap misses
        "messages": messages,
        "params": {k: params[k] for k in sorted(params)},  # temperature, max_tokens, seed, reasoning
        "schema": schema,                  # a schema edit must invalidate
        "v": CACHE_SCHEMA_VERSION,         # manual global bust
    }
    blob = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()
```

**Invalidation is by construction.** Any change to model id, prompt text, params, or JSON schema
produces a different hash, so stale entries are simply never read. There is deliberately **no TTL**:
scripture does not change, and a TTL would silently re-spend money on a cron. Three explicit busts:
bump `CACHE_SCHEMA_VERSION`, delete a subtree, or pass `force_refresh=True`.

**Ordering matters:** cache lookup happens **before** `SpendGuard.reserve`, so a cache hit costs
nothing and consumes no ceiling. That is what makes repeated dev and test runs exactly $0. Only
`temperature: 0` responses are cached by default; sampled generations cache under a key that includes
the seed.

Entries store the full response envelope plus `usage`, so cost analytics stay accurate on replay.

---

## 5. Budget projection

### Token assumptions — derived from measurement

| Assumption | Value | Basis |
|---|---:|---|
| Tokens per KJV verse | **38** | **Measured.** Acts 16:11-15 is 153 words; measured `prompt_tokens` 300 minus about 110 tokens of system + instruction overhead leaves 190 for 5 verses. Implies 1.24 tokens/word, consistent with KJV English. |
| Extraction unit | 5 verses | Matches the benchmarked call exactly. |
| Extraction call | 300 in / 262 out | **Measured** — both non-reasoning models returned exactly 262. |
| Chapter summary | chapter + 150 in / 600 out | *Estimated.* |
| Podcast script | chapter + 250 in / 1 500 out | *Estimated* — roughly 5 minutes of dual-host dialogue. |
| Quiz + flashcards | chapter + 120 in / 400 out | *Estimated.* |
| Acts | 28 ch / 1 007 verses | Standard. |
| New Testament | 260 ch / 7 957 verses | Standard (KJV). |

Priced with the Recommended-defaults models. Embeddings excluded — self-hosted, $0.

### (a) Acts 16 only — 40 verses

| Job | Model | Calls | In | Out | Cost |
|---|---|---:|---:|---:|---:|
| extract_structured | mistral-small-3.2-24b | 8 | 2 400 | 2 096 | $0.0006 |
| chapter_summary | qwen3-235b-a22b | 1 | 1 670 | 600 | $0.0004 |
| podcast_script | qwen3-235b-a22b | 1 | 1 770 | 1 500 | $0.0007 |
| quiz_flashcards | mistral-nemo | 1 | 1 640 | 400 | $0.0000 |
| **Total** | | **11** | **7 480** | **4 596** | **$0.0017** |

Worked example, extraction: 8 calls x (300 x $0.075/M + 262 x $0.20/M) = 8 x ($0.0000225 + $0.0000524)
= 8 x $0.0000749 = **$0.0006**.

### (b) All 28 chapters of Acts — 1 007 verses

| Job | Model | Calls | In | Out | Cost |
|---|---|---:|---:|---:|---:|
| extract_structured | mistral-small-3.2-24b | 224 | 67 200 | 58 688 | $0.0168 |
| chapter_summary | qwen3-235b-a22b | 28 | 42 466 | 16 800 | $0.0096 |
| podcast_script | qwen3-235b-a22b | 28 | 45 266 | 42 000 | $0.0187 |
| quiz_flashcards | mistral-nemo | 28 | 41 626 | 11 200 | $0.0011 |
| **Total** | | **308** | **196 558** | **128 688** | **$0.0462** |

### (c) Whole New Testament — 260 chapters, 7 957 verses

| Job | Model | Calls | In | Out | Cost |
|---|---|---:|---:|---:|---:|
| extract_structured | mistral-small-3.2-24b | 1 820 | 546 000 | 476 840 | $0.1363 |
| chapter_summary | qwen3-235b-a22b | 260 | 341 366 | 156 000 | $0.0845 |
| podcast_script | qwen3-235b-a22b | 260 | 367 366 | 390 000 | $0.1686 |
| quiz_flashcards | mistral-nemo | 260 | 333 566 | 104 000 | $0.0095 |
| **Total** | | **2 600** | **1 588 298** | **1 126 840** | **$0.3989** |

### With a realistic 1.5x retry / regeneration multiplier

| Scenario | Clean run | x1.5 | % of $4.57 remaining |
|---|---:|---:|---:|
| (a) Acts 16 | $0.0017 | $0.0026 | 0.06% |
| (b) All of Acts | $0.0462 | $0.0693 | 1.5% |
| (c) Whole NT | $0.3989 | $0.5984 | **13%** |

### The product decision this informs

**Pre-computing the whole New Testament costs about $0.60 including retries — roughly 13% of the
remaining credit.** Question `AI-01`'s provisional default assumes the budget only funds "testing +
pre-generating enrichment for the Acts 16 demo passages". That assumption is wrong by two orders of
magnitude: full-Acts enrichment is **$0.07**, essentially free.

Two consequences worth raising with the product owner:

1. **Scope is not budget-limited; it is time- and quality-limited.** The gate on shipping NT-wide
   enrichment is review effort and pipeline runtime, not dollars. `AI-01` should be re-asked in that
   light.
2. **Live grounded chat is the only real cost risk.** Pre-compute is a fixed one-time cost of about
   $0.60. Chat is unbounded and scales with users — at roughly 2 000 in / 600 out per turn on
   `qwen3-235b-a22b`, that is **$0.000385 per turn**, so the remaining credit funds about
   **11 800 chat turns**. That, not enrichment, is what the spend guard exists to protect.

---

## 6. Open items

| Id | Question | Status |
|---|---|---|
| `Q-010` | OpenRouter sells no embedding models. Self-host BGE-M3, or pay a second vendor? | **Queued.** Proceeding on the recommendation: self-host, behind a swappable interface. |
| `AI-01` | What is the ~$2 for? | Its provisional default rests on a cost assumption this document disproves — worth re-asking. |
| `AI-02` | Which open-weight models? | **Answered by this document.** Defaults benchmarked, not guessed. |
| — | The key holds $4.57, not the ~$2 documented. Stale note or self-imposed cap? | Needs confirmation. |
| — | Prose quality for `editorial_longform` was not benchmarked. | Estimated from model class. Re-test before the podcast pipeline ships. |

---

## Appendix — reproducing this

```bash
# free
curl -s https://openrouter.ai/api/v1/models
# auth required; never echo the key
curl -s -H "Authorization: Bearer $OPENROUTER_API_KEY" https://openrouter.ai/api/v1/credits
```

Benchmark: one `POST /api/v1/chat/completions` per model with `temperature: 0`,
`response_format: {type: "json_schema", json_schema: {..., strict: true}}`, `usage: {include: true}`,
and `reasoning: {effort: "low"}` for gpt-oss, whose reasoning cannot be disabled.

The key was read from the read-only prototype `.env` into an environment variable and was never
printed, logged, or written to disk. Nothing under `A:\Work\spark\spark-app` was modified.
