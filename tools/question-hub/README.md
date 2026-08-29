# Question Hub

An async decision channel between the agent fleet and the human product owner of Atlas Bible.

A long autonomous build generates dozens of decisions only the product owner can make. Asking
them one at a time in chat serialises the whole project against one person's attention. The hub
decouples the two: agents queue questions and keep building against the recommended default;
the human answers from a phone on the LAN, in short bursts, one-handed. Nobody blocks in either
direction. The authoritative build spec is
[`docs/architecture/hub-platform.md`](../../docs/architecture/hub-platform.md).

## Table of contents

- [The one rule](#the-one-rule)
- [Architecture](#architecture)
- [Prerequisites and environment](#prerequisites-and-environment)
- [Running it](#running-it)
- [For agents](#for-agents)
- [API](#api)
- [Question shape](#question-shape)
- [Kinds](#kinds)
- [The "Other" escape](#the-other-escape)
- [Attachments](#attachments)
- [Serving images safely](#serving-images-safely)
- [Storage](#storage)
- [The v1 to v3 migration](#the-v1-to-v3-migration)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## The one rule

`data/questions.json` holds answers a human already gave. Losing them means asking a person to
redo work, which is the only unforgivable failure in this system.

- **Only the running server writes `data/`.** No script, no agent, no test.
- Every schema change is **additive**. No field is renamed, retyped, or removed.
- A server that does not understand the on-disk `version` **refuses to start** rather than
  writing over it.
- Writes are atomic (fsynced temp file, then rename) and serialised through one promise queue.
- Every answering write leaves a snapshot in `data/snapshots/`, newest 20 kept.

## Architecture

```
  agent fleet                        the human, on a phone
  ask.mjs / seed.mjs                 public/ (the answering UI)
  answers.mjs / watch.mjs                    |
        |                                    |
        +------------> server.mjs <----------+
                          |
        +-----------------+------------------+----------------+
        |                 |                  |                |
     lib/http.mjs     lib/questions.mjs   lib/media.mjs   lib/static.mjs
     route table      lib/answering.mjs   /media/ gates   public/ only
                      lib/attachments.mjs
                      lib/answer-detail.mjs
                          |
                      lib/db.mjs  --- lib/migrate.mjs (pure)
                      lib/events.mjs (seq + long-poll)
                          |
                   data/questions.json
                   data/snapshots/  data/questions.backup-*.json
```

**Zero runtime dependencies, permanently.** Every module imports `node:*` and nothing else, so
the hub can never fail to start because of a package install. The whole fleet depends on it
being up.

## Prerequisites and environment

| Requirement | Version |
|---|---|
| Node.js | `>= 20.11.0` (uses `structuredClone`, `fetch`, `node:test`) |
| Packages | none, and none may ever be added |

| Variable | Description | Format | Example | Required |
|---|---|---|---|---|
| `HUB_PORT` | Port the server binds on `0.0.0.0` | integer | `7777` | no (default `7777`) |
| `HUB_DATA_DIR` | Directory holding `questions.json`, snapshots and backups | absolute path | `C:\Temp\hub-test` | no (default `tools/question-hub/data`) |
| `HUB_URL` | Hub base URL the CLIs talk to | URL | `http://localhost:7777` | no (default `http://localhost:7777`) |

There is no authentication and there are no secrets. Do not set any.

## Running it

```bash
node tools/question-hub/server.mjs
```

It prints every LAN address it is reachable on. Verify with the health check:

```bash
curl http://localhost:7777/api/health
# {"ok":true,"stats":{...},"version":3,"seq":119}
```

Detached on Windows, so it survives the shell:

```bash
powershell -NoProfile -Command "Start-Process node -ArgumentList 'tools/question-hub/server.mjs' -WorkingDirectory 'W:\spark-expo' -WindowStyle Hidden -RedirectStandardOutput 'W:\spark-expo\tools\question-hub\data\hub.log' -RedirectStandardError 'W:\spark-expo\tools\question-hub\data\hub.err.log'"
```

A second instance for testing, against a throwaway data directory — **never point a test at the
real one**:

```bash
HUB_PORT=7788 HUB_DATA_DIR=/tmp/hub-test node tools/question-hub/server.mjs
```

Seed the questionnaire (idempotent; re-running revises wording without discarding answers):

```bash
node tools/question-hub/seed.mjs
```

## For agents

**Ask a question, then keep working.** Take the recommended option, record the assumption in
`docs/decisions/ASSUMPTIONS.md` with the question id, and carry on.

```bash
node tools/question-hub/ask.mjs \
  --section "9 · Maps" --q "Which tile provider should the map use?" \
  --why "Changes the entire rendering path and whether we need a paid token." \
  --kind choice --opt "MapLibre" --opt "Custom GeoJSON" --rec "Custom GeoJSON" \
  --by "map-agent"
```

| Flag | Effect |
|---|---|
| `--blocking` | Surfaces in the Blocking filter. Use only if genuinely nothing else can proceed. |
| `--rank` | Ask for an ordered subset instead of one pick. |
| `--no-other` | Close the set — no free-text Other row. |
| `--in-use` | An agent has already built on the recommendation; changing it costs rework. |
| `--image "<src>\|<alt>"` | Attach a repo-relative image. `alt` is required. |
| `--swatch "<name>\|#hex"` | Repeatable; collected into one swatch grid. |
| `--note "<markdown>"` | Attach a note in the strict markdown subset. |
| `--attach '<json>'` | Any attachment shape, verbatim. |
| `--layout compare\|swatch` | Presentation hint. |
| `--stdin` | Read the whole question as JSON on stdin. |

`ask.mjs` warns when more than 100 questions are open. That is more than one person can face in
a sitting: prefer taking the default over asking another.

**Read the current decisions — do this at the start of every task:**

```bash
node tools/question-hub/answers.mjs                # answered only
node tools/question-hub/answers.mjs --all          # everything, with provisional defaults
node tools/question-hub/answers.mjs --json         # machine-readable (frozen shape)
node tools/question-hub/answers.mjs --needs-review # answers a rewording may have invalidated
node tools/question-hub/answers.mjs --file <path>  # read a DB file directly, no server needed
```

**Follow answers as they arrive** (the orchestrator runs this detached):

```bash
node tools/question-hub/watch.mjs           # long-polls forever, one line per answer
node tools/question-hub/watch.mjs --once    # exit 0 after the first batch
node tools/question-hub/watch.mjs --json    # one JSON object per line
```

**Withdraw a stale question** (soft delete — the answer is kept):

```bash
curl -X POST http://localhost:7777/api/withdraw \
  -H "content-type: application/json" -d '{"id":"Q-012","reason":"answered by D-01"}'
```

## API

All API responses carry `access-control-allow-origin: *` and `cache-control: no-store`.
`/media/` is the only cacheable route. Validation failures are `400` with
`{ "error": "<one sentence you can act on>" }` — never a stack trace, never a filesystem path.
No authentication.

| Method | Path | Body / query | Response |
|---|---|---|---|
| `GET` | `/` | — | the answering UI |
| `GET` | `/app.css`, `/*.js` | — | static, from `public/` only, extension allow-listed |
| `GET` | `/api/questions` | `?status=open\|answered\|withdrawn`, `?section=` | `{ questions, stats, status }` — excludes `withdrawn` unless asked |
| `GET` | `/api/health` | — | `{ ok, stats, version, seq }` |
| `GET` | `/api/events` | `?since=<seq>&timeout=<1..60>` | `{ events, seq }` — long-poll |
| `GET` | `/media/<repo-relative-path>` | — | the file, or a bare `404` |
| `POST` | `/api/ask` | question shape | the stored question |
| `POST` | `/api/answer` | `{ id, answer?, answerDetail?, note?, clear? }` | the stored question |
| `POST` | `/api/answer-batch` | `{ answers: [...] }` | `{ saved, skipped, skippedDetail, conflicts }` |
| `POST` | `/api/accept-recommendations` | `{ section?, ids?, dryRun? }` | `{ accepted, skipped, matched, dryRun }` |
| `POST` | `/api/withdraw` | `{ id, reason? }` | `{ withdrawn: id }` — soft delete |
| `POST` | `/api/status` | `{ headline, entries }` | the stored board |

Rules both the server and any client honour:

- Send **either** `answer` (flat string) **or** `answerDetail`. When both are present
  `answerDetail` wins and the server regenerates `answer` from it. When only `answer` is
  present the server derives `answerDetail` by matching it against the options, so `curl`
  one-liners keep working unchanged.
- **`answer` of `undefined`, `null` or `''` is ignored**, and the id comes back in `skipped`.
  Un-answering requires an explicit `{ "clear": true }`. A stray tap must never wipe an answer.
- `saved` and `skipped` are both **arrays of bare id strings** — they are two halves of one
  answer to "what happened to what I sent", so they share a shape and a caller can render them
  the same way. Why each id was skipped rides alongside in `skippedDetail`
  (`[{ id, reason }]`, reason `no-answer-sent` or `unknown-question`), added rather than
  substituted: a mistyped id is a bug in the caller, a missing answer is routine, and the two
  are worth telling apart without redefining a field other code already reads.
- Optionally send `baseUpdatedAt` per batch entry. If the question changed since then the entry
  is returned in `conflicts` with both values rather than silently overwriting the other device.
- `/api/accept-recommendations` only touches **open** questions that **have** a `recommended`.
  Questions with no recommendation are structurally excluded — they are the ones only the human
  can settle. `dryRun: true` returns exactly what would happen and writes nothing. A `section`
  that names no question at all is a `400`, not a silently empty result, so a typo is not
  mistaken for "nothing to do".

## Question shape

```jsonc
{
  "id": "M-01",                    // optional; auto-assigned if omitted
  "section": "9 · Maps",           // required — groups questions in the UI
  "question": "…",                 // required
  "why": "…",                      // why it matters — shown under the question
  "kind": "choice",                // choice | multi | text | rank | scale
  "options": ["A", "B"],           // required for choice/multi/rank; labels must be unique
  "recommended": "A",              // the agent default, shown as RECOMMENDED
  "defaultAnswer": "…",            // placeholder for text questions
  "blocking": false,
  "askedBy": "map-agent",

  // v3 additions, all optional
  "attachments": [],               // rendered between `why` and the options
  "optionMeta": {                  // keyed by option label, never by index
    "A": { "attachment": {…}, "consequence": "Restyle 12 mockups. ~3 days.", "hint": "…" }
  },
  "allowOther": true,              // default true for choice/multi/rank
  "layout": "list",                // list | compare | swatch; unknown falls back to list
  "assumedInUse": false,           // an agent has already built on the recommendation
  "priority": null,                // null | now | soon | whenever
  "revive": false                  // on re-ask: bring a withdrawn question back
}
```

`options` is `string[]` **forever**: answers are matched against it by exact string, so a shape
change there would break every existing reader and every stored answer. Rich per-option data
lives in `optionMeta`, keyed by label rather than index, because a re-ask may reorder options
and index drift would silently attach the wrong image to the wrong option. That makes duplicate
labels a correctness bug, so the server rejects them.

### How an answer is stored

Two fields. The flat one keeps its exact original meaning and format; the new one carries the
truth.

```jsonc
"answer": "Bible (Reader) | Studio (AI artifacts) | Other: Journal, but read-only",
"answerDetail": {
  "kind": "multi",
  "selected": ["Bible (Reader)", "Studio (AI artifacts)"],  // ONLY exact option strings
  "other": "Journal, but read-only",                        // ONLY free text, or null
  "ranking": null,                                          // rank only: ordered options
  "text": null,                                             // text only: the prose
  "source": "human",
  "match": "exact",
  "needsReview": false
}
```

> A string may appear in `selected` or `ranking` **only if it is `===` an entry in that
> question's `options`.** Free text appears only in `other`. There is no third possibility, so
> a downstream reader never has to guess.

The flat `answer` is **derived, never authored**:
`[...selected, other ? "Other: " + other : null].join(" | ")`, or `" > "` for `rank`. The
`Other: ` prefix means even a reader that only knows the flat string can tell a written answer
from a picked one.

| `source` | Meaning | Weight to give it |
|---|---|---|
| `human` | Picked or typed deliberately | Highest. Build on it. |
| `accepted-recommendation` | Accepted in bulk | The human endorsed the default but did not deliberate. Flag before betting a week of work on it. |
| `imported` | Derived by the v1 to v3 migration | Provenance unknown. Treat as `human`. |

`needsReview: true` means the platform could not confidently reconcile an answer with the
options — usually because the question was reworded after it was answered. It never blocks a
read; `answers.mjs --needs-review` lists them.

## Kinds

| Kind | Answer shape | Status |
|---|---|---|
| `choice` | exactly one option, or Other | keep |
| `multi` | zero or more options, plus Other | keep |
| `text` | free prose | keep |
| `rank` | an ordered subset of the options | new |
| `scale` | one integer 1–5 | accepted, **deprecated for new asks** |

**Kind is semantics; layout and attachments are presentation.** A kind exists only when the
*shape of the answer* differs. That is why an A/B image comparison is `kind: "choice"` +
`layout: "compare"` + an image per option rather than a kind of its own, a colour pick is
`kind: "choice"` + `layout: "swatch"`, and a yes/no with consequences is `kind: "choice"` with
two options and a per-option `consequence` string.

`rank` is **tap-to-rank, never drag-to-reorder**: a partial ranking (your top 3 of 10) is a
valid answer. `scale` still validates, but `ask.mjs` prints a notice suggesting `choice` with
labelled buckets, which reads better on a phone than a bare 1–5 row.

## The "Other" escape

On by default for every `choice`, `multi` and `rank`. Opt out with `"allowOther": false` for a
genuinely closed set.

- On `choice`, free text **deselects** any picked option — one answer means one answer. The
  server enforces this: sending both `selected` and `other` on a choice clears `selected`.
- On `multi` and `rank`, Other is additive alongside the picks.

## Attachments

Two places an attachment can hang: `question.attachments` (an array, rendered between `why` and
the options) and `optionMeta[<label>].attachment` (a single attachment on one option).

| `type` | Fields |
|---|---|
| `image` | `src` (repo-relative), `alt` (**required**), `caption?`, `width?`, `height?` |
| `swatches` | `swatches: [{ name, hex, note? }]` — `hex` must be `#rgb` or `#rrggbb` |
| `compare` | `left`, `right` (each an `image`), `leftLabel`, `rightLabel` |
| `code` | `language`, `code`, `caption?` |
| `note` | `markdown` — a strict subset: paragraphs, `**bold**`, `` `code` ``, `- ` lists, `> ` quote. No raw HTML, no images, no links |
| `link` | `href` (**http or https only**), `label`, `caption?` |

`compare` nests two `image` attachments rather than inventing a second image shape, so the path
rules below apply to it with no extra code. The server rejects an unknown `type` on write; a
client renders an unknown type as a dimmed placeholder so a future type can never make an old
client fail to render a question.

## Serving images safely

> **The media endpoint is a projection of the question log, not a file browser.**

`GET /media/<repo-relative-path>` is the only route that reads a file outside
`tools/question-hub/`. Every gate must pass, in order. Any failure is a **bare 404** that never
distinguishes "not allowed" from "not there", so the endpoint cannot be used to probe the
filesystem.

1. Reject before decoding if the raw path contains `..`, a backslash or a NUL. Percent-decode
   **exactly once**, then re-run the same check. A surviving `%` means double-encoding: refused.
2. Resolve against a repo root derived from `import.meta.url`, **never `process.cwd()`** — the
   server is started from several working directories and cwd is not a security boundary.
3. Root allow-list: `docs/product/mockups/`, `docs/product/`, `docs/architecture/`,
   `tools/question-hub/media/`. Tested as `candidate === root || startsWith(root + sep)`, so
   `docs/product-secrets/` cannot slip through the `docs/product/` entry.
4. Extension allow-list mapped to a fixed content-type table: `.png .jpg .jpeg .webp .gif .md
   .json .txt`. Never sniffed, never `octet-stream`. **`.svg` is deliberately excluded** — it is
   an active document that executes script on direct navigation, and every mockup here is a PNG.
5. `lstat` (not `stat`) and `isFile()`, which rejects directories **and symlinks**, so a symlink
   planted inside an allowed directory cannot point out of it.
6. **Referenced-only — the gate that matters.** The path must appear in an attachment of some
   non-withdrawn question. A file nobody asked about is 404 even if it passes 1–5, so the attack
   surface is exactly the set of files the fleet deliberately published. Withdrawing a question
   un-publishes its images.
7. Size ceiling of 8 MB.
8. Streamed with `createReadStream().pipe()`, never buffered — a phone opening a section with
   six 2 MB mockups must not spike server memory.

Responses carry `content-type` from the table, `x-content-type-options: nosniff`,
`etag: "<mtimeMs>-<size>"`, `cache-control: public, max-age=31536000, immutable` and
`content-length`; `if-none-match` is honoured with a `304`. Only the requested repo-relative
path is logged, never the resolved absolute path. **No directory listing exists** — `/media/`
and `/media/docs/` are 404 and no code path enumerates a directory.

A media `src` is validated against gates 1–4 **at ask time**, so a bad path is rejected when it
is posted rather than discovered when the human taps it.

## Storage

A single JSON file at `data/questions.json`, written atomically: the temp file is fsynced, then
renamed over the target, so a crash mid-write cannot corrupt or truncate the log. Writes are
serialised through one promise queue, so concurrent agents cannot interleave.

`data/` is gitignored — it holds the human's answers, not source. That covers snapshots and
backups with no `.gitignore` change.

Scratch output from dry-runs and diffs goes in `data/working/`, never beside the live log. A
file called `questions.migrated-preview.json` sitting next to `questions.json` and the real
backups reads as a restore candidate at exactly the moment nobody has time to check, and
restoring one would roll the human's answers back to whatever a tool was last trying. The rule
is narrow and absolute: the only files you may ever copy over `questions.json` are
`data/questions.backup-*.json` and `data/snapshots/`.

| File | Written by | Purpose |
|---|---|---|
| `questions.json` | the server only | the log |
| `snapshots/questions-<ISO>-<n>.json` | `lib/db.mjs`, after every answering write | rolling, newest 20 kept |
| `working/` | one-off tooling (`verify-migration.mjs`) | scratch output — **never a backup**; see below |
| `questions.backup-v<old>-<ISO>.json` | `loadDb()`, before the first write of a migrated DB | automatic pre-migration backup |

Long-poll waiters are woken **after** `persist()` resolves and never from inside the write
queue, so a listener holding a request open can never delay the human's answer reaching disk.
Concurrent waiters are capped at 32; beyond that a caller is turned away immediately with a
`retryAfterMs` hint, so a runaway agent cannot exhaust sockets and lock the human out of the UI.

## The v1 to v3 migration

Version 2 is skipped deliberately: an older `EMPTY_DB` claimed `version: 2` for a shape no file
on disk ever had, so jumping to 3 makes "which shape is this" answerable from the version number
alone.

**The migration runs inside `loadDb()`, in memory, at startup — and nowhere else.** The server
holds the whole database in memory and rewrites the entire file on every `persist()`. If an
external script edited the file while a server was running, the next answer the human saved
would overwrite the migrated file with the old in-memory shape: a silent, total rollback.
Making startup the only migration point removes that race by construction. The live upgrade
therefore happens on the next deliberate restart.

`migrate(db) -> db` in `lib/migrate.mjs` is a **pure function that imports no filesystem API**,
which is what makes it provable: it can be run a hundred times against a copy and diffed field
by field before it is ever allowed near the real file. A test asserts the purity rather than
trusting it.

What v3 adds, all optional and additive — nothing is renamed, retyped or removed:

| Field | Default for a legacy record |
|---|---|
| `answerDetail` | derived for answered questions, `null` for open |
| `attachments` / `optionMeta` | `[]` / `{}` |
| `allowOther` | `true` for `choice`/`multi`/`rank`, `false` for `text`/`scale` |
| `layout` | `"list"` |
| `assumedInUse` / `priority` | `false` / `null` |
| `withdrawnAt` / `withdrawReason` | `null` |
| `updatedAt` | copy of `answeredAt ?? askedAt` |

At database level: `version: 3`, `migratedFrom`, `migratedAt`, and `seq` — a monotonic integer
stamped on every event, assigned by index for existing ones. `status` gains one value,
`withdrawn`, which `GET /api/questions` excludes by default, reproducing the old behaviour
exactly.

**Deriving `answerDetail` matches in two passes.** Pass 1 is exact. Pass 2 normalises both
sides — NFC, curly quotes folded to ASCII, en/em dash to hyphen, whitespace collapsed, trimmed,
casefolded — and accepts a match only when **exactly one** option normalises the same, storing
the **original option string**, never the answer's spelling. Anything else becomes free text
with `needsReview: true`.

Pass 2 is required by the live data, not defensive padding: one stored answer contains a curly
apostrophe while its option carries a straight one, because the question was re-asked with
re-typed wording after it had been answered. Without normalised matching the migration would
demote a deliberately-picked option to free text and the fleet would read it as an off-menu
answer.

`loadDb()` **refuses to start** (exit 1, before any write path is armed) if the on-disk version
is greater than it understands, so an old server can never round-trip a new file back and drop
every new field on its next write.

`migrate()` refuses the same case on its own, throwing `FutureSchemaError` before it touches a
field. The guard is deliberately in both places rather than only at startup: `migrate()` is the
pure function every other caller reaches for — the dry-run verifier, tooling, whatever gets
written next — and a downgrade is silent by nature. It yields a plausible-looking v3 file with
every newer field quietly stripped, and the only evidence left behind is a `migratedFrom: 99`
that nobody reads until the data is already gone. A safety property that holds only when
reached through one particular caller is not a safety property.

Verification lives with the test agent in `verify-migration.mjs` — see `tests/README.md`.

## Testing

Every test runs against a **second instance** on `HUB_PORT=7788` with a temp `HUB_DATA_DIR`.
The instance on 7777 is never stopped and never pointed at test data. A test that would need to
touch `data/questions.json` is a test that must be rewritten.

```bash
node tools/question-hub/tests/smoke.mjs      # the one-command gate: boots, runs everything, tears down
node --test tools/question-hub/tests/        # node:test units and API integration
```

If a port is already in use the server exits 1 with a clear message rather than binding
silently — a run that quietly talks to somebody else's instance draws confident conclusions
from the wrong data.

## Project structure

| Path | Purpose |
|---|---|
| `server.mjs` | HTTP wiring and startup only. No business logic. |
| `lib/http.mjs` | `HttpError`, JSON responses, body reading, CORS, route dispatch |
| `lib/db.mjs` | load, atomic persist, write queue, backups, snapshots, version gate |
| `lib/migrate.mjs` | **pure** `migrate(db) -> db`; imports no filesystem API |
| `lib/answer-detail.mjs` | **pure** answer ↔ `answerDetail` and the two-pass matcher |
| `lib/questions.mjs` | ask, validation, re-ask reconciliation, stats, the read projection |
| `lib/answering.mjs` | answer, answer-batch, accept-recommendations, withdraw |
| `lib/attachments.mjs` | **pure** attachment and `optionMeta` validation; imports nothing |
| `lib/media.mjs` | the `/media/` route, its eight gates, the referenced-path set, streaming |
| `lib/static.mjs` | serves `public/` by extension allow-list |
| `lib/events.mjs` | `seq`, the event log, long-poll waiters, the 32-waiter cap |
| `lib/status-board.mjs` | fleet status board validation and storage |
| `ask.mjs` · `answers.mjs` · `watch.mjs` · `seed.mjs` · `status.mjs` | the agent CLIs |
| `public/` | the answering UI (owned by the client agent) |
| `tests/` | every test (owned by the test agent) |
| `media/` | the writable half of the media allow-list |
| `data/` | the human's answers. Only the server writes here. |

## The fleet status board

So the human can see what the fleet is doing from the same phone they answer on. The
orchestrator replaces the whole board on every update rather than patching rows: a patch-based
board accumulates stale entries and quietly stops reflecting reality; a wholesale replace cannot.

```bash
node tools/question-hub/status.mjs board.json
```

```jsonc
{
  "headline": "One line on where things stand.",
  "entries": [
    { "title": "Expo scaffold", "state": "running", "detail": "pnpm workspace, Expo Router, TS strict." }
  ]
}
```

`state` is one of `done` · `running` · `blocked` · `queued`.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `port 7777 is already in use` | Another hub is running. Stop it, or set `HUB_PORT`. |
| `refusing to start: the data file is schema vN` | The file was written by a newer server. Start that one instead; this build would drop its fields. |
| `FutureSchemaError` from a tool | Same cause, reached through `migrate()` rather than startup. Nothing was written. Run the newer build's tooling instead. |
| `questions.json is not valid JSON` | Nothing was written. Restore from `data/snapshots/` or a `questions.backup-*.json`. |
| An image 404s | Most likely gate 6: no non-withdrawn question references that path. Post the question first. `.svg` is never served. |
| An answer shows `RE-CHECK` | It was reworded after being answered. `answers.mjs --needs-review` lists them. |
| The UI shows a question the fleet says is withdrawn | Withdrawn is a soft delete; `?status=withdrawn` still returns it, with its answer intact. |

## Security

No authentication. It binds to `0.0.0.0` and is intended for a **trusted home LAN only**.
**Do not expose it to the internet.** It contains product decisions, not secrets, but anything
on it is readable and writable by anyone who can reach the port. The `/media/` gates bound what
is readable to the files the fleet deliberately published; they are not a substitute for keeping
the port off the public internet.
