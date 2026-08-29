# Question Hub — Platform Specification

**Status:** authoritative build spec. Written 2026-08-29 against the running instance.
**Scope:** `tools/question-hub/` only. Nothing in `apps/` or `packages/` is touched.
**Audience:** three build agents working in parallel. Execute this literally.

---

## 0. The one thing that must not happen

`tools/question-hub/data/questions.json` holds **11 answers a human already gave**.
Losing them means asking a person to redo work. That is the only unforgivable failure
in this system, and every rule below that looks paranoid exists because of it.

| # | Invariant | Enforced by |
|---|---|---|
| I-1 | `data/questions.json` is never deleted, truncated, or hand-edited. Only the server writes it. | §4.6 backup gate; §4.7 snapshots; no agent owns `data/` (§8.4) |
| I-2 | Every schema change is **additive**. No field is renamed, retyped, or removed. | §4.1 additive field list; §4.6.3 the identity gate |
| I-3 | A server that does not understand the on-disk `version` **refuses to start** rather than writing over it. | §4.4 |
| I-4 | The server has **zero runtime dependencies**. It cannot fail to start because of a package install. | §8.1 ownership; `node:*` imports only |
| I-5 | Writes are atomic (temp + rename) and serialised through one promise queue. | `lib/db.mjs` (§8.1) |
| I-6 | Answering never blocks on the fleet; the fleet never blocks on answering. | §6 — long-poll waiters resolve outside the write queue |
| I-7 | The running instance on port 7777 is not killed by a build agent. Test servers use `HUB_PORT=7788`. | §9; §11 phase 3 is the only restart |

---

## 1. Measured starting state

Read from the live instance on 2026-08-29, not recalled.

| Fact | Value |
|---|---|
| Questions | 96 — 11 answered, 85 open |
| Sections | 18 |
| Kinds in use | `choice` 81 · `multi` 7 · `text` 8 · **`scale` 0** |
| Questions carrying a `recommended` | 88 of 96 |
| Open questions with **no** recommendation | 8 — these are the ones only the human can settle |
| `blocking` questions | 11 — all already answered (`blockingOpen: 0`) |
| Notes written | 3 (`D-01`, `AU-01`, `W-01`) |
| On-disk `version` | **1** — while `server.mjs` `EMPTY_DB` declares `2`. A fresh DB and the live DB already disagree. |
| Event log | 117 entries: `ask` 101, `answer` 12, `answer-batch` 1, `withdraw` 1, `status` 2 |
| `server.mjs` | 281 lines — near the 300 limit |
| `public/index.html` | **505 lines — already over the 300-line limit.** Splitting is mandatory, not optional. |
| Mockups | 12 PNGs, 1.7–2.1 MB each |

### 1.1 Three defects found in the live system

These are not hypothetical. Fix them as part of this build.

**D-A — `POST /api/withdraw` permanently destroys an answer.**
`handleWithdraw` does `db.questions.splice(index, 1)`. If an agent withdraws a question the
human already answered, the answer is gone with no trace. One withdraw has already run.
**Fix:** withdraw becomes a soft-delete — `status: 'withdrawn'`, `withdrawnAt`, `withdrawReason`.
`GET /api/questions` excludes withdrawn by default, so external behaviour is unchanged.

**D-B — re-asking a question orphans its answer.**
`handleAsk` on an existing id replaces `options` but preserves `answer`. `seed.mjs` is
run repeatedly to revise wording. If an option's text changes after it was picked, the
stored answer no longer corresponds to any option — silently.
**This has already happened.** `D-01`'s stored answer is
`"…(build tokens so it’s possible)"` (curly apostrophe) while its option reads
`"…(build tokens so it's possible)"` (straight apostrophe). A naive
`options.includes(answer)` treats a deliberately-picked option as free text.
**Fix:** §4.2 normalised matching + an `answer-orphaned` event + `needsReview` flag.

**D-C — an empty string silently un-answers a question.**
`applyAnswer` treats `''`/`null` as "unanswer". A text field cleared by a stray tap, or a
client that sends `answer: ''` for an untouched question, wipes a real answer and its timestamp.
**Fix:** §7 — batch entries with `answer === undefined` are ignored; un-answering requires
an explicit `{ "clear": true }`.

---

## 2. Question kinds

### 2.1 The dividing line

**Kind is semantics. Layout and attachments are presentation.** A kind exists only when
the *shape of the answer* is different. How the options are drawn is never a kind.

This one rule collapses three of the four proposed kinds into configuration, which is why
the final set is small enough to test exhaustively.

### 2.2 The full set — five kinds

| Kind | Answer shape | Status |
|---|---|---|
| `choice` | exactly one option, or Other | keep |
| `multi` | zero or more options, plus Other | keep |
| `text` | free prose | keep |
| `rank` | an ordered subset of the options | **new** |
| `scale` | one integer 1–5 | keep, **deprecated for new asks** |

**`rank` earns its place.** Several live questions are prioritisation in disguise —
`P-03` ("which of the 5 tabs must genuinely work") and `P-04` ("how many of the 10 badges")
are asked as `multi`/`choice` because ordering was not available, and the fleet then has to
guess a build order from an unordered set. Ranking is the answer the fleet actually needs.

**`rank` is tap-to-rank, never drag-to-reorder.** Tapping an option assigns it the next
number (1, 2, 3…); tapping a numbered option clears it and renumbers the rest. Rationale:
drag-reorder is the single hardest interaction to do one-handed on a phone, needs pointer
capture and scroll-lock, and is the most fragile thing in a Playwright suite. Tap-to-rank
is three lines of state, works with a thumb, and is keyboard-accessible for free.
A partial ranking is valid — ranking your top 3 of 10 and stopping is a real answer.

**`scale` stays accepted but is deprecated.** Zero of 96 questions use it. Removing it from
`VALID_KINDS` would violate I-2 and break any agent that has read the README. It stays
valid on input; `ask.mjs` prints a one-line deprecation notice suggesting `choice` with
labelled buckets, which reads better on a phone than a bare 1–5 row.

### 2.3 The three rejected kinds, and what replaces them

| Rejected | Why it does not earn a kind | What to build instead |
|---|---|---|
| `compare` (A/B with images) | The answer shape is identical to `choice` — pick one of two. Only the rendering differs. A separate kind would duplicate every code path in `choice`: selection, Other, accept-all, keyboard, swipe, migration. | `kind: "choice"` + `layout: "compare"` + an `image` attachment on each of the two options. |
| `swatch` (pick a colour) | Same — pick one of N. | `kind: "choice"` + `layout: "swatch"` + a `swatch` attachment per option. Chips render the real colour. |
| `confirm` (yes/no with consequences) | Same — pick one of two. What is genuinely missing is not a kind but a place to put the consequence text. | `kind: "choice"` with two options + a per-option `consequence` string, rendered under the option in `ink-secondary`. |

`layout` is an optional presentation hint on the question: `"list"` (default) ·
`"compare"` (2-up grid, side by side on any width ≥ 320 px) · `"swatch"` (chip grid).
An unknown `layout` **falls back to `"list"` and still renders** — a presentation hint may
never be able to break answering.

### 2.4 The "Other" escape — on by default

The human asked for this explicitly, so it is opt-out, not opt-in.

- Every `choice`, `multi`, and `rank` question gets an **Other** row unless the question
  sets `allowOther: false` (for genuinely closed sets, e.g. "which of these three files").
- The Other row is a tappable pill that expands into a single-line input, so it costs no
  vertical space until wanted and never grabs focus on load.
- On `choice`, typing into Other deselects any picked option — one answer means one answer.
- On `multi` and `rank`, Other is additive alongside picks.

### 2.5 How an answer is stored so "picked" and "written" are never ambiguous

Two fields. The old one keeps its exact current meaning; a new one carries the truth.

```jsonc
// unchanged, and its format is frozen — every existing reader keeps working
"answer": "Bible (Reader) | Studio (AI artifacts) | Other: Journal, but read-only",

// new, additive, authoritative
"answerDetail": {
  "kind": "multi",
  "selected": ["Bible (Reader)", "Studio (AI artifacts)"],  // ONLY exact option strings
  "other": "Journal, but read-only",                        // ONLY free text, or null
  "ranking": null,                                          // rank only: ordered option strings
  "text": null,                                             // text only: the prose
  "source": "human",
  "match": "exact",
  "needsReview": false
}
```

**The disambiguation rule, stated once and enforced everywhere:**

> A string may appear in `answerDetail.selected` (or `ranking`) **only if it is `===` to an
> entry in that question's `options` array.** Free text appears only in `other`.
> There is no third possibility, so a downstream reader never has to guess.

The flat `answer` string is **derived**, never authored:
`[...selected, other ? "Other: " + other : null].filter(Boolean).join(" | ")`.
For `rank`, `answer` is the ranking joined by `" > "`. For `text`, `answer` is the prose.
The `"Other: "` prefix means even a reader that only knows the old flat string can tell a
written answer from a picked one — the escape hatch degrades gracefully.

`source` records **how** the answer arrived, and it is genuinely load-bearing:

| `source` | Meaning | Why an agent cares |
|---|---|---|
| `human` | The human picked or typed this deliberately. | Highest confidence. Build on it. |
| `accepted-recommendation` | Accepted in bulk via "accept all" (§4.2). | The human endorsed the default but did not deliberate on it. Safe to build on; flag before betting a week of work on it. |
| `imported` | Derived by the v1→v3 migration from a pre-existing answer. | Provenance unknown. Treat as `human`. |

`match` is `"exact"` or `"normalised"` (see §3.2). `needsReview: true` means the platform
could not confidently reconcile the answer with the options and a human should glance at it;
it never blocks a read.

---

## 3. Attachments & artifacts

Answering "is this the right visual direction?" while looking at the mockup is a different
activity from answering it from memory. Attachments are what make the hub worth using.

### 3.1 The model

Two places an attachment can hang:

- `question.attachments` — an **array**, rendered between `why` and the options.
- `question.optionMeta[<option label>].attachment` — a **single** attachment on one option,
  rendered inside that option's row. This is what powers `compare` and `swatch`.

`options` stays `string[]` **forever** (I-2): answers are matched against it by exact string,
and a shape change there would break every existing reader and every stored answer. Rich
per-option data lives in a parallel map keyed by the option label:

```jsonc
"options": ["Warm paper", "Dark cinematic"],
"optionMeta": {
  "Warm paper":     { "attachment": { "type": "image", "src": "docs/product/mockups/image6.png" },
                      "consequence": "Restyle all 12 mockups. ~3 days.",
                      "hint": "The Flutter prototype's look." },
  "Dark cinematic": { "attachment": { "type": "image", "src": "docs/product/mockups/image9.png" } }
}
```

A map, not a parallel array, because a re-ask may reorder options and index drift would
silently attach the wrong image to the wrong option. **The server rejects duplicate option
labels** on `ask` — the map makes uniqueness a correctness requirement, so validate it.

### 3.2 The six attachment types

| `type` | Fields | Rendering |
|---|---|---|
| `image` | `src` (repo-relative), `alt` (**required**), `caption?`, `width?`, `height?` | `<img loading="lazy">` inside a fixed `aspect-ratio` box; tap opens a full-screen pinch-zoom `<dialog>`. |
| `swatches` | `swatches: [{ name, hex, note? }]` | Grid of colour chips, hex in mono beneath. Chip is the real colour; contrast-checked label. |
| `compare` | `left`, `right` (each an `image` attachment), `leftLabel`, `rightLabel` | 2-up grid, always side by side. Either half taps to full-screen. |
| `code` | `language`, `code`, `caption?` | `<pre>` in `--mono`, `overflow-x: auto`, no highlighting (no dependency), max-height 40vh then scroll. |
| `note` | `markdown` | A **strict subset** rendered by the client: paragraphs, `**bold**`, `` `code` ``, `- ` lists, `> ` quote. No raw HTML, no images, no links. Anything unrecognised renders as literal text. |
| `link` | `href`, `label`, `caption?` | Anchor with `target="_blank" rel="noopener noreferrer"`. `href` must be `http:` or `https:` — the client refuses `javascript:`, `data:`, `file:`. |

`compare` nests two `image` attachments rather than inventing a second image shape, so the
path-safety rule below applies to it with no extra code.

**Unknown `type` renders as a dimmed "unsupported attachment" placeholder and nothing else
breaks.** A future attachment type must never make an old client fail to render a question.

### 3.3 Serving images safely — the path rule

> **The media endpoint is a projection of the question log, not a file browser.**

`GET /media/<repo-relative-path>` is the only route that reads a file outside
`tools/question-hub/`. Every one of these gates must pass, in this order. Any failure is a
bare `404` with no detail — the response never distinguishes "not allowed" from "not there",
so it cannot be used to probe the filesystem.

1. **Reject before decoding.** If the raw path contains `\`, `\0`, `..`, or a second `%`
   after one decode pass → 404. Percent-decode **exactly once**; re-run the same character
   check on the decoded value. Double-encoding is thereby dead on arrival.
2. **Resolve.** `candidate = path.resolve(REPO_ROOT, decoded)` where `REPO_ROOT` is derived
   from `import.meta.url` (`tools/question-hub/../..`), never from `process.cwd()` — the
   server is started from several working directories and cwd is not a security boundary.
3. **Root allow-list.** `candidate` must sit under exactly one of:
   `docs/product/mockups/` · `docs/product/` · `docs/architecture/` ·
   `tools/question-hub/media/`.
   Test with `candidate === root || candidate.startsWith(root + path.sep)` — a bare
   `startsWith` on the string would let `docs/product-secrets/` through.
4. **Extension allow-list**, mapped to a fixed content-type table:
   `.png .jpg .jpeg .webp .gif .md .json .txt`. Unknown extension → 404. Never sniff, never
   fall back to `application/octet-stream`.
   **`.svg` is deliberately excluded** — it is an active document that executes script on
   direct navigation, and every mockup here is a PNG. Zero cost to exclude, one whole class
   of same-origin XSS removed.
5. **`lstat`, not `stat`**, and require `isFile()`. This rejects directories *and symlinks*,
   so a symlink planted inside an allowed directory cannot point out of it.
6. **Referenced-only.** The decoded path must appear in `question.attachments` or
   `optionMeta[*].attachment` of some non-withdrawn question in the DB. The server keeps a
   `Set<string>` of referenced media paths, rebuilt after every write. A file nobody asked
   about is 404 even if it passes gates 1–5. **This is the gate that matters** — it means
   adding a new servable file requires posting a question that references it, so the attack
   surface is exactly the set of files the fleet deliberately published.
7. **Size ceiling.** `stat.size > 8 MB` → 404. Mockups are ~2 MB; this bounds the blast radius.
8. **Stream, never buffer.** `createReadStream(...).pipe(res)`. A 2 MB `readFile` per request
   on a phone hitting a section of six mockups is a memory spike for no reason.

Response headers, every time:
`content-type` from the table · `x-content-type-options: nosniff` ·
`etag: "<mtimeMs>-<size>"` · `cache-control: public, max-age=31536000, immutable` ·
`content-length`. Honour `if-none-match` with `304`. Mockups are immutable in practice, and
a phone must not re-download 2 MB on every poll.

**Logging:** log the requested repo-relative path only. Never log the resolved absolute
path — that hands a reader the filesystem layout for free.

**No directory listing exists.** `GET /media/` and `GET /media/docs/` are 404. There is no
code path that enumerates a directory.

---

## 4. Storage schema v3 and the migration

### 4.1 What v3 adds

On-disk version goes **1 → 3**. (Skip 2: `EMPTY_DB` already claims `version: 2` for a shape
that no file on disk has ever had. Jumping to 3 makes "which shape is this" answerable by
the version number alone.)

Every field below is **new and optional**. Nothing existing is renamed, retyped, or removed.

| Field | Type | Default for legacy records |
|---|---|---|
| `answerDetail` | object or `null` | derived (§4.2) for answered; `null` for open |
| `attachments` | array | `[]` |
| `optionMeta` | object | `{}` |
| `allowOther` | boolean | `true` for `choice`/`multi`/`rank`, `false` for `text`/`scale` |
| `layout` | string | `"list"` |
| `assumedInUse` | boolean | `false` — set by an agent that has already built on the recommendation |
| `priority` | `null` / `"now"` / `"soon"` / `"whenever"` | `null` |
| `withdrawnAt` / `withdrawReason` | string or `null` | `null` |
| `updatedAt` | ISO string | copy of `answeredAt ?? askedAt` |

DB-level: `version: 3`, plus `migratedFrom: 1`, `migratedAt: <ISO>`, and `seq` — a
monotonic integer stamped on every event (§5). Existing events get `seq` assigned by index.

**`status` gains one value: `withdrawn`.** `GET /api/questions` excludes it by default,
which reproduces today's behaviour exactly (withdrawn questions used to vanish from the array).

### 4.2 Deriving `answerDetail` from an existing answer

Run per answered question. This is where the live data bites.

1. `status !== "answered"` → `answerDetail = null`. Done.
2. `kind === "text"` → `{ text: answer, selected: [], other: null, source: "imported", match: "exact" }`.
3. `kind === "scale"` → `{ selected: [String(answer)], match: "exact" }`.
4. `kind === "multi"` → split `answer` on `" | "`; match each part.
   `kind === "choice"` → match the whole string.
5. **Matching is two-pass:**
   - **Pass 1 — exact.** `options.indexOf(part) >= 0` → push into `selected`, `match: "exact"`.
   - **Pass 2 — normalised.** Normalise both sides: Unicode NFC, fold curly single quotes to
     the ASCII apostrophe, curly double quotes to the ASCII quote, em/en dash to hyphen,
     collapse runs of whitespace, trim, casefold. If exactly **one** option normalises to the
     same string → push the **original option string** into `selected` (never the answer's
     spelling) and set `match: "normalised"`.
   - **No match, or more than one** → the part goes to `other`, and `needsReview: true`.

**Pass 2 is not defensive padding — it is required by the live file.** `D-01`'s stored
answer contains a curly apostrophe (`so it’s possible`) while its option carries a straight
one (`so it's possible`), because `seed.mjs` re-asked the question with re-typed wording
after the human had answered (defect D-B). Without normalised matching, the migration would
demote a deliberately-picked option to free text and the fleet would read it as an off-menu
answer. **Exactly one of the 11 answers is affected; the other 10 match exactly.**
The migration report must print every non-exact match by id, and `D-01` must appear in it.

### 4.3 Preventing the orphaning from recurring (defect D-B)

On `POST /api/ask` for an id that already exists **and is answered**, after replacing the
wording, re-run §4.2 matching against the *new* options:

- Still matches (exact or normalised) → rewrite `answerDetail.selected` to the new option
  strings, regenerate the flat `answer`, keep `answeredAt`. The human's decision survives a
  rewording, which is the whole point of idempotent seeding.
- No longer matches → **keep `answer` and `answeredAt` untouched**, set
  `answerDetail.needsReview = true`, and log an `answer-orphaned` event carrying the old and
  new option lists. The UI shows a cyan `RE-CHECK` chip on that card.

Never silently discard, never silently retain. Both are how answers rot.

### 4.4 Refusing to downgrade (invariant I-3)

`loadDb()` reads `db.version`. If it is **greater than** the version this server understands,
print a one-line explanation and `process.exit(1)` **before any write path is armed**. An old
`server.mjs` started against a v3 file must never round-trip it back to v1 and drop every new
field on the next `persist()`.

### 4.5 Where the migration runs, and why not as a script

**The migration runs inside `loadDb()`, in memory, at startup. `verify-migration.mjs` never
writes to `data/questions.json`.**

Reason: the server holds the whole DB in memory and rewrites the entire file on every
`persist()`. If an external script edited the file while the instance on 7777 were running,
the next answer the human saved would overwrite the migrated file with the old in-memory v1
shape — a silent, total rollback. Making startup the only migration point removes that race
by construction.

Consequence: the live upgrade happens on the **next deliberate restart** of the hub, which is
a single explicit step the orchestrator takes after §4.6 passes. Until then the running v1
server keeps serving normally. Nothing is urgent and nothing is at risk.

### 4.6 Proving it safe before it touches the real file

`migrate(db) -> db` is a **pure function in `lib/migrate.mjs` with zero `fs` imports.** That
is what makes it testable at all; enforce it with a test that greps the module for `node:fs`.

The gate, in order. Every step must pass before the server is restarted.

1. **Backup.** `node verify-migration.mjs --backup` copies `data/questions.json` to
   `data/questions.backup-v1-<ISO8601>.json`, then verifies the copy by comparing **byte
   length and SHA-256 of both files**. Mismatch → abort, non-zero exit, no further step.
2. **Dry run on the copy.** `--dry-run` loads the *backup*, runs `migrate`, writes
   `data/questions.migrated-preview.json`, and prints a report: counts by kind, every
   `match: "normalised"` and every `needsReview` question by id, and the added fields per record.
3. **The identity gate (I-2, mechanical).** For every question, assert that
   `id`, `section`, `question`, `why`, `kind`, `options`, `answer`, `note`, `status`,
   `askedBy`, `blocking`, `recommended`, `defaultAnswer`, `askedAt`, `answeredAt` are
   **deep-equal pre and post**. Any single difference fails the run. The migration may only add.
4. **Old-reader equivalence — the strongest proof.** Run `answers.mjs --json` against the
   pre-migration data and against the post-migration data and require the outputs to be
   **byte-identical**. If the tool the whole fleet reads decisions through cannot tell the
   migration happened, the migration is backward-compatible in the only sense that matters.
5. **Idempotence.** `migrate(migrate(db))` deep-equals `migrate(db)`.
6. **Fixture suite** (`node:test`) over `tests/fixtures/legacy-v1-*.json`: hand-built records
   covering each kind, an answer with a curly apostrophe, an answer matching no option, a
   `multi` whose option label itself contains `" | "`, an already-v3 record, an empty DB, and
   a DB with `version: 99` (must refuse to start).
   `data/` is gitignored and holds the human's answers — **no fixture is ever copied out of it.**
7. **Optional real-file check**, read-only: `HUB_MIGRATION_REAL=1 node --test` runs steps 3–5
   against the live file loaded read-only. Off by default so CI never touches it.
8. **Automatic belt-and-braces.** Independently of all the above, `loadDb()` itself writes
   `data/questions.backup-v<old>-<ISO>.json` and fsyncs it **before** the first `persist()` of
   a migrated DB. A human remembering to back up is not a mechanism; this is.

### 4.7 Rolling snapshots — cheap insurance against everything else

The file is 113 KB. After every write that answers or un-answers a question, `lib/db.mjs`
writes `data/snapshots/questions-<ISO>.json` and prunes to the newest **20**. Total cost
~2 MB and a few milliseconds. This covers the failure modes a backup-at-migration does not:
a bad batch, a rogue agent, a bug in a new code path, a human tapping the wrong thing.
`data/snapshots/` sits inside the already-gitignored `data/`.
---

## 5. Answering UX

Designed for one thumb, a phone, and a person with four spare minutes. The visual language
is `docs/product/design-language.md` — near-black canvas, gold for *the human's* actions,
cyan for *the system's* intelligence, mono for metadata. Keep that mapping exactly: gold is
what you decide, cyan is what the fleet did.

### 5.1 The four card states, distinguishable without colour

Colour alone is not a signal (accessibility, and phone screens in sunlight). Each state
carries a shape cue and a mono word.

| State | Option mark | Card | Chip |
|---|---|---|---|
| **Open, recommended** — nothing chosen; this is what the fleet will do if you stay silent | **dashed** gold ring, hollow centre | hairline border | `RECOMMENDED` in green mono, on the option |
| **Open, in use** — an agent has already built on that default (`assumedInUse`) | dashed **cyan** ring | 2px cyan left rule | `IN USE` cyan chip — *changing this costs rework* |
| **Staged** — edited this session, not yet saved | solid gold fill, `✓` | 3px **gold** left rule | `UNSAVED` gold chip |
| **Answered** — on disk | solid gold fill, `✓` | 55% opacity, restored to 100% on focus | `ANSWERED` green chip, or `ACCEPTED` gold chip when `source === "accepted-recommendation"` |

Two extra chips: `BLOCKING` (cyan, existing) and `RE-CHECK` (cyan) when
`answerDetail.needsReview` — the question was reworded after you answered it.

The distinction the brief calls out — *unanswered-but-recommended* versus *genuinely
answered* — is carried by **dashed versus solid**, which survives greyscale, sunlight, and a
cracked screen. Reserve the phrase in the empty state too: "85 open · 88 have a
recommendation waiting for you to confirm."

### 5.2 Accept all recommendations — the highest-value feature

With 85 open questions and 88 recommendations on file, this is the difference between an
afternoon and five minutes. It must be fast **and** feel deliberate.

**Entry points, in order of prominence:**

1. **Per section.** Each section header carries `Accept 6 ▸` where 6 is the count of open
   questions in that section that have a `recommended`. This is the primary path.
2. **Thumb-reachable mirror.** When a section header scrolls out of view above, the sticky
   bottom bar's left slot shows `Accept 6 in §9 Maps`. A control in a section header is at
   the top of the screen and unreachable one-handed; the mirror fixes that without moving
   the canonical control.
3. **Global.** `Accept all 79 remaining` lives at the **bottom of the page**, not in the
   sticky bar. Deliberately a scroll away from Save so it can never be the button you meant
   to hit.

**The review sheet — this is what stops it feeling reckless.** Every entry point opens a
bottom sheet (grab handle, covers ~70% of the screen, matching the app's sheet language):

- Title: `Accept 6 recommendations · 9 · Maps`.
- One row per question: `M-02` · the question in one clamped line · **the full recommended
  answer text** · a checkbox, pre-checked. Nothing is accepted sight-unseen; the actual text
  you are agreeing to is on screen.
- Uncheck to exclude. A long list scrolls; the primary button is pinned and counts live:
  `Accept 5`.
- A footer line names what is *not* included: `2 questions here have no recommendation —
  left for you.` Those are never bulk-answered. Ever.
- Questions marked `IN USE` are grouped first with a one-line note, because accepting them
  is confirming work already done — the cheapest, highest-confidence taps in the sheet.

**Accepting stages; it does not write.** Accepted answers become normal staged edits and go
to disk only on Save. One write path for everything means one thing to test, and undo costs
nothing because nothing has happened yet.

- Immediately after: a toast, `6 accepted · Undo`, for **8 seconds**. Undo removes exactly
  those 6 from the staging set and nothing else — it is scoped to that batch, so it cannot
  eat edits you made in between.
- Each staged answer records `source: "accepted-recommendation"` so the fleet can later tell
  a considered decision from a bulk endorsement. This is the honest bookkeeping that makes
  the speed safe.
- Save then writes them in one `POST /api/answer-batch`. `ACCEPTED` chips appear.

**Per-card fast path:** a card's recommended option row has a small `Accept` affordance and
responds to a right-swipe (§5.5) and the `a` key (§5.4), all of which stage the same way.

### 5.3 Progress that feels like momentum

- **Header:** `11 / 96 answered`, gold→cyan gradient bar (exists — keep).
- **Per-section rings.** Each section header shows a small SVG ring plus `3/6`. This is what
  makes 18 sections feel like 18 small jobs instead of one enormous one.
- **Completed sections collapse.** A finished section renders as a single green row —
  `9 · Maps — all 4 answered ✓` — tappable to expand. As you work, the page gets visibly
  shorter. That is the momentum, and it is honest rather than decorative.
- **`↓ Next` in the sticky bar** jumps to the next unanswered card and focuses it. Nobody
  should ever scroll hunting for what is left.
- **On save:** the counter counts up and the bar animates once —
  `Saved 14 · 71 to go`. Under `prefers-reduced-motion`, the number changes without the
  animation.
- **No streaks, no confetti, no badges.** The product being built already owns that
  vocabulary; borrowing it here would be noise. Momentum here is "fewer things left, visibly".

### 5.4 Keyboard, on desktop

Active only when focus is not inside a text field. `?` opens an overlay listing them.

| Key | Action |
|---|---|
| `j` / `k` | next / previous card (scroll into view, set focus ring) |
| `1`–`9` | pick option *n* on the focused card |
| `a` | accept the recommendation on the focused card |
| `Shift+A` | open the review sheet for the focused card's section |
| `o` | focus the Other field |
| `n` | toggle the note box |
| `/` | focus search |
| `Ctrl/Cmd+S` | Save |
| `Esc` | close sheet / overlay / blur field |

### 5.5 Touch, on mobile

Restrained on purpose — one gesture that helps, one that defers, none that destroy.

- **Swipe right = accept the recommendation.** Threshold **33% of card width**, with
  rubber-band resistance and a gold `ACCEPT` label revealed progressively behind the card,
  so a scroll never triggers it accidentally. Stages only, and raises the same undo toast.
  Disabled on cards with no recommendation.
- **Swipe left = skip.** Moves the card to the bottom of the current list for this session.
  Nothing is written, nothing is lost.
- **There is no destructive gesture.** No swipe-to-delete, no swipe-to-clear.
- A `Gestures` toggle in the filter row disables both, persisted in `localStorage`.
- All tap targets `min-height: 48px` with `≥ 8px` spacing. Option rows, the Other pill, the
  note toggle, and every chip.
- Text inputs: `enterkeyhint="done"`, `autocapitalize="sentences"`, `autocorrect="on"`, and
  **never autofocused on load** — an auto-raised keyboard hides half the question.

### 5.6 Never losing an answer in progress

This is where a delightful tool becomes a trustworthy one.

1. **Staged edits persist to `localStorage`** (debounced 300 ms, keyed by hub origin) and are
   restored on load with a banner: `12 unsaved answers restored`. A backgrounded phone tab
   getting evicted must not cost twenty answers.
2. **`beforeunload` guard** whenever anything is staged.
3. **Polling never clobbers.** The existing "skip reload while pending" rule stays, and on
   any forced reload the merge is by id with **pending always winning**.
4. **Cross-device conflict is surfaced, not resolved silently.** If a poll shows a question
   answered elsewhere while it is staged locally, that card grows an inline bar showing both
   values with `Keep mine` / `Take theirs`. Two devices is a realistic scenario — phone in
   hand, laptop open — and last-write-wins in silence is how people lose work.
5. **Save retries and never clears optimistically.** On failure: keep the staged set, show
   `Save failed — retrying (2 of 3)`, back off 1 s / 3 s / 9 s, and clear pending **only**
   after a 200. Bad wifi in the far corner of a house is the normal case, not the edge case.
6. **Un-answering is explicit** (defect D-C). The client sends `{ id, clear: true }`;
   `answer: undefined` in a batch entry is ignored by the server. Clearing an answer in the
   UI requires tapping the selected option again *and* confirming in a small inline
   `Clear this answer?` row.

### 5.7 Finding the right question among 85

- **Filter chips:** `Unanswered` (default) · `Blocking` · `In use` · `No recommendation` ·
  `Has images` · `Re-check` · `All` · `Fleet status`.
  `No recommendation` is the important one — those 8 questions are the only ones the fleet
  genuinely cannot proceed on, and they should be one tap away.
- **Search** (`/` on desktop, a magnifier in the filter row on mobile) over id, question,
  why, and section. Plain substring, case-insensitive, no fuzzy matching to be clever about.
- **Default sort is by leverage, not by insertion order:**
  `blocking` → `assumedInUse` → `recommended == null` → `askedAt` ascending.
  Stated in one line under the filters: *"Questions where your answer changes the most work,
  first."*
- **Deep links.** `#Q-042` scrolls to and flashes that card; `#section-9` opens that section.
  An agent posting "please settle M-03" can hand over a link that lands on the question.
- **Section jump.** Tapping the header progress bar opens a section list with per-section
  `3/6` counts — an 18-item table of contents.

### 5.8 Making it enjoyable

The attachments do most of the work; the rest is restraint.

- Images render inline at a fixed `aspect-ratio` box (reserved space, so nothing shifts under
  a thumb mid-tap) and open full-screen with pinch-zoom on tap.
- Swatches render as real colour chips with the hex in mono — deciding a palette by looking
  at the palette.
- `compare` renders genuinely side by side at any width, each half tappable to full-screen.
  No before/after slider: fiddly one-handed, and it hides half the evidence at any moment.
- Copy is plain and human. `Nothing waiting on you.` beats `0 items in queue`.
---

## 6. The answer-notification channel

The human asked for "a subagent who constantly listens and lets orchestrator know when a
question has been answered". That listener needs a channel, and the channel is what makes
invariant I-6 real.

**Design: sequenced events plus a long-poll. Not SSE, not a websocket, not file-watching.**

- Every event gets a monotonic `seq` (§4.1). `GET /api/events?since=<seq>&timeout=30`
  returns immediately with any events newer than `since`; if there are none it **holds the
  request open** for up to `timeout` seconds and returns `{ events: [], seq }` on expiry.
- A waiter is a resolver in an in-memory array, woken **after** `persist()` resolves. It is
  never inside the write queue, so a listener holding a request open can never delay an
  answer being saved. That is I-6 enforced structurally rather than by convention.
- Cap concurrent waiters at 32; beyond that return immediately with a 1-second poll hint, so
  a runaway agent cannot exhaust sockets and lock the human out of the UI.

Chosen over SSE because a long-poll is a plain JSON response — ~15 lines of server code, no
stream framing, no reconnect state machine, and trivially assertable in a `node:test`.
Chosen over file-watching because `fs.watch` on Windows fires on the temp file *and* the
rename and gives no ordering guarantee.

`watch.mjs` is the listener CLI: it long-polls, and on each `answer` / `answer-batch` /
`answer-orphaned` event prints one line per affected question id with its new answer, then
exits 0 on `--once` or loops forever by default. The orchestrator runs it detached and reads
its output. It reconnects with backoff and never crashes the caller on a hub restart.

The browser client uses the same endpoint in place of its 12-second `setInterval`, so a new
question posted by an agent appears on the phone within a second — while still respecting
the "never reload while edits are staged" rule.

---

## 7. Frozen API contract

Both the server agent and the client agent build against this table without talking to each
other. **It is frozen for the duration of the build.** If it turns out to be wrong, the
change is made here first, in this file, by whoever finds the problem — then both agents
re-read it.

| Method | Path | Body / query | Response |
|---|---|---|---|
| `GET` | `/` | — | the UI (`public/index.html`) |
| `GET` | `/app.css`, `/app.js`, `/*.js` | — | static, from `public/` only, extension allow-listed |
| `GET` | `/api/questions` | `?status=open\|answered\|withdrawn`, `?section=` | `{ questions, stats, status }` — excludes `withdrawn` unless asked |
| `GET` | `/api/health` | — | `{ ok, stats, version, seq }` |
| `GET` | `/api/events` | `?since=<seq>&timeout=<1..60>` | `{ events, seq }` — long-poll (§6) |
| `GET` | `/media/<repo-relative-path>` | — | the file, or bare 404 (§3.3) |
| `POST` | `/api/ask` | question shape + `attachments`, `optionMeta`, `allowOther`, `layout`, `assumedInUse` | the stored question |
| `POST` | `/api/answer` | `{ id, answer?, answerDetail?, note?, clear? }` | the stored question |
| `POST` | `/api/answer-batch` | `{ answers: [ { id, answer?, answerDetail?, note?, clear? } ] }` | `{ saved: [ids], skipped: [ids], conflicts: [] }` |
| `POST` | `/api/withdraw` | `{ id, reason? }` | `{ withdrawn: id }` — **soft delete** (defect D-A) |
| `POST` | `/api/status` | `{ headline, entries }` | the stored board |

**Rules that both agents must honour:**

- The client may send **either** `answer` (flat string) **or** `answerDetail`. When both are
  present, `answerDetail` wins and the server regenerates `answer` from it. When only
  `answer` is present, the server derives `answerDetail` using §4.2 matching. This keeps
  `curl` one-liners and `ask.mjs` working unchanged.
- `answer === undefined` in a batch entry → the entry is **ignored**, and the id is returned
  in `skipped`. Un-answering requires `clear: true` (defect D-C).
- Every response keeps `access-control-allow-origin: *` and `cache-control: no-store` on API
  routes. `/media/` is the only cacheable route.
- Validation failures are `400` with `{ error: "<one sentence a human can act on>" }`.
  Never a stack trace, never a filesystem path.
- The server rejects: unknown `kind`, `choice`/`multi`/`rank` without `options`, duplicate
  option labels, `optionMeta` keys not present in `options`, an attachment whose `type` is
  unknown, an `image` without `alt`, a `link` whose scheme is not http/https, and a media
  `src` that fails gates 1–5 of §3.3 **at ask time** — so a bad path is rejected when it is
  posted, not discovered when the human taps it.
---

## 8. File ownership map

Three agents, disjoint paths. **An agent may not create, edit, or delete a path it does not
own, for any reason, including a one-line fix.** If you need a change in someone else's file,
it is because this spec was wrong — say so rather than reaching across the line.

`public/index.html` is 505 lines and `server.mjs` is 281, so both are split at the seams
below. The splits are chosen so each agent's files never need to be opened by another.

### 8.1 Server agent — `(a)`

Owns everything that runs in Node. **`node:*` imports only — no dependency, ever (I-4).**

| Path | Purpose | Budget |
|---|---|---|
| `tools/question-hub/server.mjs` | HTTP wiring and startup only: create server, route table lookup, listen, print LAN addresses. No business logic. | ≤ 120 |
| `tools/question-hub/lib/http.mjs` | `HttpError`, `sendJson`, `readBody`, CORS headers, the route dispatch table | ≤ 100 |
| `tools/question-hub/lib/db.mjs` | load, atomic persist, the write queue, backups, snapshots, version gate (§4.4, §4.6.8, §4.7) | ≤ 160 |
| `tools/question-hub/lib/migrate.mjs` | **pure** `migrate(db) -> db`. Zero `node:fs` imports — the test asserts this. | ≤ 140 |
| `tools/question-hub/lib/answer-detail.mjs` | **pure** answer ↔ `answerDetail` derivation and the two-pass matcher (§2.5, §4.2) | ≤ 120 |
| `tools/question-hub/lib/questions.mjs` | ask / answer / answer-batch / withdraw handlers, re-ask reconciliation (§4.3) | ≤ 180 |
| `tools/question-hub/lib/attachments.mjs` | **pure** attachment and `optionMeta` validation (§3.1, §3.2) | ≤ 120 |
| `tools/question-hub/lib/media.mjs` | the `/media/` route: gates 1–8, the referenced-path `Set`, streaming (§3.3) | ≤ 150 |
| `tools/question-hub/lib/static.mjs` | serves `public/` by extension allow-list — **`.html .css .js .ico` only, and only from `public/`** | ≤ 70 |
| `tools/question-hub/lib/events.mjs` | `seq`, the event log, long-poll waiters, the 32-waiter cap (§6) | ≤ 110 |
| `tools/question-hub/lib/status-board.mjs` | fleet status board validation and storage | ≤ 70 |
| `tools/question-hub/ask.mjs` | agent CLI — extend with `--attach`, `--swatch`, `--rank`, `--no-other`, `--in-use`; warn when open count > 100 | ≤ 140 |
| `tools/question-hub/answers.mjs` | decisions dump — **its `--json` output shape is frozen**, it is the migration's equivalence oracle (§4.6.4). May gain `--needs-review`. | ≤ 120 |
| `tools/question-hub/watch.mjs` | the listener CLI (§6) | ≤ 100 |
| `tools/question-hub/seed.mjs` | seeder | ≤ 70 |
| `tools/question-hub/status.mjs` | status board CLI | ≤ 70 |
| `tools/question-hub/seed/questionnaire.json` | seed data | — |
| `tools/question-hub/media/.gitkeep` | the writable half of the media allow-list | — |
| `tools/question-hub/README.md` | what it is, how to run it, the API, the storage contract | — |

### 8.2 Client agent — `(b)`

Owns everything served to the browser. Plain ES modules, no build step, no framework, no CDN.
Adding a new `.js` or `.css` file under `public/` needs **no server change** — `lib/static.mjs`
serves the whole directory by extension. That is deliberate: it is the one coupling that
would otherwise force the two agents to interleave.

| Path | Purpose | Budget |
|---|---|---|
| `tools/question-hub/public/index.html` | markup and module tags only. **No inline `<style>` or `<script>` body.** | ≤ 120 |
| `tools/question-hub/public/app.css` | the full design-language stylesheet, incl. the four card states (§5.1) | ≤ 300 |
| `tools/question-hub/public/app.js` | bootstrap, load loop, long-poll subscription, save + retry, wiring | ≤ 200 |
| `tools/question-hub/public/store.js` | staged-edit map, `localStorage` persistence, merge-on-poll, conflict detection (§5.6) | ≤ 160 |
| `tools/question-hub/public/render-card.js` | one card: all five kinds, Other row, note box, chips, per-option consequence | ≤ 220 |
| `tools/question-hub/public/render-attachments.js` | the six attachment types + the strict markdown subset | ≤ 180 |
| `tools/question-hub/public/lightbox.js` | full-screen `<dialog>` image viewer with pinch-zoom | ≤ 90 |
| `tools/question-hub/public/accept-sheet.js` | the review sheet, staging, and the scoped undo toast (§5.2) | ≤ 190 |
| `tools/question-hub/public/filters.js` | filter chips, search, leverage sort, section index, deep links (§5.7) | ≤ 160 |
| `tools/question-hub/public/gestures.js` | swipe, keyboard map, the shortcut overlay (§5.4, §5.5) | ≤ 170 |
| `tools/question-hub/public/progress.js` | header bar, per-section rings, collapse-when-complete, `↓ Next` (§5.3) | ≤ 130 |
| `tools/question-hub/public/status-board.js` | the fleet status view | ≤ 80 |
| `tools/question-hub/UI.md` | the UX contract: states, gestures, shortcuts, what is deliberately absent | — |

**Client hard rule:** `render-attachments.js`, `gestures.js`, and `accept-sheet.js` are
initialised inside `try/catch` in `app.js`. If any of them throws, the console records it and
**the core answering UI still renders and still saves.** A broken swatch renderer must never
cost the human the ability to answer a text question.

### 8.3 Test agent — `(c)`

Owns every test and every verification tool. Writes no production code.

| Path | Purpose |
|---|---|
| `tools/question-hub/verify-migration.mjs` | `--backup`, `--dry-run`, `--report` (§4.6 steps 1–4). **Never writes `data/questions.json`.** |
| `tools/question-hub/tests/*.test.mjs` | `node:test` units: migrate, answer-detail, attachments, media path-safety, db write queue, events |
| `tools/question-hub/tests/api/*.test.mjs` | integration against a server on `HUB_PORT=7788` with a temp `HUB_DATA_DIR` |
| `tools/question-hub/tests/fixtures/*.json` | hand-built fixtures. **Never copied from `data/`.** |
| `tools/question-hub/tests/e2e/*.spec.ts` | Playwright walkthroughs |
| `tools/question-hub/tests/smoke.mjs` | the one-command gate (§9): boots a 7788 instance on a temp dir, runs everything, tears down |
| `tools/question-hub/playwright.config.mjs` | hub-only Playwright config — **does not touch the root `playwright.config.ts`** |
| `tools/question-hub/tests/README.md` | how to run everything, and the one-command smoke check |

### 8.4 Owned by nobody

Touching any of these is a spec violation. Raise it instead.

| Path | Why |
|---|---|
| `tools/question-hub/data/**` | the human's answers. Only the running server writes here. No agent opens it for writing, ever. |
| `docs/architecture/hub-platform.md` | this spec. Orchestrator only. |
| root `package.json`, `playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `.gitignore` | shared with the app workflow — a three-way collision waiting to happen. Hub commands are documented in the hub README and run explicitly; no root script is added. |
| `apps/**`, `packages/**` | another workflow owns them. |

`data/` is already gitignored, so `data/snapshots/` and every backup file are covered with no
`.gitignore` change.

### 8.5 Server agent additions the client depends on

Built first, so the client is never blocked: `HUB_DATA_DIR` env override (lets the test agent
point a second instance at a temp directory), `GET /api/events`, `GET /media/`, `skipped` and
`conflicts` in the batch response, `answerDetail` on read and write.

---

## 9. Testing the platform as it is built

The human asked for this explicitly. The bar is the same as the app's: a walkthrough, not a
green unit-test run.

**Every test runs against a second instance.** `HUB_PORT=7788 HUB_DATA_DIR=<temp>`. The
instance on 7777 is never stopped, never pointed at test data, and never written to by a test.
A test that would need to touch `data/questions.json` is a test that must be rewritten.

| Layer | Tool | What it must cover |
|---|---|---|
| Pure units | `node:test` | migrate (incl. the curly-apostrophe case, by name), answer-detail round-trips for all five kinds, attachment validation, `answer` ↔ `answerDetail` derivation |
| Path safety | `node:test` | a named test per gate in §3.3: `..`, `%2e%2e`, double-encoding, backslash, absolute path, symlink out, allowed-root prefix confusion (`docs/product-secrets`), disallowed extension, `.svg`, unreferenced-but-real file, oversize, directory |
| Write safety | `node:test` | 50 concurrent `answer` posts leave 50 correct answers and a valid JSON file; a kill between temp-write and rename leaves the previous file intact; snapshot pruning keeps exactly 20 |
| API | `node:test` + `fetch` | every endpoint, success and every documented 4xx; `answer: undefined` is skipped not cleared; `clear: true` clears; withdraw soft-deletes and the answer survives; re-ask with changed options sets `needsReview` |
| Long-poll | `node:test` | returns immediately when behind; holds and wakes on a write; expires cleanly; 33 concurrent waiters do not block a save |
| Migration | `node:test` + `verify-migration.mjs` | the whole §4.6 gate, run as one command |
| UI | Playwright | see below |

**Playwright walkthroughs — the definition of done.** Recorded in
`docs/qa/walkthroughs/` per CLAUDE.md, run at 390×844 (phone) and 1280×800 (desktop):

1. Answer one of each kind, save, reload, confirm persistence.
2. Type into Other on a `choice`; confirm the option deselects, the flat `answer` is prefixed
   `Other: `, and `answerDetail.selected` is empty.
3. Open a section review sheet, uncheck two, accept, confirm exactly the checked ones are
   staged, tap Undo, confirm the staging set is empty and nothing was written.
4. Accept a section, save, confirm `ACCEPTED` chips and `source: "accepted-recommendation"`.
5. Stage five answers, reload the page mid-edit, confirm the restore banner and all five.
6. Stage an answer; answer the same question via `curl` from "another device"; confirm the
   conflict bar appears and `Keep mine` wins.
7. Tap a mockup, confirm the lightbox opens and closes; confirm no layout shift while it loads.
8. Keyboard-only pass: `j`, `1`, `a`, `Ctrl+S`, `Esc` — no mouse.
9. Swipe right to accept, swipe left to skip, on a touch context.
10. Accessibility: every interactive element ≥ 44 px, focus visible, the four card states
    distinguishable in a forced-greyscale screenshot.

**One command must prove the whole thing:** `node tools/question-hub/tests/smoke.mjs`
starts an instance on 7788 against a temp dir, runs the node tests, runs Playwright, tears
down, exits non-zero on anything. Build agents run it before claiming done.
---

## 10. Risks, ranked by damage to the human's ability to answer

Ranked by *damage × likelihood*, worst first. Each has one owner and one mechanism — not a
promise to be careful.

**R-1 · The 11 existing answers are lost or silently corrupted.**
The unforgivable failure. Three independent causes: a migration bug, a running server
overwriting an externally-migrated file, and `withdraw`'s hard delete (D-A).
*Mitigation:* migration is pure and runs only at startup (§4.5); the identity gate and the
`answers.mjs --json` byte-equality gate must both pass before restart (§4.6.3–4); an
automatic pre-migration backup is written and fsynced by `loadDb()` itself (§4.6.8); rolling
20-deep snapshots on every answering write (§4.7); withdraw becomes a soft delete (§7).
Four layers, because one is a promise and four is a system. *Owner: server + test.*

**R-2 · The server fails to start, and the channel disappears entirely.**
Now a much bigger surface: 12 new modules instead of one file. A syntax error, a bad import
path, or a throwing migration and the human sees a dead page with no explanation.
*Mitigation:* `node --check` over every `.mjs` in `smoke.mjs`; the migration is the **only**
thing allowed to abort startup — media, attachment, and event-module failures are caught and
degrade to a working server with the feature off; `lib/` modules import `node:*` only and a
test asserts no other import specifier appears anywhere under `tools/question-hub/`; the
restart step in §4.5 is taken once, deliberately, with the old process left running until the
new one has answered `/api/health` on 7788 first. *Owner: server.*

**R-3 · A client-side bug makes the page unanswerable even though the server is fine.**
The most likely regression by far: the UI splits from 1 file into 12, and one bad module
takes the whole page down. From the phone this is indistinguishable from R-2.
*Mitigation:* the §8.2 hard rule — attachments, gestures, and the accept sheet initialise in
`try/catch` and the core render/save path depends on none of them; no build step, so there is
nothing to be stale; Playwright walkthrough 1 (answer one of each kind, save, reload) is the
smoke test that must pass before any UI change is called done. *Owner: client + test.*

**R-4 · An answer is destroyed by an empty string or a stray tap (defect D-C).**
Silent, and the human has no way to know it happened.
*Mitigation:* `answer: undefined` is ignored and reported in `skipped`; clearing requires
`clear: true` plus an inline confirm; every answering write leaves a snapshot. *Owner: server + client.*

**R-5 · Staged answers are lost before Save.**
A backgrounded tab, a dropped wifi, a phone call. Twenty answers gone is nearly as bad as R-1
because it is the human's time either way.
*Mitigation:* `localStorage` staging debounced at 300 ms with a restore banner;
`beforeunload` guard; save retries 1 s / 3 s / 9 s and never clears pending before a 200
(§5.6). *Owner: client.*

**R-6 · A 2 MB mockup makes the page unusable on phone wifi.**
Six attachments in one section is 12 MB. Worse than slow: an image loading late shifts the
layout under a thumb already moving, and the wrong option gets tapped.
*Mitigation:* fixed `aspect-ratio` boxes reserve space before load, so nothing ever shifts;
`loading="lazy"`; immutable caching with `ETag`/`304` so the second visit costs nothing;
streamed, never buffered; a `tap to load` placeholder when `navigator.connection.saveData`
is set. *Owner: client + server.*

**R-7 · The human cannot find the questions that matter among 85.**
Not a crash, but it is what makes the tool get abandoned — and an abandoned hub blocks the
whole fleet.
*Mitigation:* leverage sort as the default (§5.7); the `No recommendation` filter surfacing
the 8 questions only the human can settle; per-section rings and collapse-on-complete;
accept-all removing the bulk in a few taps. *Owner: client.*

**R-8 · Accept-all is regretted.**
Fast bulk actions are exactly where "fun" turns into "I just agreed to 79 things".
*Mitigation:* the review sheet shows the full text of every recommendation before accepting;
accepting stages rather than writes, so nothing is on disk until Save; a scoped 8-second
Undo; questions with no recommendation are structurally excluded; `source:
"accepted-recommendation"` records the provenance so a later reader knows the weight to give
it. *Owner: client.*

**R-9 · The media endpoint leaks the filesystem.**
Anyone on the wifi can read anything the server can read.
*Mitigation:* the eight gates in §3.3, of which the referenced-only rule is the real
boundary; `.svg` excluded; `lstat` rejecting symlinks; bare 404s that never distinguish
"forbidden" from "missing"; validation at ask time so bad paths never get stored. A named
test per gate. *Owner: server + test.*

**R-10 · Two devices, two answers, one silently wins.**
Realistic: phone in hand, laptop open on the same question.
*Mitigation:* the conflict bar with both values and an explicit choice (§5.6.4). Never a
silent last-write-wins. *Owner: client.*

**R-11 · A listener agent starves the human's UI.**
32 long-polls held open by a runaway loop, and the phone cannot fetch questions.
*Mitigation:* the 32-waiter cap with an immediate response and a poll hint beyond it; waiters
resolved outside the write queue so they can never delay a save (§6). *Owner: server.*

**R-12 · The LAN address changes and the human cannot reach the hub.**
DHCP renews, the URL in the phone's browser 404s, answering stops.
*Mitigation:* the server already prints every LAN address on start — the orchestrator posts
the current URLs into the fleet status board headline after every restart, so the address
lives somewhere the human already looks. *Owner: server.*

**R-13 · The fleet drowns the queue faster than it can be answered.**
101 `ask` events have already been logged.
*Mitigation:* `ask.mjs` prints a warning when open questions exceed 100, so the fleet
self-limits; the `assumedInUse` flag lets agents proceed on defaults honestly rather than
asking more; leverage sort keeps the top of the list worth reading. *Owner: server.*

---

## 11. Build order

Three agents, three phases. The API contract in §7 is what lets phases 1 and 2 overlap.

**Phase 0 — before any code (test agent, alone, ~20 min).**
`verify-migration.mjs --backup` against the live file. Confirm
`data/questions.backup-v1-<ISO>.json` exists and its SHA-256 matches. Nothing else starts
until that file is on disk.

**Phase 1 — parallel.**
- *Server:* split `server.mjs` into `lib/`, add `migrate`, `answer-detail`, `attachments`,
  `media`, `events`, soft-delete withdraw, `HUB_DATA_DIR`. Do not restart 7777.
- *Client:* split `index.html` into `public/*`, implement the five kinds, Other, the four
  card states, attachments, accept-sheet, filters, gestures, progress.
- *Test:* fixtures, `node:test` units, the path-safety suite, `smoke.mjs`.

**Phase 2 — integration.**
Test agent runs `smoke.mjs` and the full §4.6 gate against the backup copy. Every gate green,
including `answers.mjs --json` byte-equality and `D-01` appearing in the normalised-match
report with the right option.

**Phase 3 — the restart, once.**
Orchestrator starts the new server on 7788 against a **copy** of the real data, confirms
`/api/health` reports `version: 3` and `answered: 11`, and confirms all 11 answers still read
correctly in the UI. Only then stop 7777 and start the new server on 7777. `loadDb()` writes
its own backup on the way through. Post the new LAN URLs to the status board.

**Phase 4 — content.**
Attach mockups to the design questions (`image9.png` to `D-01`, the reader mockups to the
badge questions), add swatch sets to the colour questions, and convert `P-03`/`P-04` to
`rank`. This is what turns 85 chores into something worth doing on a phone — and it is a
re-ask, which is exactly the path §4.3 was written to protect.
