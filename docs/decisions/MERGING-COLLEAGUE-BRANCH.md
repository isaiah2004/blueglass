# Merging `colleague/m5-lineage-manuscript` into `main`

There is parallel work on two branches that **merges cleanly in git and then fails to
compile**. This note records exactly what breaks and how to fix it, so nobody has to
rediscover it.

| Branch | Contents |
|---|---|
| `main` | M1, M2, the AI model change, and the handoff docs. Self-consistent: typecheck, lint, and 1,799 tests all pass. |
| `colleague/m5-lineage-manuscript` | Lineage and Manuscript badge sheets, a progress tracker, and a Copilot mockup spec. Two commits. |
| `feature/blueglass-updates-20260829` | Identical tip — a second copy, kept as a backup. |

Both branches share the base commit `7ce7758` (M2).

---

## Why a clean merge still breaks

Git reports **zero conflicts** — the two branches mostly touch different files. But they
disagree *semantically*: the colleague branch **adds `lineage` to the `BadgeKind` union**,
and `main` has several exhaustive lookup tables keyed by that union which have no `lineage`
entry.

TypeScript's `satisfies Record<BadgeKind, string>` is doing exactly its job here — adding a
badge kind is *meant* to be a compile error until every table has been given an entry. The
strictness is the feature, not the obstacle.

Measured on the merge: **9 typecheck errors, 5 lint errors, 3 failing tests.**

## The five things to fix

| # | File | What is missing |
|---|---|---|
| 1 | `apps/mobile/src/components/InlineBadge.types.ts` | `badgeLabel` needs `lineage: 'Lineage'`. |
| 2 | `apps/mobile/src/features/sheets/textual/model/sheet-title.ts` | `TEXTUAL_KINDS` and `SHEET_TITLE` cover only `root`, `history`, `cross-ref`. The colleague branch extends `TextualBadge` with `LineageSheetBadge` and `ManuscriptSheetBadge`, so both need adding — and the module docstring's "the three kinds this folder renders" becomes five. |
| 3 | `apps/mobile/src/theme/colors.test.ts` | The expected badge-hue table needs `lineage`. The colleague branch already added the token itself (`PALETTE.badgeRose`, `#E8749C` dark / `#B03863` light) to `colors.ts` and `light-colors.ts` — only the test's expectation is behind. |
| 4 | `apps/mobile/src/components/InlineBadge.passage.test.ts` | The fixture asserts "all ten badge kinds". With Lineage it is eleven. See the note below — this is a real decision, not a number to bump. |
| 5 | `apps/mobile/src/features/sheets/textual/manuscript/WitnessCard.tsx` | Unused `StyleSheet` import (lint error). Trivial. |

Nothing else conflicts. `docs/product/design-language.md` merged cleanly — the colleague
branch's mockup-index entries for `image2`, `image4` and `image7` and the Lineage hue row
are all preserved.

## The ten-versus-eleven question is already settled

Do not just change the number in the test. `Q-018` in the decision log settled this:

> **Eleven badges, not ten.** The product spec's prose says "10 Embedded Feature Badges" but
> lists eleven marks, and `design-language.md` originally gave a hue to only ten — Lineage
> had none.

The colleague branch's rose hue for Lineage is the implementation of that decision. So the
fixture and its assertion should move to **eleven kinds**, and the wording ("as the
reference mockup does") should be updated to say so — with a comment pointing at `Q-018`,
so the next person does not read it as a typo and change it back.

## Suggested procedure

```bash
git checkout main
git merge colleague/m5-lineage-manuscript      # merges clean; do not be reassured
pnpm typecheck                                  # 9 errors — work through them
pnpm lint                                       # 5 errors
pnpm test                                       # 3 failures
```

Fix the five items above, then:

```bash
pnpm typecheck && pnpm lint && pnpm test
docker compose up -d && pnpm walkthrough
```

The walkthrough matters here specifically: the colleague branch adds **two new badge sheets**
that no walkthrough step currently opens. Add a step for each before calling it done, or
they ship unexercised.

## What not to do

- **Do not delete or weaken the failing assertions to get green.** Each one is protecting a
  real invariant: every badge kind must have a label, a hue, and a sheet title.
- **Do not remove `lineage`** from the union to make the errors go away. `Q-018` decided
  eleven badges; the colleague branch is implementing that decision.
- **Do not force-push over either branch.** Both copies of the colleague work exist so this
  merge can be retried safely.

## History note

`main` was force-pushed once, on 2026-08-30, to remove a merge commit that combined these
two lines of work while broken. Both colleague commits (`6300046`, `eeceace`) were pushed to
their own branches *before* that force-push and are fully intact. Nothing was lost; the two
lines of work were separated so each is independently green.
