# Decision log

Every decision that shapes this project, why it was taken, and who took it.

**Curated by hand.** The machine-generated full dump of the human's 98 answers lives in
[`ANSWERS.md`](ANSWERS.md) (regenerate with `node tools/question-hub/answers.mjs --all`).
Provisional calls still awaiting confirmation live in [`ASSUMPTIONS.md`](ASSUMPTIONS.md).

Read this file before starting any task. If a decision here contradicts something you
were about to build, this file wins.

| | |
|---|---|
| Questionnaire | 98 of 98 answered on 2026-08-29 |
| By hand | 83 · bulk-accepted 4 · imported from chat 11 |
| Overrode the recommendation | **26** |
| Flagged for re-check | 0 |

---

## 1 · Standing constraints

Stated directly by the product owner. These outrank every recommendation.

1. `A:\Work\gt\ControlSight` and `A:\Work\spark\spark-app` are **read-only**. Never modify.
2. **Cheap open-weight models only. No large frontier models.** The OpenRouter key holds
   $4.57; a $2 ceiling is enforced in code as a deliberate self-imposed cap (`Q-020`).
3. **Install packages, never software.** No new binaries, no system tooling, no browser
   downloads. Playwright drives the already-installed Chrome via `channel: 'chrome'`.
4. **Leave a log of every decision** — this file.
5. Done means **production-ready, proven by clicking through the real UI**, not by tests alone.
6. Run autonomously; do not stall waiting on a human.

---

## 2 · The 26 overrides — where the plan changed

These reversed a recommendation, so they are the decisions most likely to be built wrong
from memory. Grouped by how much they move.

### Major — these changed the architecture

| # | Decision | What it overturned | Consequence |
|---|---|---|---|
| `T-01` `T-04` | **Web is a first-class target**, alongside Android device. | Web was assumed to be a testing convenience. | Rules out native-only libraries. `react-native-mmkv` has no web build and must never be imported from shared code. Doubles the UI QA surface. |
| `Q-006` | **Full phone / tablet / desktop parity** with the Flutter app. | Recommendation was phone-only. | Reinstates the resizable context rail, the two-pane split, the icon rail and the ≥600/≥1100 dp breakpoints — roughly a third of the prototype's UI code that the port map had proposed deleting. Port-map risk #5 (no split pane in RN) is **live again**, not evaporated. |
| `A-03` | **Streaks, journal and flashcards sync across devices.** | Local-only was assumed for v1. | Needs a real sync model with conflict resolution, not a local store. Combined with `A-01` (anonymous device id first), identity must be portable from day one. |
| `J-01` | **Client-side encryption before sync; the server holds ciphertext only.** | Device-local secure storage was assumed. | True end-to-end encryption for journal entries. Key management becomes a first-class design problem. The server can never read, search, or index a journal entry. |
| `Q-010` | **Pay for a separate embedding API** (OpenAI `text-embedding-3-small`). | Recommendation was self-hosting `bge-m3` for $0. | Accepts a second vendor and a second key. Matches what the prototype already used. |
| `Q-009` | **Store both, denormalised**: verse rows for badges, passage rows for the map/timeline canvas. | Recommendation was verse-keyed plus a pericope table. | More storage and a consistency obligation between the two shapes, in exchange for no join on the read path the user actually feels. |

### Moderate — these changed scope or behaviour

| # | Decision | Note |
|---|---|---|
| `P-03` | **Bible *and* Journal** must both genuinely work. | Journal is promoted out of "nice to have". With `J-01` and `A-03`, it is now one of the harder features, not one of the easier ones. |
| `ST-01` | **Executive Briefings** are real, alongside grounded chat. | A second generation pipeline, not just retrieval. |
| `G-01` | A day completes on **just opening and reading the passage**. | Much lower bar than the PRD's 3-step loop. The 3 steps still exist as *content*; they no longer gate the streak. |
| `G-03` | Grace Savers are earned by **bonus activities** (quiz streaks, extra chapters). | Not automatic monthly grants, not consecutive-day accrual. |
| `G-04` | Local notifications **and** server pushes. | Needs a push service and device-token storage. |
| `AU-01` `AU-04` | Audio is **stubbed**: player UI with hand-made sample tracks, foreground only. | No TTS pipeline, no background audio, no lock-screen controls. Audio drops down the build order. |
| `Q-01` | **All four test layers**: unit, component, API integration, E2E web. | Not just E2E. |
| `Q-04` | Walkthroughs drive the **web build in a headless browser**, continuously. | Not the device. Cheap enough to run constantly, which is the point. |
| `OP-01` | **No CI.** Local checks only. | Quality gates run locally; nothing is wired to a remote. |
| `OP-03` | **Full ControlSight versioning**: a CHANGELOG entry and version bump for every change. | Strictest option chosen deliberately. |
| `W-02` | **As many agents as the work allows.** | Parallelism is authorised; coherence is my problem to manage. |
| `Q-007` | **Server-side only — never redistribute the database**, so share-alike never triggers. | Elegant: it dissolves the CC BY-SA licence problem without dropping a single source. Constrains us to server-delivered enrichment rather than a fully bundled offline corpus. |

### Design direction

| # | Decision |
|---|---|
| `D-01` | Dark by default. **Light mode must actually ship**, not merely be made possible by the tokens. Every component verified in both. |
| `D-02` | *"Take inspiration. But make it a professional app."* The mockups are a reference, not a spec. Professional polish outranks pixel fidelity. |
| `D-03` | **Source Serif 4** for scripture — the prototype's serif, chosen over a mockup match. |
| `D-05` | *"No excessive glass stuff tho textures would be nice."* Rein in the glassmorphism the PRD leans on; the prototype's procedural textures (`patterns.dart`) are worth reviving. Port-map risk #6 moves from "probably drop" to "wanted". |

### Delegated back to me

| # | Decision |
|---|---|
| `M-04` | Geographic data source — *"Let's have agents look into this."* Already actioned: OpenBible geocoding acquired and validated. **Note the trap:** `ancient.jsonl` carries no coordinates; they require a join to `modern.jsonl`. |
| `AI-02` | *"Whatever spark app was using."* — **see the conflict below.** |

---

## 3 · Conflicts, and how they were resolved

### C-1 · `AI-02` names a frontier model, contradicting a standing constraint

**The conflict.** `AI-02` answers "whatever spark app was using". That repo holds two
different configs: `server/.env` and `server/app/config.py:17` both set
`anthropic/claude-sonnet-4.5`; `.env.local` sets `openai/gpt-4o-mini`. Neither is
open-weight, and the first is precisely the "large frontier" class ruled out twice, in
the same breath as "the key only has $2".

**Resolution — proceed on the benchmarked open-weight defaults.** Reasons:
1. The standing constraint was stated twice, emphatically, and framed the whole task.
   A one-line answer meaning "don't overthink it" is unlikely to be a deliberate reversal.
2. The answer is ambiguous on its own terms — the repo contains two different models.
3. The open-weight picks are **cheaper and measurably better** on our actual prompt:
   `mistral-small-3.2-24b` scored 41 km mean coordinate error against `gpt-oss-120b`'s
   131 km, and the latter invented a location absent from the passage — a direct pillar-3
   violation.

**RESOLVED by the product owner in `AI-02b`: use `openai/gpt-4o-mini`.**
Cheap ($0.15 / $0.60 per M), not open-weight, comfortably under the guard's $1.00 ceiling,
and it is what the prototype's Next.js config actually ran. The `anthropic/claude-sonnet-4.5`
reading is dead — the price ceiling would refuse it at import time regardless.

Applied to **`grounded_chat`** and **`editorial`**. Deliberately **not** applied to
`extract_structured`, which stays on `mistralai/mistral-small-3.2-24b-instruct`: the
question was asked and answered about the *chat* model — the role the Next.js config used
gpt-4o-mini for — and extraction is a different job with a measured benchmark behind it
(41 km mean coordinate error against 79 and 131). Flagged to the product owner; a one-line
change if they want extraction moved too.

Both prose tasks keep an **open-weight fallback** (`deepseek-v4-flash`, `gemma-4-31b-it`),
so if OpenAI is unreachable or rate-limits, chat degrades to a model with no second-vendor
dependency rather than failing. Locked by tests in `packages/ai-guard/src/registry.test.ts`.

**Consequence:** a second vendor and a second key are now on the critical path for chat.
Combined with `Q-010` (paid OpenAI embeddings), OpenAI is now a hard dependency for both
chat and retrieval.

### C-2 · `D-01`'s stored answer did not match its own option string

Discovered by the hub migration. The recorded answer contained a curly apostrophe
(`so it's possible`) while the option carried a straight one, because the questionnaire
was re-seeded with re-typed wording after the answer was given. A naive migration would
have demoted a deliberately-picked option to free text and the fleet would have read it as
an unanswered question. The migration's normalised second-pass matching caught it
(`match: "normalised"`, `needsReview: false`). **Lesson: never re-word a question that
already has an answer without re-validating the match.**

### C-3 · The mockup palette fails its own accessibility bar

`ink.tertiary` (`#5D6A7D`) measures **3.36:1** on `bg.card`, under WCAG AA's 4.5:1, and
`design-language.md` assigns it to exactly the 9–11 pt metadata where that matters. Caught
by a contrast test, not by eye. Resolved per `Q-017`: `ink.secondary` for small metadata,
`ink.tertiary` only for large text, icons and rules. Locked by
`apps/mobile/src/theme/colors.contrast.test.ts`.

### C-4 · The PRD's badge count disagrees with itself

The prose says "10 Embedded Feature Badges" but lists **11** marks, and
`design-language.md` assigns a hue to only 10 — Lineage has none. Resolved per `Q-018`:
**eleven** badges, Lineage kept, and the design owes it a hue.

---

## 4 · Findings that changed the plan

Discovered by investigation, not decided. Each overturned a planning assumption.

| Finding | Impact |
|---|---|
| **`bible-enrichment/` holds zero records.** It is 147 KB of research cataloguing 52 datasets — an excellent sourcing map, but no content. | Nobody plans a milestone around it. |
| **Manuscript and Chiasm *are* sourceable.** STEPBible TAGNT (CC BY 4.0, ~3,202 NT variants) and Murai's *Literary Structure* (CC BY 4.0, 10,304 chiastic nodes, whole canon). | Badge coverage went from 6 sourceable to **8 of 11**. The roadmap's "hand-curate 25 variants" and "never generate chiasm" plans are both obsolete. |
| **Only 3D City and Meditate are genuinely dataset-less.** 3D City's closest candidate is CC BY-NC-ND (fails twice over); nothing openly licensed exists for Meditate. | Documented as confirmed negatives so nobody searches again. |
| **The budget was never the constraint.** Whole-NT pre-compute measures **$0.40**; the key holds $4.57. | Scope is limited by review capacity, not money. |
| **Models must never emit coordinates.** Best extractor still averaged **41 km** error. | Models emit place *names*; code resolves them against a gazetteer. |
| **`/api/v1/credits` settles asynchronously** — up to a minute late. | The spend guard meters on each response's `usage.cost`. A guard polling credits could be raced through its ceiling by a fast loop. |
| **Theographic `People.csv` is weak.** Only 286 of 3,069 rows published; its ambiguity flag misses real cases, linking the Acts 16 seller of purple to a Genesis 36 genealogy with an *empty* flag — inside MVP scope. | Lineage needs curation, not bulk ingest. |
| **The prototype maps only 3 of 66 books** between name and number, so a note outside Proverbs/Matthew/Ruth stores `book_number: 0`. | A real data-corruption bug. Fixed in `packages/shared`, with all 66 books round-trip tested. |
| **The prototype's RAG relevance scores are wrong** — Chroma persisted with `l2` distance while the code computes `1.0 - distance` as if cosine. | Must be rebuilt, independent of the pgvector migration. |
| **The prototype has no real auth.** Every `/me/*` route resolves to the literal string `dev-user`, and `PUT /study/{book}/{chapter}` is an unauthenticated write that also injects into the RAG index. | Must close before any exposure. Do not port the stub. |

---

## 5 · Architecture decisions

Taken by the fleet, within the constraints above.

| # | Decision | Rationale |
|---|---|---|
| A-1 | **Inline badges are a `<View>` inside the verse's `<Text>`.** | The one spike that could have broken the product. Renders correct pill shapes on every platform, wraps atomically, preserves line rhythm. Concession: colour emoji cannot be tinted, so badge glyphs become monochrome SVG paths (`Q-021`). Second concession: `backgroundColor` on nested text is square **everywhere, including iOS** — the port map was wrong about iOS — so search highlighting must be rectangular. |
| A-2 | **SSE parser is a pure function with seven named rules**, transport-agnostic. | RN cannot stream `response.body` on Android. Isolating the parser from the transport means the transport can be swapped without retesting the protocol. Chunk boundaries that split mid-event and mid-UTF-8 each have a test. |
| A-3 | **Streaming drafts live in an isolated store, committed once per animation frame.** | The prototype fires a notify per token and re-renders its entire shell. Flutter absorbs it; React would not. |
| A-4 | **Kind is semantics; layout and attachments are presentation.** (Question Hub) | Collapsed three proposed question kinds into configuration, keeping the set small enough to test exhaustively. |
| A-5 | **The hub's media endpoint is a projection of the question log, not a file browser.** | Eight ordered gates, the decisive one being *referenced-only*: a file nobody asked about is 404 even if every other check passes. `.svg` excluded deliberately — it executes script on direct navigation. |
| A-6 | **The hub server keeps zero runtime dependencies, forever.** | The entire fleet depends on it. It must never fail to start because of a package install. |
| A-7 | **Every AI call goes through the guard and cache; no feature code calls a provider.** | Proven by test: a 10,000-call loop halts at the ceiling, cache hits cost zero, retries never double-charge. |
| A-8 | **Playwright drives the installed Chrome via `channel: 'chrome'`.** | Honours "packages, not software" — no browser download. |

---

## 6 · Open

| # | Question | Proceeding on |
|---|---|---|
| `Q-012` | Review bar for AI-generated badge content. | Human-reviewed before visible, Acts only. |
| `Q-021` | Icon family for the eleven badge glyphs. | Monochrome SVG paths vendored in-repo. |
| `Q-022` | Behaviour when a grounded-chat stream drops mid-answer. | Keep partial text, show Retry — never spend without a tap. |
| `Q-023` | Does the 300-line limit apply to Markdown? | Source files only; documents judged by usefulness. |
