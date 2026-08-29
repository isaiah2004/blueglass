# Handoff

For a person or an agent picking this repo up cold. Read this first; it is the shortest
path to being useful.

---

## 1 · What this is

**Atlas Bible** (codename *Aletheia*) — a multimodal Bible atlas. Scripture is an
interactive canvas: small pills sit *inside* the verse text, and tapping one opens a
focused sheet with a map, a Greek or Hebrew root, a manuscript variant, a timeline, or
cross-references. The premise is that context should arrive where the reader already is,
never via a detour to another app.

It is a **rewrite of a Flutter prototype into React Native / Expo**, built against a
product spec. The prototype (`A:\Work\spark\spark-app`) is read-only and being replaced —
it is worth reading for behaviour, not for code.

**Repo:** https://github.com/isaiah2004/blueglass (public)

### The four pillars — these are acceptance criteria, not slogans

1. **Pristine reading canvas** — nothing floats over scripture except a sheet the reader opened.
2. **Point-of-need intelligence** — context arrives inline, never via a detour.
3. **Zero hallucination** — every claim carries a citation, or it is not rendered.
4. **A 5-minute daily habit loop.**

Pillar 3 is enforced structurally, not aspirationally: a badge with no provenance does not
render. Several bugs in this repo's history were "the UI asserted something the text did
not support", and they were treated as more serious than crashes — a crash is visible, a
false claim is believed.

---

## 2 · Running it in five minutes

Prerequisites already installed on the original machine: Node 25, pnpm 10, Docker, Python
3.12, Chrome. **Install packages, never software** — that is a standing constraint.

```bash
pnpm install
docker compose up -d          # Postgres+pgvector on :5436, API on :8010
pnpm db:seed                  # loads scripture; safe to re-run, it is idempotent
pnpm web                      # Expo web build
```

Check it is alive:

```bash
curl http://localhost:8010/ready
curl "http://localhost:8010/chapters/BSB/acts/16"
curl "http://localhost:8010/badges/chapters/BSB/acts/16"
```

The quality gates:

```bash
pnpm typecheck && pnpm lint && pnpm test        # TypeScript side
docker compose run --rm api pytest -q            # Python side
pnpm walkthrough                                 # the real UI, in real Chrome
```

`pnpm walkthrough` is the one that matters — see §4.

---

## 3 · Where things stand

**Pushed to `main`:** 3 commits — M1 (reading canvas), a model-registry change, M2 (badges).

**Uncommitted:** a large quality pass — truth fixes, map rendering, and a much wider
walkthrough. Green locally; not yet pushed at the time of writing.

### What actually works

- A reading canvas over **124,372 verses** in four openly-licensed translations
  (KJV, ASV, BSB, WEB). **No ESV** — it is licensed, and appears in the mockups only as a
  mockup. Do not add it without an agreement.
- Five badge types inline in scripture — Route, Site, History, Root, Cross-Ref — each
  opening a sheet with real sourced data and visible attribution.
- Maps drawn from GeoJSON. **No tile provider, no Mapbox token, no API key.**
- Light and dark themes, both real. Phone, tablet and desktop layouts including a
  resizable context rail.

### Data loaded (measured, not estimated)

| Table | Rows |
|---|---|
| `cross_references` | 344,799 |
| `verse_words` | 142,096 |
| `verses` | 124,372 |
| `lexicon` | 19,714 |
| `structure_nodes` | 10,085 |
| `place_mentions` | 8,742 |
| `places` | 1,342 |
| `routes` | 682 |
| `rulers` | 43 |

All from open datasets with verified licences. Every payload in `data/raw/` has a
`PROVENANCE.md` recording source URL, licence text, retrieval date, checksums and counts.
**The payloads are gitignored; the provenance files are not.**

### Test position

~1,700 TypeScript tests · 342 Python tests · a **237-step UI walkthrough** across three
viewports and both themes.

---

## 4 · Three things about this project that are unusual

### The walkthrough loop is the definition of done

"Tests pass" is not the bar. The bar is: design a high-coverage walkthrough, run it against
the real UI in a real browser, find bugs, fix them, repeat until a full pass is clean.

```bash
pnpm walkthrough
```

It drives the Expo **web** build through installed Chrome (`channel: 'chrome'` — never
`npx playwright install`, that installs software), at phone/tablet/desktop, in both themes,
capturing a screenshot at every step into `docs/qa/walkthroughs/<run>/`.

**Look at the screenshots.** Every serious bug in this repo's history was found by someone
looking at an image, not by a red test: the tablet band silently getting the phone layout,
an inland map rendering as an abstract shape, a sheet that opened but showed only a teaser.

### The Question Hub — answer from your phone

> **The product owner explicitly recommends this and asked that it be passed on.** It is the
> single practice that made this project work, and it is worth adopting before you write any
> code.

`tools/question-hub/` is a zero-dependency Node service that binds to `0.0.0.0:7777` and is
reachable from any device on the same WiFi. **104 questions were answered from a phone**, in
short bursts, while the build carried on without the owner present.

```bash
node tools/question-hub/server.mjs           # prints every LAN address it is reachable on
```

Open the printed address (e.g. `http://192.168.0.102:7777`) on your phone. The UI is built
for one-handed use in a spare minute: multiple choice with an "Other" free-text escape,
reference images inline, per-section **accept all recommendations**, and keyboard shortcuts
on desktop.

**Why it matters.** A long autonomous build generates dozens of decisions only the owner can
make. Asking them one at a time in a chat serialises the whole project against one person's
attention — the build stops every time a question comes up. This decouples the two: agents
queue a question, record the default they are proceeding on, and keep building; answers
arrive whenever the owner has a moment. Nothing ever blocks.

```bash
node tools/question-hub/answers.mjs --all    # read every decision
node tools/question-hub/ask.mjs --help       # queue a question (agents)
```

Answers live in `tools/question-hub/data/` — **gitignored, so they exist only on the owner's
machine.** The committed snapshot is `docs/decisions/ANSWERS.md`.

Agents queue questions and **keep working** — take the recommendation, log the assumption in
`docs/decisions/ASSUMPTIONS.md`, carry on. Nothing blocks on a human.

### The decision log outranks your judgement

`docs/decisions/DECISIONS.md`. If it contradicts what you were about to build, **it wins**.
It records 26 places the owner overrode a recommendation, four resolved conflicts, and the
findings that overturned earlier plans.

The overrides most likely to be built wrong from memory:

1. **Web is first-class**, not a testing convenience. Never import a native-only module
   (`react-native-mmkv`) from shared code.
2. **Full phone / tablet / desktop parity.**
3. **Data syncs across devices** — streaks, journal, flashcards.
4. **The journal is end-to-end encrypted.** The server holds ciphertext and can never read
   or index an entry.
5. **Light mode actually ships.**
6. **A day completes on opening and reading** — not the spec's 3-step loop.
7. **Never redistribute the database.** Enrichment is server-delivered; that is what keeps
   the share-alike licences from triggering.
8. **A CHANGELOG entry and version bump for every change.**

---

## 5 · Where to look

| Question | File |
|---|---|
| Engineering rules | `CLAUDE.md`, `.claude/rules/*.md` |
| What was decided and why | `docs/decisions/DECISIONS.md` |
| All 104 raw answers | `docs/decisions/ANSWERS.md` |
| The plan | `docs/ROADMAP.md` — 12 milestones, riskiest first |
| The product spec | `docs/product/prd.md`, `docs/product/mockups/` |
| The visual system | `docs/product/design-language.md` |
| The app being replaced | `docs/architecture/flutter-port-map.md` — 23 endpoints, 11 ranked risks |
| What data exists | `docs/architecture/dataset-validation.md`, `data-inventory.md` |
| Model choices and costs | `docs/architecture/ai-model-strategy.md` — measured, not recalled |
| Local dev | `docs/DEVELOPMENT.md` |
| QA | `docs/qa/WALKTHROUGH.md` |

`docs/architecture/flutter-port-map.md` §7 — *behaviours worth preserving* — is the single
most useful section for anyone touching the reader.

---

## 6 · What's next

`docs/ROADMAP.md` has all twelve milestones. M1 and M2 are done.

- **M3 · Grounded chat** (Studio tab) — retrieval over pgvector with structural citations:
  every sentence carries a source anchor or is not shown.
- **M4 · Habit loop** — streaks, the daily drop, local notifications.
- **M5 · Journal** — end-to-end encrypted, syncing.
- Remaining badges: Manuscript (TAGNT is loaded and ready), Lineage, Cultural, Meditate.

Two badges have **no open dataset and cannot get one**: 3D City (renamed `[Site]` for
exactly this reason) and Meditate. Both negatives are documented so nobody searches again.

---

## 7 · Traps already paid for

Each of these cost real time. They are written down so they cost you none.

| Trap | What happens |
|---|---|
| **OpenBible `ancient.jsonl` has no coordinates.** | They live in `modern.jsonl`, joined on id, and `lonlat` is **longitude-first**. Getting this wrong silently places everything in the wrong hemisphere. |
| **Ordering route stops by verse renders journeys backwards.** | Acts 16:11 names Troas, Samothrace *and* Neapolis in one verse. Stops are ordered by position within the verse text. |
| **Translations disagree on place spellings.** | BSB has "an Adramyttian ship" where KJV has "a ship of Adramyttium". Pruning waypoints against one translation deletes pins for readers of another. |
| **The prototype maps only 3 of 66 books** between name and number. | A note outside Proverbs/Matthew/Ruth stored `book_number: 0`. Fixed here, with all 66 round-trip tested. Do not port that code. |
| **The prototype's RAG scores are wrong.** | Chroma persisted with `l2` while the code computed `1.0 - distance` as if cosine. |
| **The prototype has no real auth.** | Every `/me/*` route resolved to the literal string `dev-user`. Do not port the stub. |
| **`react-native-mmkv` has no web build.** | Web is first-class. Importing it from shared code breaks `pnpm web`. |
| **Alembic multi-head.** | Two agents branched from the same migration in one afternoon and `alembic upgrade head` failed outright. `test_schema.py` now computes the head and fails if there is more than one. |
| **The mockup palette fails WCAG AA.** | `ink.tertiary` measures 3.36:1 on card backgrounds. Small metadata uses `ink.secondary`. Locked by a contrast test. |
| **Colour emoji cannot be tinted.** | Badge glyphs are monochrome vector paths. And `backgroundColor` on nested `<Text>` is square on **every** platform, iOS included. |
| **`/api/v1/credits` settles asynchronously.** | Up to a minute late. The spend guard meters on each response's `usage.cost`; a guard polling credits can be raced through its ceiling. |
| **Models must never emit coordinates.** | Best extractor still averaged 41 km error. Models emit place *names*; code resolves them against the gazetteer. |

---

## 8 · Non-negotiables

- `A:\Work\spark\spark-app` and `A:\Work\gt\ControlSight` are **read-only**. Never write there.
- **Install packages, never software.**
- **AI budget is ~$4.50 on one OpenRouter key**, with a **$2 hard ceiling enforced in code**
  (`packages/ai-guard`). Every model call goes through the guard and its disk cache — no
  feature code calls a provider directly. A test proves a 10,000-call loop halts at the
  ceiling.
- No file over 300 lines. No function over 50. No `any`. No raw colour, size or spacing
  literals in components — always a design token.
- **Never weaken a test or assertion to make something pass.** If a test is genuinely wrong,
  fix it and say so.
- Never commit a secret. Only `.env.example` is tracked, and every key field in it is empty.

---

## 9 · If you are an agent

Read in this order, then start:

1. `CLAUDE.md`
2. `docs/decisions/DECISIONS.md`
3. `.claude/rules/*.md`
4. Whichever `docs/architecture/*.md` covers what you are touching

Then: write the plan, write the tests, write the code, run `pnpm walkthrough`, **look at the
screenshots**, and fix what you see. Queue anything only the owner can decide via
`tools/question-hub/ask.mjs` and keep working — never idle waiting for an answer.
