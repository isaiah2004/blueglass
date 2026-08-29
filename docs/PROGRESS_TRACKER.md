# Atlas Bible — Progress Tracker

**Purpose.** One place to see, at a glance, what the master spec (`Aletheia_ Your
Multimodal Bible Atlas - Master Product Specification Document.pdf`, extracted into
`docs/product/prd.md`) asks for, what is actually built on
`feature/blueglass-updates-20260829` right now, and what is next. Updated every session
that changes product-visible behaviour or ships a milestone from `docs/ROADMAP.md`.

**How to read this file.** ✅ done and walked through · 🟡 scaffolded (renders, no real
data/behaviour yet) · ⬜ not started. A row only moves to ✅ after the milestone's
`docs/qa/walkthroughs/` record exists per `CLAUDE.md`.

---

## 1 · Roadmap milestones (`docs/ROADMAP.md`)

| # | Milestone | Status | Evidence |
|---|---|---|---|
| M0 | Prove the signature interaction (badge spike) | ✅ | `app/spike/badges.tsx`, `docs/architecture/spike-inline-badges.md` |
| M1 | Reading canvas on real scripture | ✅ | commit `85fe550`; `app/(tabs)/read/[book]/[chapter].tsx` |
| M2 | One badge, end to end, on real data | ✅ | commit `7ce7758`; inline badge + Route/City spatial sheets |
| M3 | Identity, and the three defects that must not ship | ✅ (verified, uncommitted as a named milestone) | `app/modules/identity/*` (device-id resolver, no `dev-user` literal), `app/modules/study/presentation/router.py` (write requires `CurrentIdentity`, indexing decoupled from the request), CORS reads `settings.cors_origins` not `*`, `.gitignore` covers `.env*`. See §3 below for the one open follow-up. |
| M4 | The deterministic ingest (places, roots, culture, people) | ⬜ | `data/raw/*` holds vendored source snapshots only; no loader writes to Postgres yet |
| M5 | The sourced badge sheets | 🟡 | Route, 3D City, Word Root, Cross-Ref, History, Lineage, Manuscript sheets exist (`src/features/sheets/textual/`); Structure(Chiasm), Cultural, Meditate, Studio-Assistant `[Context]` still missing. Lineage/Manuscript unverified in this sandbox — no build/run available, see §4 |
| M6 | Grounded chat that actually cites | ⬜ | no RAG/pgvector module in `apps/api` yet; Studio Assistant / `[Context]` sheet not built |
| M7 | Generated enrichment, with review | ⬜ | — |
| M8 | The habit loop (Home tab) | 🟡 | `app/(tabs)/index.tsx` is scaffold copy, no streak/sync data (`A-03` not built) |
| M9 | Audio | ⬜ | no ElevenLabs pipeline, no audio player component |
| M10 | Discover, Manuscript, and the honest 3D City | 🟡 | `app/(tabs)/discover.tsx` scaffold only |
| M11 | Production hardening | ⬜ | — |

## 2 · Screen-by-screen build status (vs. the 12 mockups)

| Tab / Screen | Mockup(s) | Status | Notes |
|---|---|---|---|
| Home | `image3.png`, `image10.png` | 🟡 scaffold | Needs streak ring, Today's Drop hero, 3-step checklist, quick-access carousel — see `docs/product/copilot-mockup-spec.md` §Home |
| Bible (reader) | `image1,2,4,6,8,9,11.png` | ✅ core / 🟡 sheets | Reader canvas + 7 of 10 badge sheets shipped (Route, 3D City, Word Root, Cross-Ref, History, Lineage, Manuscript); Structure, Cultural, Meditate, and the Studio Assistant `[Context]` sheet remain |
| Discover | `image5.png` | 🟡 scaffold | 3D Travel Routes, Empire Timeline, Literary Patterns cards not wired |
| Studio | `image12.png` | 🟡 scaffold | Grounded Chat / Custom Notebooks toggle, audio overview, 2×2 artifact grid not wired |
| Journal | `image7.png` | 🟡 scaffold | Streak tracker, milestone reward, reflections feed, saved resources not wired; blocked on `J-01` client-side encryption |

## 3 · Scaling & extensibility principles (non-negotiable, every milestone)

Atlas Bible's current Acts-16-only feel is a build-order artifact (only M0–M3 + partial
M5 are done), not a design limit. `verse_key` is already whole-canon
(`book×1e6 + chapter×1e3 + verse`, 31,102 KJV verses loaded today). **Every future change
must be written so it works for all 66 books on day one, even if content only exists for
one chapter.** Concretely:

1. **Store enrichment verse-keyed, derive passages, never hand-author per chapter.**
   Add the `pericope` table (GiST range index, boundaries from BSB USFM `\s` headings —
   `Q-009`) and compute the spec's per-passage JSON at build time from verse-keyed rows.
   A hand-maintained `ACTS_16_11_15.json`-per-chapter file is the anti-pattern.
2. **Split every badge into "ingest" vs. "author," and scale each differently.**
   Route, 3D City pins, Word Root, Cross-Ref, Lineage, Manuscript are deterministic joins
   against real open datasets — write the loader once, it lights up all 66 books at once.
   History's `year_approx`/`roman_emperor`, Chiasm/Structure, Cultural, Meditate have no
   dataset — they are authored directly by the coding agent, per passage, at zero
   incremental API cost (`Q-024`), reviewed by the product owner before shipping, never
   one-off hand authoring with no review trail. **This is a review-bandwidth constraint,
   not a money constraint** — see `Q-024`: the old `$0.10`/`$0.40` budget language
   described a hypothetical paid third-party pipeline, not what actually ships. That
   pricing only re-applies if (a) an automated pipeline ever replaces hand-authoring at
   scale, or (b) the Studio Assistant's live, per-question grounded chat — the one
   surface with a genuine ongoing runtime cost, and the one to meter/bill per use.
3. **Models emit names, never coordinates or other structured facts.** All geometry
   (`camera_center`, `zoom_level`) is computed from resolved gazetteer bounding boxes.
   Never let scale re-open the "model guesses the number" failure mode (41km mean error
   measured in `ai-model-strategy.md`).
4. **Every badge sheet is a registry entry against one contract**
   (`SheetChrome` + payload type + hue), not a switch statement. Adding badge type #7 or
   book #67 must only ever mean adding data, never touching reader/rendering code.
5. **License tiers are decoupled from canon coverage.** Full canon ships now on
   public-domain BSB/WEB; ESV/NIV/NLT gate in later per-translation under Phase-2
   licensing. Never block coverage of the whole Bible on a translation's licensing status.
6. **Guard rails that must hold as content grows, checked on every ingest run:**
   - Zero-orphan-`verse_key` assertion (catches silent Hebrew/Greek versification drift
     before it's 66 books of silent gaps instead of one).
   - Share-alike source isolation (`Q-007`) — CC BY-SA content stays in its own sheet,
     never blended into the redistributable passage JSON.
   - AI spend metered on each response's `usage.cost`, never the async credits endpoint —
     required once generation runs across hundreds of chapters instead of one.

Every milestone below is graded against these six rules before it is marked ✅, in
addition to its own walkthrough.

## 4 · Open follow-ups

- **M3 / defect 2 wording.** The spec (`ROADMAP.md` M3) says "delete `PUT /study/{book}/{chapter}`."
  The shipped code keeps the route but requires `CurrentIdentity` and moved RAG indexing out
  of the request path — which closes the actual defect (unauthenticated write +
  side-effect index poisoning) without losing authenticated authoring. Recorded here rather
  than silently reverted; revisit if a reviewer wants the literal deletion.
- **M4 is code-complete as of the 2026-08-29/30 session** (see §5): all four loaders —
  places/gazetteer, word-root/lexicon, people/lineage, cultural dictionary — are written,
  parser-verified against real acquired data, and pushed. The one remaining step is running
  them against a live Postgres, which no session so far has had access to; whichever session
  first has a reachable database should run all four `ingest_*` commands in dependency order
  (structure → history; places, lexicon, people, dictionary have no ordering dependency on
  each other) and confirm the assertions pass for real, not just at parse time.
- **M7 no longer needs a reviewer-queue *tool*.** With `Q-024`'s amendment, authored badge
  content (Structure, Cultural, Meditate, History rationale) is written directly by the
  coding agent and reviewed by the product owner in the normal PR/commit review flow —
  no separate review-queue UI or generation-pipeline service is required for v1. The
  `reviewer-queue-tool` todo is downgraded from "must build" to "revisit only if/when an
  automated pipeline replaces hand-authoring at scale."

## 5 · Session log

| Date | What changed |
|---|---|
| 2026-08-29 | Verified M0–M3 already satisfied in code (not previously named as milestones in `CHANGELOG.md`). Filled in the three undocumented mockup rows (`image2`, `image4`, `image7`) in `docs/product/design-language.md`. Added this tracker and `docs/product/copilot-mockup-spec.md` (textual, Copilot-actionable descriptions of every mockup screen and sheet, mapped to real file paths). |
| 2026-08-29 | Added §3 "Scaling & extensibility principles" — the 6 rules every future milestone must satisfy so the app works canon-wide (66 books) by construction, not per-chapter. Derived from `docs/architecture/data-inventory.md` and `docs/architecture/ai-model-strategy.md`; not new decisions, just made explicit and binding here. |
| 2026-08-29 | Confirmed scope: v1 targets **Acts only** (28 chapters, ~230 generated records, human-reviewed per `Q-012`; $0.10 AI budget per `ai-model-strategy.md`), on architecture that is canon-wide by construction (§3). Whole-NT/whole-canon generation is explicitly held until reviewer capacity is re-answered — do not scale generation past Acts without revisiting `Q-012`. Execution gaps ahead of that: M4 loaders unwritten, M6 blocked on the RAG cosine-similarity fix (M3 item 3), no reviewer-queue tool exists yet for the human-review gate, and this sandbox needed a manual Node 20.19.4 + pnpm 10.33 toolchain (repo requires `engines.node >=20.19.4`; the environment default is Node 16 with no pnpm) and has no reachable Postgres/Docker daemon for running the loaders end-to-end. |
| 2026-08-29 | Shipped the last four `[Structure]`/`[Cultural]`/`[Meditate]`/`[Context]` badge sheets (all 10 UI sheets now exist), plus the `[Lineage]`/`[Manuscript]` sheets and the `lineage` theme-hue fix from the prior entry. Landed `Q-024`: amended `Q-012`'s cost framing — badge enrichment content (Structure, Cultural, Meditate, History rationale) is authored directly by the coding agent at zero incremental API cost, gated only by product-owner review bandwidth, not by an OpenRouter-style dollar budget; that budget math (`ai-model-strategy.md` §5) now applies only to (a) a hypothetical future automated pipeline at scale, and (b) the Studio Assistant's live grounded chat, which remains the one surface with a real ongoing per-call cost and the correct one to meter/bill. Acts stays the sequencing priority (spec'd MVP target), but the cost-based ceiling on going past Acts is gone — expansion to the rest of the canon is now a review-bandwidth question, tracked the same way. `reviewer-queue-tool` todo downgraded accordingly (see §4). |
| 2026-08-30 | **Discovered and resolved a parallel-work conflict on `main`.** A second agent ("colleague") was independently building the same Lineage/Manuscript sheets directly against `isaiah2004/blueglass`, and had already force-pushed `main` once to separate two colliding lines of work, leaving `docs/decisions/MERGING-COLLEAGUE-BRANCH.md` documenting the exact semantic break: our branch adds `lineage` to `BadgeKind`, and several exhaustive `Record<BadgeKind, ...>` tables elsewhere in the codebase had no entry for it. Merged `main` into `feature/blueglass-updates-20260829` (git-clean, as predicted) and fixed all five documented items plus the ones their note predated (our later Structure/Cultural/Meditate/Context sheets): `InlineBadge.types.ts` (`badgeLabel.lineage`), `sheet-title.ts` (extended from 3 to all 9 kinds this folder renders), `colors.test.ts` (hue table + "ten" → "eleven" badges per `Q-018`), `InlineBadge.passage.test.ts`/`.passage.ts` (fixture now exercises all eleven kinds — added a `lineage` badge on "household" in Acts 16:15), and `WitnessCard.tsx`'s stray unused import. Pushed the reconciled merge to `upstream/main` (fast-forward, `9b53abe..16415c5`) and synced `feature/blueglass-updates-20260829` to match. Lesson: before any future direct push to `main`, fetch first and check for divergence — another agent may be working the same repo concurrently. |
| 2026-08-29/30 (M4 session) | **Discovered every M4 loader was previously unrunnable — `data/raw/` held only `PROVENANCE.md` files, zero payload bytes, for every dataset including the ones with fully-written parsers** (places, lexicon, history, crossref, structure). Also discovered this sandbox has working outbound network access via `curl`/`web_fetch` (a capability not previously known), which unblocked real acquisition. Downloaded and verified — against the pre-recorded SHA-256 in each `PROVENANCE.md` — every already-registered dataset: `Events.csv`, `cross-references.zip`, OpenBible geocoding (`ancient.jsonl`/`modern.jsonl`), all 4 Murai `.xlsx` files, and all 52 NEUU Bible-dictionary files (including `README.md`, which an earlier session's `PROVENANCE.md` recorded a digest for but had never actually fetched). All matched on first try. `dodson.csv`, `HebrewStrong.xml` and the three STEPBible `TAGNT`/`TBESG` files were also fetched (no per-file digest exists in that subsystem to check against). Wikidata rulers JSON was **not** reconstructed — the registered digest is for a filtered/derived SPARQL result, not the raw query output, and no derivation script exists; flagged as an honest, un-guessed-at gap rather than risking a wrong reconstruction. Confirmed `data/.gitignore` deliberately excludes `raw/**` (payloads are never committed, only re-downloaded from each dataset's own URL+checksum) — none of this session's downloaded bytes were committed. |
| 2026-08-29/30 (M4 session, cont.) | **Wrote and validated the two genuinely-missing M4 loaders: People/Lineage and Cultural/dictionary.** People/Lineage (`person_rows.py`, `theographic_people.py`, `person_assertions.py`, `ingest_people.py`, migration `0012`) parses Theographic's `People.csv` into `people`/`person_relations`/`person_mentions` — all 3,069 rows loaded regardless of Theographic's own `wip`/`publish` status (measured: 2,783 of 3,069 are `wip`, but `LineagePerson` only needs id/name/optional epithet, so nothing is dropped for want of finished prose). Only `parent-of` and `spouse-of` edges are derived (`LineageRelationKind` has no sibling variant, so Theographic's sibling columns are deliberately not loaded). CC BY-SA 4.0, table-scoped per `Q-007`. Cultural (`dictionary_rows.py`, `neuu_dictionary.py`, `dictionary_assertions.py`, `ingest_dictionary.py`, migration `0013`) parses NEUU's Easton+Smith JSON into `dictionary_entries`/`dictionary_citations` — a **citation table for M7's future authored Cultural prose to quote from, not the prose itself** (chosen over unfoldingWord's `en_tn` per `dataset-validation.md` §3.5 "Option D": `en_tn` is NEEDS-DECISION and only 18.7% Acts-relevant, where Easton/Smith are cleared USE). Of 56,155 raw scripture references, 54,545 (97.1%) resolve to a single verse or same-chapter range and become a citation row; whole-chapter and cross-chapter references are counted and reported as not-modelled rather than guessed at. Both loaders follow the existing `place_*`/`ingest_history.py` pattern exactly (row dataclasses → pure parser → hardcoded measured-expectation assertions run inside the load transaction → delete-then-copy ingest script) and were verified end-to-end against the real files in this sandbox under Python 3.11 (found via `/export/apps/python/3.11/`, needed for `enum.StrEnum`), producing the exact counts now hardcoded in the assertions: 3,069 people / 1,888 relations / 28,240 mentions; 8,523 entries / 54,545 citations. Migration chain re-verified single-headed at `0013_dictionary_entries`. **All four M4 loaders (places, lexicon, people/lineage, dictionary) are now code-complete**; none has been run against a live Postgres (this sandbox has none) — that remains the one unverified step, same limitation as the whole session. Pushed to `upstream/feature/blueglass-updates-20260829`. |
