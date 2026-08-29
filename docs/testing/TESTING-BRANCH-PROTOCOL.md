# Testing branches — how to get your work tested without Docker

You cannot run Postgres or Docker locally, so you cannot run the walkthrough suite, the
backend tests, or anything that needs a database. That would normally mean you write code
blind and hope.

This protocol fixes that. **You describe what you changed and what you want proven. You push
a branch. A machine that does have Docker picks it up, runs it for real, and pushes the
results back onto your branch.**

You keep working while it runs. Nothing blocks.

---

## The shape of it

```
   you                                        the test machine
   ───                                        ────────────────
   write code
   write .testing/request.md
   push  test/<your-slug>          ─────▶     scans for test/* branches
                                              checks out your branch
   keep working                               runs what you asked for
                                              writes .testing/results/NNN-*.md
   git pull                        ◀─────     pushes it back to YOUR branch
   read the results
```

Your branch is never force-pushed, rebased, or squashed. Results only ever arrive as **new
commits on top of yours**. If you have pushed again in the meantime, results land on top of
that — you never lose work.

---

## What you do

### 1 · Branch naming

The branch **must** start with `test/`. That prefix is the entire trigger; nothing else is
scanned.

```bash
git checkout -b test/lineage-sheet
```

Good names: `test/lineage-sheet` · `test/manuscript-witness-card` · `test/dark-mode-contrast`

### 2 · Write `.testing/request.md`

Create the file at exactly that path. It has a small header block and a free-text body.

````markdown
---
id: lineage-sheet-render
title: Does the Lineage sheet render and open from a badge?
priority: high
needs: docker, walkthrough, screenshots
---

## What I changed

Added `LineageSheet.tsx` and `lineage-rows.ts` under
`apps/mobile/src/features/sheets/textual/lineage/`. Added a rose hue for the Lineage badge
to `colors.ts` and `light-colors.ts`.

## What I want tested

1. The app still builds and typechecks.
2. A Lineage badge appears somewhere in Matthew 1 (a genealogy chapter).
3. Tapping it opens the sheet, and the sheet shows the ancestor rows, not a teaser.
4. It looks right in **both** themes and at phone width.
5. The rose hue is actually distinguishable from the gold and cyan badges.

## How I would know it worked

A screenshot of the Lineage sheet open on Matthew 1, on phone, in dark mode, with real
names in it.

## What I think might be broken

I could not run typecheck against the real badge union, so `lineage` may be missing from
some lookup table. I also guessed the payload shape from `textual-payloads.ts`.
````

#### Header fields

| Field | Required | What it does |
|---|---|---|
| `id` | yes | Short kebab-case identifier. Appears in the result filenames. |
| `title` | yes | One line, plain English. |
| `priority` | no | `high` · `normal` · `low`. Default `normal`. High jumps the queue. |
| `needs` | no | Comma-separated hints: `docker`, `walkthrough`, `screenshots`, `backend`, `ingest`, `manual`. Default is to run whatever seems relevant. |

#### Body sections

All optional, but the more you give, the more useful the answer.

- **What I changed** — orients the run. Saves it guessing from the diff.
- **What I want tested** — a numbered list. **This is the most important section.** Each item
  becomes something explicitly checked and reported on.
- **How I would know it worked** — describe the observable outcome. "A screenshot of X" is a
  perfect answer, and screenshots are cheap.
- **What I think might be broken** — your hunches. They are usually right and they focus the
  run enormously.

### 3 · Push

```bash
git add .
git commit -m "test: lineage sheet render check"
git push -u origin test/lineage-sheet
```

Then go and do something else.

### 4 · Read the results

```bash
git pull
cat .testing/STATUS.md
```

`.testing/STATUS.md` is the summary of the most recent run. Full detail, including every
command's real output, lands in `.testing/results/NNN-<id>.md`. Screenshots go in
`.testing/results/NNN-<id>/`.

---

## What comes back

Every result file follows the same shape, so you can skim it in ten seconds:

```markdown
# Result 001 · lineage-sheet-render

**Verdict: NEEDS WORK** — 3 of 5 checks passed.
Ran against commit a1b2c3d on 2026-08-30T14:22Z.

## Summary
The sheet renders and the data is right. It does not compile against main's badge tables,
and the rose hue fails contrast in light mode.

## Your checks
| # | What you asked | Result |
|---|---|---|
| 1 | App builds and typechecks | ❌ 4 errors — `lineage` missing from `badgeLabel` |
| 2 | Lineage badge appears in Matthew 1 | ✅ 14 badges found |
| 3 | Tapping opens the sheet with ancestor rows | ✅ see screenshot 03 |
| 4 | Both themes, phone width | ⚠️ dark fine, light unreadable |
| 5 | Rose distinguishable from gold and cyan | ⚠️ 2.9:1 against card in light |

## What I ran
[the actual commands, with real output]

## What I would fix first
[ranked, with file and line]
```

**Verdicts:** `PASS` · `NEEDS WORK` · `BLOCKED` (could not run — reason given) ·
`INFO` (nothing to assert, here is what I observed).

---

## Rules

**For you**

- Branch name **must** start with `test/`, or nothing happens.
- One `.testing/request.md` per branch. Update it and push again to request a re-run.
- **Do not force-push a branch that has results on it** — you would delete evidence.
- Push whenever you make progress. A commit is the unit of "please look at this."
- Do not commit secrets. `.env` is gitignored; keep it that way.

**For the test machine**

- Never force-pushes, rebases, or squashes your branch.
- Never edits your source. It only adds files under `.testing/`.
- If your branch does not compile, that is **reported as a result**, not treated as a failure
  to run. A broken branch is exactly the thing worth knowing about.
- Reports honestly. A red result you can trust beats a green one you cannot.

---

## Requesting a re-run

Push again. Any new commit on a `test/*` branch is picked up, and results are numbered in
sequence — `002`, `003` — so you can see whether a fix actually moved things.

To ask for something different without changing code:

```bash
# edit .testing/request.md
git commit -am "test: re-run, focus on light mode contrast"
git push
```

---

## Worked example, start to finish

```bash
git checkout main && git pull
git checkout -b test/manuscript-witness-card

# ... write code ...

mkdir -p .testing
cat > .testing/request.md <<'EOF'
---
id: manuscript-witness-card
title: Does WitnessCard render the manuscript witnesses?
priority: normal
needs: docker, screenshots
---

## What I changed
Added `WitnessCard.tsx` under `features/sheets/textual/manuscript/`.

## What I want tested
1. Typecheck and lint pass.
2. The Manuscript badge opens a sheet listing witnesses with their sigla.
3. Long sigla lists do not overflow at 375px.

## What I think might be broken
I left an unused `StyleSheet` import. Lint will probably fail on it.
EOF

git add .
git commit -m "test: manuscript witness card"
git push -u origin test/manuscript-witness-card
```

Then later:

```bash
git pull
cat .testing/STATUS.md
```

---

## Why it is built this way

**Branches, not issues.** The code and the request travel together. There is never a
question of which version was tested — the result names the exact commit.

**Results committed, not messaged.** They live next to the code they describe, survive
forever, and are readable offline. You can `git log` the history of a problem.

**Additive only.** Results are new commits on top of yours. Nothing you wrote is ever
rewritten, so the protocol cannot eat your work even if something goes wrong.

**Honest verdicts.** `BLOCKED` is a real, respectable outcome. If the branch does not build,
you get told that plainly with the compiler output, rather than a vague failure.

---

## If something goes wrong

| Symptom | Cause |
|---|---|
| No results after a while | Branch name does not start with `test/`, or `.testing/request.md` is missing or misnamed |
| `BLOCKED — could not parse request` | The `---` header block is malformed. `id` and `title` are both required |
| `BLOCKED — merge conflict with main` | Your branch is far behind. `git pull origin main` into it and push again |
| Results reference an old commit | You pushed while a run was in flight. Push again to trigger a fresh one |

Anything else, just ask — the protocol is young and worth improving.
