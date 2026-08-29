# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project Overview

**Atlas Bible** (codename *Aletheia*) — a multimodal Bible atlas. Scripture is rendered
as an interactive canvas: inline badges inside each verse open focused sheets containing
3D route maps, dual-axis history timelines, Greek/Hebrew word roots, manuscript variants,
literary structure, and grounded AI commentary. A 5-minute daily habit loop
(listen → explore → reflect) drives retention through streaks.

Tagline: **See the Context. Hear the Voice. Live the Word.**

This repository is a **rewrite** of a Flutter prototype (`A:\Work\spark\spark-app`) into
React Native / Expo, built against the master product specification.

### Source material — all READ-ONLY, never modify
| Path | What it is |
|---|---|
| `A:\Work\spark\spark-app` | The Flutter prototype + FastAPI server being replaced. Mine for behaviour, data, and API contracts. |
| `A:\Work\gt\ControlSight` | Unrelated project. Source of the engineering standards in `.claude/rules/`. Reference only. |
| `docs/product/prd.md` | Extracted master product specification. |
| `docs/product/mockups/` | The twelve reference mockups from the spec. |

## The 4 product pillars

These are the acceptance criteria for every feature. If a change weakens one, it is wrong.

1. **Pristine reading canvas** — no floating menus or dock clutter over scripture.
2. **Point-of-need intelligence** — context arrives where the reader already is, never via a detour.
3. **Zero-hallucination AI** — every claim carries a citation, or it is not rendered.
4. **The 5-minute habit loop** — the daily path must be completable in five minutes.

## Decisions & open questions

**All 98 questions are answered.** Read the decision log before any task.

- **[`docs/decisions/DECISIONS.md`](docs/decisions/DECISIONS.md)** — the curated log. Start here.
  It records the 26 places the human overrode a recommendation, four resolved conflicts,
  and the findings that changed the plan.
- `docs/decisions/ANSWERS.md` — machine-generated full dump of all 98 answers.
- `docs/decisions/ASSUMPTIONS.md` — the few calls still awaiting confirmation.
- Live state: `node tools/question-hub/answers.mjs --all`

**If the decision log contradicts what you were about to build, the log wins.**

### The overrides most likely to be built wrong from memory

1. **Web is first-class**, not a testing convenience. No native-only libraries in shared
   code — `react-native-mmkv` has no web build.
2. **Full phone / tablet / desktop parity.** The rail, the split pane and the
   ≥600/≥1100 dp breakpoints are all in scope. Port-map risk #5 is live, not retired.
3. **Data syncs across devices** — streaks, journal, flashcards.
4. **Journal is end-to-end encrypted.** Client-side encryption before sync; the server
   holds ciphertext and can never read, search, or index an entry.
5. **Light mode actually ships.** Every component verified in both themes.
6. **A day completes on opening and reading** — not the 3-step loop.
7. **Never redistribute the database.** Enrichment is server-delivered; that is what keeps
   the share-alike licences from triggering.
8. **A CHANGELOG entry and version bump for every change.**

When you hit a decision only the product owner can make:

```bash
node tools/question-hub/ask.mjs \
  --section "18 · From the fleet" --q "<the question>" --why "<why it matters>" \
  --kind choice --opt "A" --opt "B" --rec "A" --by "<your-agent-name>"
```

Then **keep working**. Take the recommended option, record it in
`docs/decisions/ASSUMPTIONS.md` with the question id, and carry on. Never idle waiting
for an answer. Only stop if proceeding either way would be unsafe or would waste
substantial work.

## Tech Stack

Entries marked *(provisional)* follow the recommended default of an unanswered question
and must be re-checked against `docs/decisions/ANSWERS.md` before being relied upon.

| Layer | Decision |
|---|---|
| Client | Expo (React Native), TypeScript strict *(provisional)* |
| Routing | Expo Router — file-based, typed routes *(provisional)* |
| Client state | Zustand *(provisional)* |
| Server state | TanStack Query + persisted MMKV cache *(provisional)* |
| Styling | `StyleSheet` + a typed design-token module *(provisional)* |
| Backend | FastAPI (Python 3.12), restructured to the layering rules below *(provisional)* |
| Database | PostgreSQL 16 + pgvector, in Docker *(provisional)* |
| LLM provider | OpenRouter — cheap open-weight models only. See `docs/architecture/ai-model-strategy.md`. |
| Local dev | `docker compose` with hot-reload bind mounts *(provisional)* |
| Repo layout | pnpm workspaces — `apps/`, `packages/` *(provisional)* |

### Non-negotiable AI constraint

The OpenRouter key holds **$4.57 remaining** (measured 2026-08-28; the brief said "~$2",
pending confirmation in `AI-01` whether $2 was a deliberate self-imposed cap).

- Cheap **open-weight** models only. No large frontier models. Ever.
- Every AI call goes through the spend guard and the disk cache — no exceptions,
  no direct `fetch` to a provider from feature code.
- Automated test loops must be incapable of draining the budget. If you cannot
  prove that, the guard is not finished.
- **Meter on each response's `usage.cost` field, never on `GET /api/v1/credits`.**
  The credits endpoint settles asynchronously (measured lag up to a minute), so a guard
  polling it under-counts in-flight spend and can be raced through the ceiling.
- **Never let a model emit coordinates.** Measured mean error was 41 km even for the best
  extractor, which renders map pins visibly wrong. Models emit place *names*; code
  resolves them against a gazetteer (Pleiades / OpenBible.info).

Current model defaults live in `docs/architecture/ai-model-strategy.md` — that document
is measured, not recalled. Read it before touching anything AI-related.

## Code Rules

All code must comply with these — inherited from ControlSight, adapted here:

- [SOLID Principles](.claude/rules/solid-principles.md)
- [Naming Conventions](.claude/rules/naming-conventions.md)
- [README & Deployment Documentation](.claude/rules/readme-documentation.md)
- [Code Documentation](.claude/rules/code-documentation.md)
- [Project Structure & Anti-Monolithic Design](.claude/rules/project-structure.md)
- [Error Handling & Resilience](.claude/rules/error-handling.md)
- [Logging & Observability](.claude/rules/logging-observability.md)
- [Test-Driven Development](.claude/rules/test-driven-development.md)
- [Implementation Planning](.claude/rules/implementation-planning.md)

Verify against the [Quick-Reference Checklist](.claude/rules/checklist.md) before
calling any change done.

### Where this project overrides ControlSight

ControlSight's rules were written for a Next.js + FastAPI + PM2 monorepo. Two rules
are deliberately superseded here; everything else applies verbatim.

| Rule | ControlSight | Here | Why |
|---|---|---|---|
| 5.0 Repo layout | One root `package.json`, no workspaces | pnpm workspaces | An Expo app and a shared types package genuinely need separate manifests. Sharing types between client and server is worth more than manifest minimalism. |
| Styling | shadcn/ui + Tailwind | Design tokens + RN primitives | shadcn/ui is DOM-only. The equivalent discipline here: **never inline a raw colour, size, or spacing value** — always reference a token. |

### Hard limits, restated

- **No file exceeds 300 lines.** No function exceeds 50 lines.
- **Domain layer has zero infrastructure imports.**
- **No empty catch blocks.** Specific exception types only.
- **No `console.log` in shipped code** — use the structured logger.
- **No secrets in logs, docs, commit messages, or agent output.**

## Testing

The end state is a production-ready app, verified by clicking through the real UI —
not by unit tests alone.

| Layer | Tool |
|---|---|
| Unit / logic | Vitest |
| Component | React Native Testing Library |
| API integration | pytest + httpx |
| E2E (web build) | Playwright — driven continuously, unattended |
| E2E (device) | Maestro — before each milestone |
| AI output | Golden-set evals for citation accuracy |

**The walkthrough loop.** The definition of done for a feature is not "tests pass" —
it is: design a high-coverage walkthrough of the app, run it, find bugs, fix them,
repeat until a full pass is clean. Record each walkthrough in `docs/qa/walkthroughs/`
with its date, route, findings, and fixes.

## Versioning

`MAJOR.FEATURE.PATCH`, tracked in the root `package.json` and `CHANGELOG.md`.
A `CHANGELOG.md` entry per feature; one PATCH bump per fix.

## Working with the fleet

Multiple agents work this repo in parallel. To keep them coherent:

- **Read before writing.** Check `docs/architecture/` and `docs/decisions/` first —
  another agent may have already mapped what you are about to map.
- **Own your files.** Do not edit a file another running agent was told to own.
- **Leave the map better.** New architectural understanding goes into `docs/architecture/`,
  so the next agent does not have to rediscover it.
- **Never modify the read-only source repos.**
