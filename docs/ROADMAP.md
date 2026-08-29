# Atlas Bible — Build Roadmap

**Status:** working plan · written 2026-08-28 by `planning-architect`
**Inputs:** `docs/product/prd.md`, `docs/product/design-language.md`,
`docs/architecture/flutter-port-map.md`, `docs/architecture/data-inventory.md`,
`docs/architecture/ai-model-strategy.md`, `docs/decisions/ASSUMPTIONS.md`, `CLAUDE.md`,
Question Hub state (`node tools/question-hub/answers.mjs --all`, `0/88` answered,
`11` blocking).

Every claim below cites its source. Where a decision is open, the Question-Hub id and the
provisional default in force are named. Read `§1` and `§2` before writing any code.

---

## 1 · The one-page picture

**What we are building.** A React Native / Expo rewrite of a working Flutter Bible reader
(`A:\Work\spark\spark-app`, read-only) into the product described in `prd.md`: scripture
rendered as an interactive canvas where small inline badges sit inside the verse text and
open half-screen sheets containing maps, timelines, word roots, manuscript variants,
literary structure and cited AI commentary. Five tabs — Home, Bible, Discover, Studio,
Journal — around a 5-minute daily habit loop. The four pillars in `CLAUDE.md` are the
acceptance criteria for every change.

**What already exists and works.** A FastAPI + Postgres/pgvector backend with a 20-table
schema, a 66-book canon map, and dual verse keys (`verse_key = book×1e6 + chapter×1e3 +
verse`, plus OSIS). **31,102 KJV verses and 344,799 OpenBible cross-references are loaded
and serving today** (`data-inventory.md §3, §4`). Twenty-three HTTP endpoints are wired to
a Flutter client with genuinely good reader behaviour worth preserving verbatim
(`flutter-port-map.md §7`). The Cross-Ref badge is effectively already shipping.

**What is missing.** Nine of ten badges have no content. `bible-enrichment/` in the old
repo is **research only — 52 catalogued datasets, zero records** (`data-inventory.md §5a`).
The only enrichment content anywhere is 1,029 LLM study chunks covering Matthew 1–10 and
Proverbs 1–10 — **1.7% of the canon** — and the script that generated them is missing and
unrecoverable (`data-inventory.md §4, §5b`). Six badges map to verified open datasets and
are an ingestion job. **Four — Chiasm/Structure, History (`year_approx`/`roman_emperor`),
3D City, Meditate — have no dataset in existence** and are content-creation problems
(`data-inventory.md §6`). Three backend defects must be fixed, not ported (`§6`).

**Budget is not the constraint.** Pre-computing the whole New Testament costs ≈ $0.40
(≈ $0.60 with retries) against $4.57 remaining (`ai-model-strategy.md §5`). Review time
and content quality are the constraints. The one unbounded cost is live chat at
$0.000385/turn ≈ 11,800 turns of credit — that is what the spend guard protects.

**The single biggest risk.** Port risk #4: **rounded inline pills inside flowing text are
unreliable on Android** — nested `<Text>` ignores `borderRadius` and treats padding
inconsistently (`flutter-port-map.md §8`). That pill *is* the product
(`prd.md §3.2`, `design-language.md §5`). If it cannot be built, the reader's entire
information architecture changes and every downstream sheet, badge and content decision
shifts with it. It is being spiked now; `§2 M0` carries both branches and `Q-011` carries
the fallback decision.

---

## 2 · Milestones

Ordered so the load-bearing unknowns are retired first. **Do not reorder to show early
progress** — M0 and M2 exist specifically to fail fast.

Two rules apply to every milestone:

- **Definition of done is a clean UI walkthrough, not green tests** (`CLAUDE.md` §Testing).
  Each milestone names its required walkthrough; the record goes in
  `docs/qa/walkthroughs/<date>-<slug>.md` with route, findings and fixes. A pass is clean
  only when a *full* run produces zero P1/P2 findings.
- **Every file obeys the hard limits** — ≤300 lines, ≤50-line functions, no raw colour or
  spacing literals, no `console.log`, no empty catch (`CLAUDE.md` §Hard limits).

---

### M0 · Prove the signature interaction

**Goal.** A reader can see a rounded `[🗺 Route]` pill sitting inside a flowing serif verse
on a real Android device, tap it, and have a sheet slide up — and we know whether a
streamed AI reply can reach that device at all.

**Ships**
- A throwaway Expo screen rendering Acts 16:11–15 in the scripture serif at 19pt /
  line-height 1.72 (`flutter-port-map.md §6`) with three inline badges of different hues,
  wrapping naturally mid-line.
- Screenshots from Android device, iOS, and Expo web, side by side with
  `docs/product/mockups/image1.png` and `image9.png`.
- A second, independent spike: SSE streaming from `POST /chat/stream` consumed on Android
  via `expo/fetch` (SDK 52+ streaming `fetch`), with the fallback path
  (`XMLHttpRequest` + `onprogress` + `responseText.slice`) proven to work if it does not
  (`flutter-port-map.md §8` risk 1).
- A frame-rate measurement of ~200 streamed deltas rendering into a Markdown bubble on the
  target Android device (risk 2).
- A written verdict in `docs/architecture/badge-spike.md`: **works / workaround / blocked**.

**Depends on.** Nothing. Gated by no question — but the *outcome* feeds `Q-011`
(fallback branch) and `T-01`/`T-02` (target platforms; provisional default = Android
device + Chrome desktop).

**Definition of done.** Walkthrough `m0-badge-spike`: on a physical Android phone, scroll a
full chapter of dummy text containing 30 badges, tap ten of them, rotate, change system
font size two steps up, and enable "reduce motion". No badge may shift the scripture's line
rhythm, clip, or overlap. Screenshots attached. The verdict paragraph is written before
any other milestone starts.

**Branches**
- **Works** → M1 proceeds as written; `BadgePill` is a nested `<Text>` primitive.
- **Workaround** → take the `Q-011` recommendation (square corners on Android, rounded on
  iOS/web), record it in `ASSUMPTIONS.md` against `Q-011`, and add an Android-specific
  visual-regression screenshot to every subsequent walkthrough.
- **Blocked** → stop and escalate. Do not silently move badges to a gutter; that changes
  pillar 2 (point-of-need intelligence) and needs the human.

**Risks.** #4 inline styled spans (this milestone *is* the mitigation) · #1 SSE on RN
(mitigation: `expo/fetch`, XHR fallback, keep the `data:`/`[DONE]`/`meta`/`delta` parser
identical to `chat_service.dart:78-101`) · #2 per-token re-render (mitigation: draft lives
in a dedicated Zustand store keyed by conversation, one commit per animation frame, no
shell component subscribes).

---

### M1 · The reading canvas on real scripture

**Goal.** A reader can open the app, land in a chapter of real KJV text in the dark
cinematic design, jump to any of the 66 books and any chapter, and search scripture without
losing their place.

**Ships**
- Design-token module (`colors/typography/radius/motion/spacing`) from
  `design-language.md §2–§6`. No component holds a hex value.
- Expo Router shell with the five tabs (`design-language.md §7`); four are placeholders.
- Reader route `app/read/[book]/[chapter].tsx` + `(tabs)/read.tsx` redirecting to saved
  progress (`flutter-port-map.md §9`).
- `Verse.tsx` with **constant footprint** — 11px left padding and a 2.5px bar always
  rendered, transparent at rest — and **three selection states** (selected / highlighted /
  both) fading through transparent *paper*, never through grey
  (`flutter-port-map.md §7.3`). The dark palette needs its own equivalent of the olive
  `combo` state.
- Reference picker (two-step book grid → chapter grid, alias-normalised search, plain fade
  transition — never animate geometry over a blur) and translation popover
  (`flutter-port-map.md §7.6`).
- Search overlay *over* the reader with sticky query/results/scope
  (`flutter-port-map.md §7.7`).
- Backend restructured to the layering rules and serving `/read`, `/translations`,
  `/search/scripture`, `/verses/{osis}/cross-references`; `verse_key` and the 66-book alias
  table ported verbatim from `scripture/books.py` + `scripture/refs.py`.
- **One canonical client-side book table.** The Flutter client maps only books 20/40/8 and
  corrupts `book_number` to 0 elsewhere (`flutter-port-map.md §8` risk 10) — do not
  reproduce it.
- A checksummed local snapshot of the KJV text vendored into the repo. Today both loaders
  fetch from `raw.githubusercontent.com` at runtime and **nothing is bundled**
  (`data-inventory.md §4`).
- `tsvector` + trigram search replacing the unindexable `ILIKE '%q%'`
  (`data-inventory.md §7`).

**Depends on.** M0 (verdict recorded). Gated by `D-01` (dark cinematic — provisional:
yes, tokens structured so light is addable), `S-01`/`S-03` (translation and scope —
provisional: multiple open translations, full Bible), `T-10`/`T-11`/`T-12`/`T-15`
(router / styling / state / workspaces — all provisional defaults in `ASSUMPTIONS.md`),
`Q-006` (provisional: **phone-only**, so no rail, no split pane, no desktop layouts —
this deletes roughly a third of the Flutter UI code from scope).

**Definition of done.** Walkthrough `m1-reading-canvas`: cold start → land in a chapter →
scroll the longest chapter in the canon (Psalm 119) top to bottom → open the picker → jump
to 1 Corinthians 13 → switch translation → search a phrase → open a hit → reopen search and
confirm the query survived → select a verse → confirm the text does not shift sideways.
Run at three system font sizes and with the backend killed mid-session (the reader must
degrade with a friendly message, never a stack trace — `flutter-port-map.md §7.7`).

**Risks.** #8 fonts must be vendored and the splash held until they load or scripture
reflows on first paint · #7 backdrop blur on Android — restrict blur to transient overlays
only, exactly as `glass.dart:37` already documents · #11 dead code that looks alive: do
not port `search_screen.dart`, `artifacts.dart`, `patterns.dart`, `smooth_scroll.dart`, or
the authored Ruth 2 path.

---

### M2 · One badge, end to end, on real data

**Goal.** A reader can open John 3 and tap a `[🎯 Cross-Ref]` badge next to verse 16 and
see the real vote-ranked cross-references slide up in a glass sheet, with the verse still
visible above it.

**Why this badge, and why now.** Cross-Ref is the only badge with a loaded corpus —
344,799 rows serving through `GET /verses/{osis}/cross-references` today
(`data-inventory.md §6`). It therefore proves the **entire vertical slice** — verse →
badge availability → pill placement → sheet → data fetch → citation → dismiss — with zero
content-pipeline dependency. If the slice is wrong, we learn it against working data
instead of against a data problem.

**Ships**
- `BadgePill` primitive with the per-type hue map (`design-language.md §2`), the annotated
  word tinted to match, bracketed label as part of the mark.
- `ContextSheet` — bottom-half, grab handle, spring slide-up ~320ms, backdrop dim in
  parallel, scripture above stays visible (`design-language.md §4, §6`).
- Cross-Ref sheet body: vote-ranked list, target verse text, tap-to-navigate.
- **End-of-chapter badge summary list** — every badge in the chapter repeated as pill +
  teaser + chevron (`design-language.md §5`, `image9.png`). This is the accessibility and
  fallback surface for readers who will not tap mid-verse, and it is what M0's "blocked"
  branch degrades to.
- Per-verse badge-availability flags added to the `/read` response so pills render without
  a second round trip (`data-inventory.md §2`).
- `GET /study/available` wired up. The picker's enrichment dots are currently a lie derived
  from a hardcoded `{20, 40}` (`flutter-port-map.md §7.6`).

**Depends on.** M1. Gated by `P-04` (how many badges to build for real — provisional: the
5 highest-impact), `P-05` (the north-star quality bar — provisional: *the reader with
inline badges opening cinematic context sheets*, which is exactly this milestone).

**Definition of done.** Walkthrough `m2-crossref-badge`: open a chapter with dense
cross-references → tap five badges in sequence without closing between them → confirm the
sheet swaps content rather than stacking → dismiss by drag, by backdrop tap, and by back
gesture → confirm the reader's scroll position never moved → open the same chapter offline
and confirm the badge renders disabled rather than crashing → run the whole pass with
`prefers-reduced-motion` on and confirm sheets cross-fade instead of sliding
(`design-language.md §6`).

**Risks.** #4 (M0's verdict is now load-bearing here — this is where a workaround becomes
visible in the real design) · #7 blur cost on the sheet on Android · sheet-over-scripture
is pillar 1: nothing may float over scripture that the reader did not open.

---

### M3 · Identity, and the three defects that must not ship

**Goal.** A reader's highlights, notes and progress are their own, and no anonymous caller
can write into the study corpus or the RAG index.

These are **must-fix-before-exposure**, not backlog. Each is a real defect in the old
backend, documented with a line reference.

**Ships**
1. **Real `current_user`.** Every `/me/*` route currently resolves to the literal string
   `dev-user` (`user.py:15-20`, `data-inventory.md §2`) — the entire user layer is
   single-tenant with no authorization check. Replace with a verified-token dependency;
   `user_id` becomes a real FK. The client sends an `Authorization` header from day one
   (`flutter-port-map.md §8` risk 9).
2. **Delete `PUT /study/{book}/{chapter}`.** It is an unauthenticated write that also
   side-effect ingests documents into the RAG index (`study.py:48`). Content enters only
   through the offline pipeline in `§5`. Do not "add auth to it" — remove the route.
3. **Fix RAG relevance.** The Chroma collection is persisted with `hnsw:space = l2`
   despite `rag/store.py:20` requesting cosine, and `store.py:71` then computes
   `score = 1.0 - distance` as if it were cosine. **Every relevance score in the system is
   currently wrong** (`data-inventory.md §7`). Retire Chroma; move to pgvector with
   `vector_cosine_ops`; re-embed.

Also in scope: the target schema from `data-inventory.md §7` with real foreign keys,
provenance on every enrichment row, migrations from commit one (`B-04` provisional: yes),
`CORS allow_origins` narrowed from `*` (`config.py:26`), the `GET`/`PUT /me/prefs`
wrapping asymmetry fixed (`flutter-port-map.md` open question 9), and `.env*` properly
gitignored (`data-inventory.md §5g`).

**Depends on.** M1. Gated by `A-01` (auth for v1 — provisional: **anonymous device id
now, real accounts later**; that satisfies defect 1 as long as the id is per-device and
the server stops hardcoding a constant), `B-01` (provisional: keep FastAPI, restructure),
`B-02`/`B-03` (provisional: Postgres + pgvector in Docker compose), `A-03` (provisional:
local-only, schema designed for sync).

**Definition of done.** Walkthrough `m3-identity`: highlight a verse, add a note, close the
app, reopen — both survive → run the same flow from a second device/profile and confirm
the two do not see each other's data → attempt `PUT /study/Acts/16` with curl and get 404
or 405, not 200 → run a RAG query and confirm the top hit is semantically correct and its
score is in `[0,1]` and monotonic. Plus an API integration suite (pytest + httpx) asserting
401 on every `/me/*` route without a token.

**Risks.** #9 auth is genuinely not wired today, and Clerk's native SDK sends
`Authorization` while browsers force `Origin`, which Clerk rejects — the same auth path
cannot serve native and web (`main.dart:50-53`). Test Expo web sign-in in this milestone,
not later.

---

### M4 · The deterministic ingest

**Goal.** No user-visible change. Places, original-language words, culture notes and
genealogy exist in the database with provenance, ready for M5's sheets.

**Ships**
- `data_sources` rows first, with SPDX-ish license, `share_alike` flag, and the exact
  attribution string the UI must show. **No enrichment row lands before its source row.**
- Four loaders following the existing idempotent fetch → validate → `COPY` → assert
  pattern (`data-inventory.md §5f`):
  - **Places** — OpenBible Bible-Geocoding-Data (CC BY 4.0, OSIS join, 1,341 places /
    5,616 verses), cross-loaded with Theographic Places (CC BY-SA, 1,911 places) in a
    *separate tagged table*. `candidates jsonb` preserves scholarly disagreement, per
    `bible-enrichment/DECISIONS.md #10` — never collapse to one pin.
  - **Word roots** — unfoldingWord UHB/UGNT or STEPBible TAHOT/TAGNT (~560K word rows) +
    OpenScriptures HebrewLexicon and Dodson Greek Lexicon (~14,300 entries).
    **Requires the STEPBible TVTMS versification mapping** — Hebrew/Greek numbering
    diverges from KJV (`data-inventory.md §6`).
  - **Cultural** — unfoldingWord en_tn + en_tw, Easton's/Smith's dictionaries.
  - **People** — Theographic People.csv into `people` / `person_relations` /
    `person_mentions`.
- The **gazetteer resolver**: `resolvePlaceName(name) → place_id | null`. This is the
  code half of the rule that **models never emit coordinates** (`CLAUDE.md`;
  `ai-model-strategy.md §3` finding 3 — 41 km mean error even from the winning model).
  An unresolved name goes to a review queue; it never becomes a guessed pin.
- A **pericope table** (`passages`) with a GiST range index, so "which passage contains
  verse 44016013?" is one lookup. Boundaries derived from BSB USFM `\s` section headings.
- Build-time assertion: `passage_enrichment` may not be built from any `source_id` with
  `share_alike = true` while `Q-007` stands at "keep table-scoped". Make this a failing
  build, not a review item.

**Depends on.** M3 (schema). Gated by `Q-007` (share-alike posture — provisional: **keep
table-scoped**, which means share-alike sources render in their own sheets with attribution
but are not blended into the pre-computed passage JSON), `Q-009` (provisional: **verse-keyed
storage plus a pericope table**, passage records as a rebuildable materialisation),
`S-04` (provisional: Strong's + an open interlinear), `B-05` (provisional: bundled JSON
seed + Postgres as source of truth).

**Definition of done.** Not a UI walkthrough — a **data walkthrough**, recorded the same
way. Row counts asserted per loader. Zero orphan `verse_key`s (every enrichment row joins
to a real verse — this is the early warning for a versification mismatch). Re-running every
loader twice produces identical counts. A licence report lists every source, its licence,
its attribution string, and which tables it touched.

**Risks.** Versification divergence silently dropping or misplacing Hebrew/Greek words —
mitigated by the orphan-key assertion above · share-alike contamination — mitigated by the
build assertion · the ~1–2 week / $0-model-spend estimate in the old `PROPOSAL.md` is
credible but is *parser* work, and parsers slip.

---

### M5 · The sourced badge sheets

**Goal.** A reader can open Acts 16 and tap a `[🗺 Route]` badge and see Troas → Samothrace
→ Neapolis → Philippi drawn on a map; tap `[🗣 Root]` on "worshipper" and see the Greek
lemma, Strong's number and gloss; tap `[⚖️ Cultural]` and see a sourced note; tap
`[🧬 Lineage]` on a name and see the family graph.

**Ships**
- Route sheet: stylised map, progressively drawn route line with a soft glow, gold city
  pins, distance/duration strip (`prd.md §3.2`, `design-language.md §6`,
  `image1.png`). Camera centre and zoom **computed** from the passage's location bounding
  box — no dataset provides them (`data-inventory.md §6`).
- Word Root sheet: lemma, Strong's number, transliteration, gloss, usage examples, Save as
  Flashcard (`image6.png`). Bidirectional word ↔ text focus: tapping a word card scrolls
  the reader so the term lands ~18% down the viewport and chips every occurrence inline;
  tapping again unfocuses (`flutter-port-map.md §7.2, §7.4`).
- Cultural sheet and Lineage sheet.
- A visible **attribution strip** on every sheet whose content came from a licensed source.
- Confidence surfacing on map pins where the gazetteer has alternates
  (`DECISIONS.md #10`).

**Depends on.** M2 (sheet + pill primitives), M4 (data). Gated by `M-01` (Mapbox token —
provisional: **no token; build a custom stylised map from GeoJSON with no tile provider**),
`M-02` (provisional: prototype two approaches and pick), `M-04` (provisional: research and
pick — answered by M4's choice of OpenBible).

**Definition of done.** Walkthrough `m5-sourced-badges`: read Acts 16 end to end tapping
every badge in the chapter → confirm each sheet's data is real, not placeholder → confirm
every sourced sheet shows its attribution → focus a word root and confirm the reader
scrolls and chips it, then unfocus → confirm a place with two candidate sites shows both.
Repeat on a chapter with *no* enrichment and confirm the reader is visually unchanged and
no empty sheet is reachable.

**Risks.** Without a Mapbox token the map is the biggest visual-fidelity gap against
`image1.png` — build it early enough in this milestone to compare side by side while there
is still time to escalate `M-01` · #4 again: the word-study inline chip is the second
place inline styled spans appear.

---

### M6 · Grounded chat that actually cites

**Goal.** A reader can tap `[🎙 Context]` inside a verse, ask "why does Luke mention the
purple cloth?", and get a streamed answer where every claim carries a tappable source chip
and a visible Grounding Confidence meter.

**Ships**
- Self-hosted `BAAI/bge-m3` embeddings (1024-dim, multilingual including Greek and Hebrew)
  in the existing Docker stack behind a swappable interface — **$0 per embedding**
  (`ai-model-strategy.md §2` job 5; `Q-010` provisional default).
- pgvector HNSW retrieval with correct cosine scoring (fixed in M3), filterable by book,
  passage **and licence tier in the same query** — which is the whole reason for retiring
  Chroma (`data-inventory.md §7`).
- The AI package: `complete(task, messages)` as the only exported entry point; the
  OpenRouter client private to it; a lint rule banning `openrouter.ai` string literals
  outside it. Spend guard (reserve-before-call, cross-process file lock, fail closed,
  `ATLAS_AI_CEILING_USD` defaulting to $0.25 under CI) and disk cache with lookup **before**
  reserve, so cache hits cost nothing and consume no ceiling
  (`ai-model-strategy.md §4.2, §4.3`).
- **Meter on each response's `usage.cost`, never on `GET /api/v1/credits`** — the credits
  endpoint settles up to a minute late and a guard polling it can be raced through the
  ceiling (`ai-model-strategy.md §1`).
- Model registry with the measured defaults: `qwen3-235b-a22b-2507` for chat and editorial,
  `mistral-small-3.2-24b` for extraction (`max_tokens: 600` — 200 truncates every time),
  `mistral-nemo` for classification (`ai-model-strategy.md` Recommended defaults).
- Streaming chat UI, ported behaviour-for-behaviour from `flutter-port-map.md §7.1`:
  tool chips arrive **before** the first token; draft separate from history; skeleton then
  text with no layout jump; token-guarded cancellation via `AbortController`; persist in a
  `finally`, unawaited; conditional auto-pin (only scroll if already within ~160–220px of
  the bottom).
- `[[Book 3:16]]` → tappable ref pill. This is a **server-side prompt contract**
  (`chat.py:35-40`), not a text scan — keep both halves
  (`flutter-port-map.md §7.5`).
- The honest middle tool-chip state: "RAG on but nothing matched". That state is exactly
  what pillar 3 needs (`flutter-port-map.md §7.5`).

**Depends on.** M3 (RAG fix, auth), M4 (a corpus worth retrieving). Gated by `AI-04`
(provisional: **NotebookLM-*style*** — our own grounded RAG; there is no public NotebookLM
API), `AI-05` (provisional: **structural** — a claim without a source anchor is not
rendered), `AI-06` (provisional: present multiple traditions where they differ),
`AI-07` (provisional: pre-computed for badge content, live only for Studio chat),
`Q-005` (provisional: **one unified chat** carrying passage context, not two surfaces),
`AI-03` (guard + cache — building regardless; strictly protective).

**Definition of done.** Walkthrough `m6-grounded-chat`: ask five questions from the golden
set → confirm every rendered sentence carries a chip → tap a chip and land on the right
verse → ask a question the corpus cannot answer and confirm a refusal, not a guess →
cancel mid-stream and confirm no half-message is persisted → send a second question while
the first is streaming → kill the network mid-stream. Plus: run the full test suite twice
and confirm the second run costs **$0.00** from cache, and that the ledger never exceeded
the CI ceiling.

**Risks.** #1 SSE (retired in M0) · #2 per-token re-render (retired in M0; re-verify on the
real Markdown tree here) · rate limits are real — `mistral-small-3.2` returned an upstream
429 in benchmarking, so retry-with-backoff and the registry's fallback model are required
· provider routing is non-deterministic and swung latency 5.9× on the same model — pin
`provider.order` on latency-sensitive paths (`ai-model-strategy.md §3` findings 4–5).

---

### M7 · Generated enrichment, with review

**Goal.** A reader can open any chapter of Acts and tap `[⏳ History]` to see the year, the
emperor and a cultural note; `[🌳 Structure]` on a poetic unit; `[🧘 Meditate]` on a
command verse — and can see, on the sheet, that the content was AI-generated.

This is the milestone that makes the four dataset-less badges real. It is a **content**
milestone, not an engineering one; its cost is review, not compute.

**Ships**
- The `rulers` table: ~200 hand-built rows (name, realm, title, reign span), Wikidata-
  derivable, deterministic. `roman_emperor` becomes a **join, not stored data** — correcting
  one reign date fixes the whole canon at once (`data-inventory.md §7`).
- `passage_dating` populated for Acts by the extraction pipeline, then reviewed.
  Dating passages to years is scholarly judgement, not a lookup (`data-inventory.md §6`).
- `literary_type` per passage: book-level genre is a 66-row hand table; passage-level is
  classification via `classify_cheap`.
- `key_chiastic_nodes` for a **curated shortlist only**. Chiasm is famously over-detected;
  running a model canon-wide will produce confident nonsense. Generate for units where the
  structure is scholarly consensus, review every one, ship nothing unreviewed.
- Meditate prompts for Acts. Lowest factual risk of the four — a reflection prompt makes no
  historical claim — so the review bar is editorial, not theological.
- `notes.origin ∈ {sourced, generated, authored}` + `reviewed_by` enforced end to end, and
  a provenance chip in the sheet UI that says so.

**Depends on.** M4 (schema, pericopes), M6 (AI package, guard, cache). Gated by **`Q-008`**
(how to source the four — provisional: **LLM-generate at build time, flagged, plus the
deterministic ruler table**) and **`Q-012`** (*newly queued* — the shipping bar for
generated content; provisional: **every generated record human-reviewed before it is
visible, Acts only, ~230 records**).

**Definition of done.** Walkthrough `m7-generated-badges` over all 28 chapters of Acts:
every History, Structure and Meditate sheet opens, carries a provenance chip, and its year
falls inside the reigning ruler's span (assert this in code, not by eye). Plus a review
log: every generated record has a `reviewed_by`, and the reviewer's rejection rate is
recorded — if it exceeds 20% the generation prompt is wrong, not the reviewer.

**Risks.** Theological error shipped under an authoritative-looking chip is the reputational
risk of this product · reviewer throughput is the real schedule risk (`§8`) · a model that
sounds certain about a contested date is worse than one that says "c." — require a
confidence field and render it.

---

### M8 · The habit loop

**Goal.** A reader can complete Listen → Explore → Reflect in five minutes, see their
streak increment with a fire animation and haptic, and find their reflection in the Journal
tomorrow.

**Ships.** Home / Today's Drop hero, 3-step checklist, streak pill, progress ring and
sparkline (`image10.png`, `image3.png`); the streak state machine; Grace Savers; milestone
drawer at 7/30/100 days; Journal tab with the weekly tracker and the reflection feed in
serif, tagged with verse badges; onboarding (learning-style, the 10-second "aha" moment,
notification time); local scheduled notifications.

**Depends on.** M2 (a chapter worth exploring), M3 (identity). Gated by `G-01` (provisional:
all 3 steps, low bar each), `G-02` (provisional: **local midnight with a 4am grace
boundary** — this is where streak bugs live, so decide it before the state machine),
`G-03` (provisional: 1 saver per 7 consecutive days, max 2 banked), `G-04` (provisional:
yes, local notifications), `G-05` (provisional: **both** a curated Acts plan and a custom
plan), `J-01` (provisional: device secure storage, local only), `J-02` (provisional:
local-only metrics in a debug screen).

**Definition of done.** Walkthrough `m8-habit-loop` run against a clock-shifted device:
complete a day → advance the device clock past 4am → confirm the streak held → skip a day
→ confirm a Grace Saver consumed → skip two → confirm the streak broke → cross a 7-day
milestone and confirm the drawer unlocked. Then the real test: **time a genuine
Listen → Explore → Reflect run and confirm it completes in under five minutes.** If it
does not, the loop is wrong, not the stopwatch (pillar 4).

**Risks.** Timezone and DST handling is the classic bug class here — `G-02`'s answer is the
mitigation and it must be a pure, unit-tested function with zero infrastructure imports ·
scope: Home and Journal are two full tabs and will pull focus from the reader.

---

### M9 · Audio

**Goal.** A reader can press ▶ on Today's Drop, hear a dual-host overview, slide the
narrator and ambient volumes independently, lock the phone, and keep listening.

**Ships.** Pre-rendered audio (generated once in the editorial pipeline, served as static
files — never live TTS per session, per `prd.md §14B`); the Focus Audio Player sheet with
verse-level synchronised highlight; the Atmosphere Mixer with two independent gain
streams; background audio and lock-screen controls.

**Depends on.** M6 (script generation), M8 (the loop it serves). Gated by `AU-01`
(provisional: **free/open TTS — Kokoro or Piper — generating real audio locally**; no
ElevenLabs key exists), `AU-02` (provisional: yes, build the mixer properly),
`AU-03` (provisional: **verse-level** highlight, not word-level — word-level needs forced
alignment), `AU-04` (provisional: yes, background + lock screen — cheap now, expensive to
retrofit).

**Definition of done.** Walkthrough `m9-audio` on a physical device: play, lock, unlock,
resume from the lock screen, take a phone call, resume, background the app for ten minutes,
resume; move both mixer sliders through their full range including zero; confirm the verse
highlight stays in sync at the end of a 90-second clip. Note: `editorial_longform` prose
quality was **estimated, not benchmarked** (`ai-model-strategy.md §2` job 3) — re-test the
model before committing the podcast pipeline.

**Risks.** Background audio needs native config, which forces a development build — take
`T-03`'s provisional default (`expo-dev-client` from day one) at M1, not here · audio is
the easiest place to blow the five-minute loop.

---

### M10 · Discover, Manuscript, and the honest 3D City

**Goal.** A reader can leave the reading flow to explore the map and the Empire Timeline
freely, tap a city, and land in the Bible tab at that exact verse.

**Ships.** Discover tab: 3D Travel Routes free-roam, dual-axis Empire Timeline (biblical
events above, Roman/world history below), Literary Patterns node graph, and the cross-app
link back to the reader (`prd.md §3.2` Tab 3, `image5.png`). Manuscript badge over a
**hand-curated set of ~25 famous variants** (Mark 16:9–20, John 7:53–8:11, 1 John 5:7,
Acts 8:37, Matthew 6:13…) with public-domain codex imagery — no open variant apparatus
exists and SBLGNT's is EULA-encumbered and already rejected (`data-inventory.md §6`).
3D City as a **stylised 2.5D site sheet**: OSM/Natural Earth basemap, an AI-generated
establishing still, and real gazetteer facts, behind an interface a commissioned 3D asset
can drop into later.

**Depends on.** M5 (places), M7 (dating for the timeline). Gated by `P-08` (expandable 3D
Bible — provisional: build 2.5D behind a swappable interface), `M-03` (provisional:
AI-generated stills now, real 3D later).

**Definition of done.** Walkthrough `m10-discover`: pan and zoom the free-roam map → tap a
city → land at the right verse → scrub the timeline across a century → tap an emperor →
land at the right passage → open a Manuscript sheet and confirm every witness card names a
real codex with a real siglum.

**Honest note.** The PRD's "3D City" and "cinematic 3D terrain" are the largest gap between
spec and buildable reality in this plan. `§4` proposes cutting the *3D claim* while keeping
the badge. That is a product decision surfaced here rather than papered over.

---

### M11 · Production hardening

**Goal.** The app is something the human clicks through and cannot break.

**Ships.** Full-app walkthrough repeated until three consecutive clean passes; device
walkthroughs via Maestro; performance budgets enforced (`O-02` provisional: set sensible
budgets and enforce them); offline behaviour (`O-01` provisional: scripture + enrichment
offline, AI and audio need a connection); accessibility pass to AA text contrast plus
dynamic type (`D-06`); CHANGELOG and version discipline (`OP-03`); CI workflows written
(`OP-01` provisional: written, left unwired); a licence/attribution screen listing every
source.

**Definition of done.** Three consecutive clean full-app walkthroughs on web and one on a
physical Android device, with zero P1/P2 findings, recorded in `docs/qa/walkthroughs/`.

---

## 3 · Feature-by-feature build order

The human asked for the PRD implemented one feature at a time. This is the explicit order.
**B** = blocked on an unanswered question that would change the build; **P** = proceeding
on a provisional default recorded in `ASSUMPTIONS.md`.

| # | Feature | M | Why here | Gate |
|---:|---|---|---|---|
| 1 | Inline badge primitive in flowing text | M0 | The product's signature interaction and its biggest platform risk. Everything downstream assumes it works. | — |
| 2 | SSE streaming transport | M0 | Cheap to prove, expensive to discover late; blocks all chat work. | — |
| 3 | Design tokens | M1 | Nothing may hold a raw colour, so tokens precede the first component. | P `D-01` |
| 4 | Reading canvas + verse states | M1 | The one screen the whole product hangs off (`P-03` default). | P `D-01`, `Q-006` |
| 5 | Reference picker + translation switch | M1 | Navigation is unusable without it; it also carries the enrichment-visibility affordance. | P `S-01`, `S-03` |
| 6 | Scripture search overlay | M1 | Ported behaviour, high value, low risk; validates the "never lose your place" rule. | — |
| 7 | Cross-Ref badge + context sheet | M2 | The only badge with data today — proves the vertical slice with zero content dependency. | P `P-04` |
| 8 | End-of-chapter badge summary | M2 | Accessibility surface, and the degradation target if M0 says "blocked". | P `Q-011` |
| 9 | Identity + the three defects | M3 | Nothing user-owned or AI-facing may be exposed before this. | **B** `A-01`, P `B-01` |
| 10 | Highlights, notes, progress | M3 | Cheap once identity exists; ported optimistic behaviour is already specified. | P `A-03` |
| 11 | Enrichment schema + pericopes | M4 | Every remaining badge stores through it. | P `Q-009` |
| 12 | Places ingest + gazetteer resolver | M4 | Precondition for Route, 3D City, and the no-coordinates-from-models rule. | P `Q-007` |
| 13 | Word-root ingest | M4 | Largest dataset (~560K rows); the versification mapping is the hard part. | P `Q-007`, `S-04` |
| 14 | Cultural + people ingest | M4 | Same pipeline, marginal cost once 12 and 13 exist. | P `Q-007` |
| 15 | Route badge + map | M5 | Highest-impact visual badge; the PRD's hero image. | **B** `M-01`, P `M-02` |
| 16 | Word Root badge | M5 | The "deep student" persona's core feature; data is deterministic. | — |
| 17 | Cultural badge | M5 | Sourced, attributable, low risk. | P `Q-007` |
| 18 | Lineage badge | M5 | Same data pass; graph UI is the only new work. | P `Q-007` |
| 19 | Embeddings + AI package + spend guard | M6 | Guard before first live call, not after. | P `Q-010`, `AI-03` |
| 20 | Grounded chat + Context badge + Studio | M6 | Pillar 3 lives or dies here. | P `AI-04`, `AI-05`, `Q-005` |
| 21 | Ruler table + passage dating | M7 | Deterministic half of History; makes the emperor a join. | P `Q-008` |
| 22 | History badge | M7 | First generated badge; sets the review pattern. | **B** `Q-012` |
| 23 | Structure badge | M7 | Highest hallucination risk of the generated set — curated shortlist only. | **B** `Q-008`, `Q-012` |
| 24 | Meditate badge | M7 | Lowest factual risk; ship it last of the three to bank the review pattern first. | P `Q-008` |
| 25 | Onboarding + Home + streaks | M8 | Retention shell around a product that must already be worth returning to. | P `G-01`–`G-05` |
| 26 | Journal | M8 | Completes the loop's third step. | P `J-01` |
| 27 | Quizzes + flashcards | M8 | `classify_cheap` makes these nearly free; they close the Reflect step. | P `ST-01`, `ST-02` |
| 28 | Audio pipeline + player + mixer | M9 | Signature feature, but useless without content to narrate. | **B** `AU-01` |
| 29 | Discover tab | M10 | A sandbox over data that must already exist. | P `P-08` |
| 30 | Manuscript badge | M10 | Hand-curated; no dataset to wait for, but real authoring time. | — |
| 31 | 3D City badge (2.5D) | M10 | Largest spec-to-reality gap; deliberately last. | **B** `M-03`, `P-08` |

**Blocked-but-proceeding.** Items 9, 15, 22, 23, 28 and 31 carry a **B**. None of them
stops: each takes its recommended default, records it against the question id in
`ASSUMPTIONS.md`, and continues, per `W-01`. Items 15 and 31 are the two where a late
answer would cost the most rework — escalate `M-01` and `M-03` before M5 starts.

---

## 4 · Badge readiness matrix

Effort: **S** = days · **M** = 1–2 weeks · **L** = a month or more, or an open-ended
content problem (`data-inventory.md §6`).

| Badge | Data source status | Effort | What unblocks it | Milestone |
|---|---|:--:|---|:--:|
| 🎯 **Cross-Ref** | ✅ **Shipping.** 344,799 OpenBible rows loaded, endpoint live | S | Nothing — UI only | **M2** |
| 🗺 **Route** | ✅ Sourceable. OpenBible Bible-Geocoding-Data, CC BY 4.0, 1,341 places / 5,616 verses, OSIS join. Camera framing computed, not sourced | S ingest / M sheet | Ingest (M4) + a map renderer. `M-01` (no Mapbox token → stylised GeoJSON) | **M4/M5** |
| 🗣 **Root** | ✅ Sourceable. unfoldingWord UHB+UGNT (CC BY-SA) or STEPBible TAHOT/TAGNT (CC BY); lexicons OpenScriptures HebrewLexicon + Dodson. ~560K word rows, ~14.3K lexicon entries | M | STEPBible TVTMS versification mapping; `Q-007` decides which source family | **M4/M5** |
| ⚖️ **Cultural** | ✅ Sourceable. unfoldingWord en_tn + en_tw (CC BY-SA), Easton's/Smith's (CC BY 4.0, 5,998 entries / 35,089 verse refs). 81 legacy LLM chunks exist — discard them | M | `Q-007` | **M4/M5** |
| 🧬 **Lineage** | ✅ Sourceable. Theographic People.csv (CC BY-SA) — the only verified open genealogy graph | M | `Q-007`; STEPBible TIPNR carries a "please don't re-host" request needing a human call | **M4/M5** |
| 🎙 **Context** | ⚠️ Derived. Needs retrieval over everything else plus correct cosine scoring | M | M3 defect 3 + M6 embeddings | **M6** |
| 📜 **Manuscript** | ❌ **No dataset.** No open variant apparatus verified; SBLGNT's is EULA-encumbered and explicitly rejected. Prototype has 3 hand-written witness cards | S (curated) / L (canon-wide) | **Route: curate by hand.** ~25 famous variants + PD codex imagery. Do *not* attempt canon-wide coverage | **M10** |
| ⏳ **History** | ❌ **No dataset.** Two separable halves: `rulers` is a ~200-row hand table (deterministic); `year_approx` is scholarly judgement | S (rulers) / L (dating) | **Route: hand-build rulers; generate-and-review the dating for Acts only.** `cultural_context_note` comes from en_tn | **M7** |
| 🌳 **Structure** | ❌ **No dataset.** Zero occurrences of "chiasm" anywhere in the old repo | L | **Route: generate + human-review a curated shortlist.** Chiasm is over-detected by confident models; canon-wide generation would produce authoritative-looking nonsense. If `Q-012` says "no unreviewed content", this ships for a handful of units or not at all | **M7** |
| 🧘 **Meditate** | ❌ **No dataset.** Pure authoring or generation | M (LLM) / L (hand) | **Route: generate for Acts, light editorial review.** A reflection prompt asserts no historical fact, so the review bar is tone, not truth | **M7** |
| 🏛 **3D City** | ❌ **No dataset, no assets, no identified source.** No open 3D reconstruction of ancient Philippi, Ephesus or Corinth exists | L | **Route: cut the "3D" claim from v1.** Ship a stylised 2.5D site sheet (OSM basemap ODbL + Natural Earth PD terrain + an AI-generated establishing still + gazetteer facts) behind an interface a commissioned model can drop into. Full 3D is an art-commissioning project, not an engineering task | **M10** |

**Score.** 1 shipping · 4 deterministic ingest · 1 derived · 4 content-creation problems.
No amount of ingestion work produces the last four — that is the single most important
finding in `data-inventory.md`, and this matrix is the plan's response to it.

---

## 5 · Content pipeline plan

Seven stages. Each is a separate, resumable job; none runs at request time (`AI-07`
provisional default: pre-computed for badge content, live only for Studio chat).

**1 · Register the source.** A row in `data_sources` — key, name, url, SPDX-ish licence,
`share_alike`, and the exact attribution string the UI must render — lands *before* any
content row that points at it. This is what makes licence separability enforceable with a
`WHERE` clause instead of a code review (`data-inventory.md §7`).

**2 · Deterministic ingest (six badges).** One loader per source, following the pattern the
old repo already got right: fetch → validate → `COPY` → **assert an exact expected count**
(`load_verses.py:173` asserts 31,102; `load_xrefs.py:143` asserts 344,799). Idempotent —
running twice changes nothing. $0 model spend. Covers Cross-Ref (done), Route, Root,
Cultural, Lineage, and the `cultural_context_note` half of History.

**3 · Generation (the rest).** Build-time only, through the AI package's
`complete(task, messages)` — feature code physically cannot reach `fetch`
(`ai-model-strategy.md §4.2`). `temperature: 0`, strict `json_schema`, `max_tokens: 600`
for extraction (200 truncates mid-object every time — the most expensive-to-discover
finding in the benchmark). Cache lookup happens **before** the spend reservation, so a
re-run costs nothing.

**The hard rule: models emit place *names*, never coordinates.** The best measured
extractor still averaged 41 km of error, and the rejected one hallucinated a location and
put Neapolis on the wrong continent (`ai-model-strategy.md §3`). Names go to the gazetteer
resolver from M4; an unresolved name becomes a review item, never a pin.

**4 · Human review.** `notes.origin ∈ {sourced, generated, authored}` and `reviewed_by`
are columns, not conventions. A reviewer works a queue of generated records with the
passage text beside them, and either approves, edits, or rejects. Rejection rate is
tracked: above 20% on the first 30 records means the prompt is wrong, not the reviewer.
**How much must be reviewed before a reader sees it is `Q-012`** — provisional default:
everything, Acts only (~230 records), which is what makes Acts the shippable scope.

**5 · Build the materialised record.** A builder job assembles `passage_enrichment`
(`spatial_data`, `temporal_data`, `structural_data`, `badges text[]`, `builder_version`)
from the normalised tables. It is a **derived cache, not the source of truth** — a
corrected coordinate or reign date propagates by re-running the builder, not by editing
thousands of JSON blobs (`data-inventory.md §7`). The builder **fails** if any input row's
source has `share_alike = true` while `Q-007` stands at "keep table-scoped".

**6 · Embed.** Self-hosted BGE-M3 into pgvector with `vector_cosine_ops`. $0 per embedding,
forever, which matters because embeddings are the one workload re-run on every re-chunk and
every schema change (`ai-model-strategy.md §2` job 5).

**7 · Reach the device.** `B-05` provisional default: **both** — a bundled JSON seed for
the Acts MVP so the reader works offline, and Postgres as the source of truth for
everything else. `/read` returns per-verse badge-availability flags so pills render in the
first paint with no second round trip, preserving the rule that **the reader never waits on
enrichment** (`flutter-port-map.md §4`).

### Cost, using the measured numbers

| Scope | Clean run | ×1.5 retries | % of $4.57 |
|---|---:|---:|---:|
| Acts 16 only (40 verses) | $0.0017 | $0.0026 | 0.06% |
| **All 28 chapters of Acts** (1,007 verses) | **$0.0462** | **$0.0693** | **1.5%** |
| Whole New Testament (260 ch / 7,957 verses) | $0.3989 | $0.5984 | 13% |
| Embeddings (any scope) | $0.00 | $0.00 | 0% |
| Live chat, per turn | $0.000385 | — | ≈ 11,800 turns of credit |

**Plan of record:** budget **$0.10** for all of Acts including regeneration. Hold NT-wide
generation until `Q-012` answers how much review capacity exists — the gate is reviewer
hours, not dollars (`ai-model-strategy.md §5`). `AI-01`'s provisional default
("pre-compute Acts 16 only") is two orders of magnitude too conservative and should be
re-read in light of these numbers.

---

## 6 · Backend plan

`B-01` provisional default: **keep FastAPI, restructure to the layering rules**. A
TypeScript rewrite is the alternative and is marked blocking; if it lands, everything below
is a specification rather than a port.

### Must-fix-before-exposure

Not backlog. Each is a live defect with a line reference, and each is scheduled in **M3**.

| # | Defect | Where | Fix |
|---:|---|---|---|
| 1 | Every `/me/*` route resolves to the literal string `dev-user` — the whole user layer is single-tenant with no authorization check | `user.py:15-20` | A real `current_user` dependency verifying a token; `user_id` as a FK; client sends `Authorization` from day one |
| 2 | `PUT /study/{book}/{chapter}` is an **unauthenticated write** that also side-effect ingests documents into the RAG index | `study.py:48` | **Delete the route.** Content enters only through the `§5` pipeline |
| 3 | RAG relevance scores are wrong — the Chroma collection persisted `hnsw:space = l2` while the code requested cosine, then computes `1.0 - distance` as if it were cosine | `rag/store.py:20, 71` | Retire Chroma; pgvector with `vector_cosine_ops`; re-embed |

Secondary, same milestone: CORS `allow_origins` defaults to `*` (`config.py:26`);
`GET /me/prefs` returns a bare object while `PUT /me/prefs` expects `{"prefs": {...}}`;
`.env.local` is not gitignored in the old repo (`data-inventory.md §5g`).

### Endpoint-by-endpoint

Numbering follows the client-facing contract in `flutter-port-map.md §5`.

| # | Endpoint | Verdict | Note |
|---:|---|---|---|
| — | `GET /health` | **Keep** | Add DB and embedding-service readiness, not just an OpenRouter-key check |
| 1 | `GET /read/{book}/{chapter}` | **Keep + extend** | Add per-verse badge-availability flags (M2). Keep the tolerant book alias resolution verbatim |
| 2 | `GET /verses/{osis}/cross-references` | **Keep** | This *is* the Cross-Ref badge. Add the `to_start_key` reverse index — it is currently a sequential scan over 344,799 rows |
| 3 | `POST /chat/stream` | **Rework** | Keep the SSE wire format and the `meta`-before-model ordering exactly. Keep the `[[Ref]]` prompt contract. Swap RAG to pgvector; route through the spend guard |
| 4 | `GET /me` | **Rework** | Returns the authenticated identity, not `{auth: "stub"}` |
| 5 | `GET /translations` | **Keep** | Only codes with verses loaded; `KJVPCE` first |
| 6 | `GET /search/scripture` | **Rework** | `tsvector` + trigram; `ILIKE '%q%'` cannot use an index |
| 7 | `GET /study/{book}/{chapter}` | **Rework → enrichment record** | Becomes the `passage_enrichment` read. **404 stays "no content", not an error** — the client already depends on this |
| — | `PUT /study/{book}/{chapter}` | **Drop** | Defect 2 |
| — | `GET /study/available` | **Rework → badge coverage** | Exists today and is unused; the picker's green dots are a hardcoded lie. Wire it |
| 8–10 | `/me/notes` GET/POST/DELETE | **Keep + auth** | Preserve optimistic delete |
| 11–12 | `/me/highlights` GET/POST | **Keep + auth** | POST is a toggle keyed on `(user_id, verse_key)`. Preserve optimistic behaviour |
| 13–14 | `/me/progress` GET/PUT | **Keep + auth** | PUT stays fire-and-forget from the client |
| 15–16 | `/me/prefs` GET/PUT | **Keep + auth + fix** | Resolve the wrapping asymmetry |
| 17–18 | `/me/chats/{book}/{chapter}` GET/PUT | **Keep or merge** | `Q-005` provisional default unifies the two chat surfaces; if taken, these merge with 19–23 |
| 19–23 | `/me/ask` CRUD | **Keep or merge** | Same `Q-005` decision |
| — | `POST /rag/ingest` | **Drop** | Ingestion is an offline pipeline, not a public endpoint |
| — | `POST /rag/search` | **Rework** | Keep the response shape, swap the backend to pgvector |
| — | *(new)* `GET /passages/{id}/enrichment` | **New** | Serves the materialised record for a pericope |
| — | *(new)* `GET /me/streak`, `POST /me/day-complete` | **New** | M8's habit state |

### Data-layer principles

Verse keys (`BBBCCCVVV` + OSIS) port verbatim — they are exactly right and every external
dataset joins on one or the other. Real foreign keys replace the old schema's bare `int`
verse keys. Provenance (`source_id`) sits on the **row**, not the table, because that is
what makes a licence filter a `WHERE` clause. Full schema in `data-inventory.md §7`;
build it as written unless `Q-009` comes back differently.

---

## 7 · Testing & QA strategy

`CLAUDE.md` is explicit: the definition of done for a feature is not "tests pass" — it is
*design a high-coverage walkthrough, run it, find bugs, fix them, repeat until a full pass
is clean*. Everything below serves that loop.

### The walkthrough loop

**What runs.** Playwright drives the Expo **web** build unattended (`Q-01`/`Q-04`
provisional defaults: E2E on web continuously, device before each milestone). Maestro runs
the same route on a physical Android device at each milestone boundary. Web is a testing
convenience, not a first-class target (`T-04` provisional) — it exists because it can be
driven for free, all night, without a human.

**What a high-coverage walkthrough covers.** One pass, in order: cold start with an empty
store → onboarding → Home → open Today's Drop → scroll the full chapter → tap **every**
badge type present in that chapter → open and dismiss each sheet three ways (drag,
backdrop, back) → select a verse → highlight → add a note → open the reference picker →
jump books → switch translation → search → open a hit → open the reader chat → send a turn
→ cancel a turn mid-stream → Journal → Studio → Discover → settings → force-quit → cold
start again and confirm state restored. Then the same route three more times: **offline**,
**backend killed mid-session**, and **`prefers-reduced-motion` on**.

**What it asserts.**
- Zero console errors and zero unhandled rejections across the whole pass.
- Scripture never reflows when a sheet opens, and the tapped verse stays visible above it
  (pillar 1).
- Every badge pill has an accessible name and a ≥44dp hit target.
- Every AI-rendered claim carries a resolvable source chip; a chip's target verse exists
  (pillar 3).
- Sheet open latency and chapter-scroll frame budget stay inside `O-02`'s budgets.
- **No network request reaches an AI provider from outside the guarded AI package** —
  asserted at the network layer, not by code review.
- Static companions: token lint (no raw hex/size/spacing in any component), file-length and
  function-length checks, and the OpenRouter price-drift check that re-fetches
  `/api/v1/models` and fails if a registered price has risen.

**How findings become fixes.** Every finding is a numbered row in
`docs/qa/walkthroughs/<date>-<slug>.md` — severity (P1 blocks the milestone, P2 blocks the
release, P3 is logged), a repro, the fix, and the commit. A milestone closes only when a
full pass yields zero P1/P2. Each fix is a PATCH bump with a CHANGELOG line
(`CLAUDE.md` §Versioning).

### AI grounding evals

`AI-08` provisional default: yes, golden-set evals in CI. Four assertions per item:

1. **Structural** — every rendered sentence carries a source anchor, or it is not rendered
   (`AI-05` provisional default is the strict reading).
2. **Resolvable** — every `[[Ref]]` anchor parses to a real `verse_key` in a real
   translation. A dangling citation is a failure, not a warning.
3. **Supported** — the retrieved passage actually contains the claim, judged by
   `classify_cheap` (`mistral-nemo`, $0.019/$0.03 per M) against the retrieved chunk, with
   the judgement cached so replays are free.
4. **Refusal** — a held-out set of questions the corpus cannot answer must produce a
   refusal, not a plausible guess. Refusal rate is the single most informative grounding
   metric this product has; track it as a trend, not a threshold.

Evals run under `CI=true`, which sets `ATLAS_AI_CEILING_USD=0.25` — even total guard
failure in CI cannot reach the budget (`ai-model-strategy.md §4.2`). With a warm cache the
suite costs **$0.00**; that is the property to assert, not just observe.

---

## 8 · What could still go badly wrong

Ranked by expected damage. Each has an **early-warning signal** — something observable
before it becomes expensive.

**1 · The inline badge cannot be made good on Android.**
The signature interaction and pillar 2 both depend on it. A workaround that squares the
corners costs visual fidelity; a failure costs the information architecture.
**Early warning:** M0's device screenshots. Secondarily, any PR that moves a badge out of
the text flow "temporarily" — that is the failure arriving quietly. `Q-011` carries the
branch.

**2 · Generated content is theologically wrong and looks authoritative.**
Four badges are generated. A confident, cited-looking claim that is false is worse for this
product than no badge at all, and directly violates pillar 3.
**Early warning:** reviewer rejection rate on the first 30 generated records. Above 20%
means the prompt is wrong. Secondarily, a falling eval refusal rate — a model that stops
saying "the sources don't say" has started making things up.

**3 · Review capacity, not budget, caps what ships.**
The whole NT costs $0.60 to generate and an unknown number of human hours to review
(`ai-model-strategy.md §5`). If review runs at, say, 20 records a week, Acts alone
(~230 records) is three months.
**Early warning:** reviewed-records-per-week in the first two weeks of M7. Below 40, the NT
is off the table for this run and the roadmap must say so out loud rather than slipping.

**4 · Live chat drains the key.**
Pre-compute is a fixed ≈$0.60. Chat is unbounded: ≈11,800 turns of remaining credit, and a
runaway test loop is the classic way to spend it.
**Early warning:** the ledger's `total_usd` slope per day, and any `BudgetExceeded` in the
logs. Note the trap already measured: a guard polling `GET /api/v1/credits` under-counts
in-flight spend by up to a minute and can be raced through the ceiling — meter on each
response's `usage.cost` (`ai-model-strategy.md §1`).

**5 · The map does not look like the mockups.**
`M-01` is unanswered and the provisional default is *no tile provider at all*. `image1.png`
is the PRD's hero image and a stylised GeoJSON map may not carry it.
**Early warning:** a side-by-side of the M5 prototype against `image1.png` in the first
week of M5 — early enough to escalate `M-01` and still change course.

**6 · Versification divergence corrupts the Word Root badge.**
Hebrew and Greek verse numbering diverges from KJV; without the STEPBible TVTMS mapping,
~560K word rows attach to the wrong verses — silently, and in a way no UI test catches.
**Early warning:** the M4 ingest assertion — count of `verse_words` rows whose `verse_key`
has no matching `verses` row must be exactly 0. If it is not, stop the loader.

**7 · Per-token re-rendering makes chat unusable on a real device.**
The Flutter app rebuilds its entire shell per SSE delta and Flutter absorbs it; React will
not (`flutter-port-map.md §4`).
**Early warning:** frame rate during a 200-delta reply on the target Android device,
measured in M0 and re-measured in M6 against the real Markdown tree.

**8 · The scripture text has no local copy.**
Both loaders fetch from `raw.githubusercontent.com` at load time and nothing is bundled
(`data-inventory.md §4`). If that repo moves or the DB volume is lost, there is nothing to
rebuild from.
**Early warning:** a scheduled loader dry-run failing. Mitigation is cheap and scheduled in
M1: vendor a checksummed snapshot.

**9 · Share-alike contamination of the pre-computed record.**
The best Root, Cultural and Lineage sources are CC BY-SA, and the spec's passage record
blends sources by design (`Q-007`).
**Early warning:** make it impossible to notice late — the M4 builder assertion fails the
build if a share-alike `source_id` reaches `passage_enrichment`.

**10 · Scope spreads across five tabs and the reader stops being the best thing here.**
`P-03`'s provisional default says only the Bible tab must genuinely work. Home, Studio,
Discover and Journal are four more full surfaces.
**Early warning:** badges shipped vs badges planned at each milestone close. If M5 ends
with fewer than three sourced badges truly finished, stop starting tabs.

**11 · The concurrent `apps/`/`packages/` scaffolding diverges from this plan.**
A large workflow is writing those directories now; this document was written without
reading them.
**Early warning:** the first M1 task that has to fight the scaffold. Reconcile against
`flutter-port-map.md §9`'s file tree before building on top of it, and amend this roadmap
rather than working around it.

**12 · Expo web auth breaks the QA loop.**
Clerk's native SDK authenticates with `Authorization` while browsers force `Origin`, and
Clerk rejects requests carrying both — the same auth path cannot serve native and web
(`main.dart:50-53`). The unattended walkthrough runs on web.
**Early warning:** the first post-M3 walkthrough that cannot sign in. Test Expo web auth
inside M3, not after it.

---

## Appendix · Open questions this plan runs on

`0/88` answered, `11` blocking. Every item below is proceeding on its recommended default,
recorded in `docs/decisions/ASSUMPTIONS.md` per `W-01`.

| Id | Question | Provisional default in force | Milestone it gates |
|---|---|---|---|
| `P-02` ⛔ | Rewrite or fresh build? | Hybrid — Flutter's reader/chat behaviour, PRD's screens and visuals | All |
| `P-04` | How many badges for real? | The 5 highest-impact | M2, M5 |
| `D-01` ⛔ | Dark cinematic? | Yes; tokens allow a light theme later | M1 |
| `T-01` ⛔ | Platforms? | Android device (+ web for QA) | M0, M11 |
| `B-01` ⛔ | Keep FastAPI? | Keep, restructure | M3 |
| `A-01` ⛔ | Auth for v1? | Anonymous device id now | M3 |
| `S-01` ⛔ | Translation? | Multiple open translations with a switcher | M1 |
| `AI-01` ⛔ | Generation scope? | All 28 chapters of Acts (~$0.05) | M7 |
| `M-01` ⛔ | Mapbox token? | No token — stylised GeoJSON map | M5 |
| `AU-01` ⛔ | Podcast realism? | Open TTS (Kokoro/Piper), generated locally | M9 |
| `W-01` ⛔ | Handling unanswered questions? | Take the recommendation, log it, keep moving | All |
| `Q-005` | Two chat surfaces or one? | One unified chat carrying passage context | M6 |
| `Q-006` | Tablet/desktop layouts? | Phone-only | M1 |
| `Q-007` | Share-alike posture? | Keep table-scoped | M4, M5 |
| `Q-008` | Source the four dataset-less badges? | LLM-generate flagged + hand-built ruler table | M7 |
| `Q-009` | Passage- or verse-keyed storage? | Verse-keyed + pericope table | M4 |
| `Q-010` | Embeddings? | Self-host BGE-M3 behind a swappable interface | M6 |
| `Q-011` **new** | Android inline-pill fallback? | Square corners on Android, rounded on iOS/web | M0 |
| `Q-012` **new** | Shipping bar for generated content? | Human-reviewed before visible; Acts only | M7 |

When an answer arrives that contradicts one of these, move the row to **Resolved** in
`ASSUMPTIONS.md` with a note on what had to change, and amend the affected milestone here.
Never silently delete a row.
