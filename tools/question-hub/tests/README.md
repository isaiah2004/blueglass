# `tools/question-hub/tests/`

The mechanics. For how to run the suite and how to add a case, read
[`../TESTING.md`](../TESTING.md) first — this file is the map of what lives where.

```
tests/
├── smoke.mjs                     the one-command gate (see ../TESTING.md)
├── helpers/
│   ├── hub-server.mjs            boots a disposable hub; the isolation guards live here
│   ├── migration-gates.mjs       identity / idempotence / census, as pure functions
│   └── answers-oracle.mjs        runs the real answers.mjs against an in-memory DB
├── fixtures/                     hand-written databases — NEVER copied from data/
├── api/                          node:test integration against real servers
├── e2e/                          Playwright walkthroughs
└── *.test.mjs                    node:test units
```

## The unit suites

| File | Pins down |
|---|---|
| `migrate.test.mjs` | the v1 → v3 transform: no answer lost, identity gate, the curly-apostrophe case by name, idempotence, degenerate inputs |
| `answer-detail.test.mjs` | `selected` may contain only exact option strings; the flat `answer` stays derivable; normalisation folds punctuation and nothing else |
| `attachments.test.mjs` | every rejection an agent should hit at ask time rather than the human hitting on a phone |
| `media-path-safety.test.mjs` | one named test per gate in §3.3 |

`media-path-safety.test.mjs` runs against `resolveMediaPath` rather than over HTTP on
purpose. That function never touches the filesystem, so a rejection can only have come
from the gate under test. Over HTTP a missing file 404s for its own reasons and would mask
a broken extension or root check — the HTTP behaviour is covered separately in
`api/media.test.mjs`, which is where the headers, the 304 and the
*all-refusals-look-identical* property are checked.

## The integration suites

| File | Pins down |
|---|---|
| `api/migration-safety.test.mjs` | **the most important file here.** A v1 database goes through the real server's real load path and every answer comes out intact. Also: the server's own pre-migration backup, rolling snapshots and their pruning, and the refusal to start on a version it does not understand. |
| `api/answer-safety.test.mjs` | the three live defects — withdraw destroying an answer, a re-ask orphaning one, an empty string un-answering — plus 50 concurrent writes |
| `api/media.test.mjs` | `/media/` over HTTP: headers, 304, no directory listing, and refusals that cannot be told apart |
| `api/events.test.mjs` | the long-poll, and that 33 held listeners cannot delay a save |
| `api/questions-api.test.mjs` | every endpoint in §7, success and each documented 400 |

## Port map

Ports are handed out monotonically by `portAllocator(base)` and **never reused**, because a
reused port lets a server that failed to bind leave the previous test's server answering —
and the next test then asserts against the previous test's data.

| Range | Used by |
|---|---|
| 7777 | **the human's live hub. Never touched.** |
| 7788 | `startHub()` default, and the isolation smoke check |
| 7800+ | `api/answer-safety.test.mjs` |
| 7820+ | `api/migration-safety.test.mjs` |
| 7840+ | `api/media.test.mjs` |
| 7860+ | `api/events.test.mjs` |
| 7880+ | `api/questions-api.test.mjs` |
| 7900+ | Playwright, via `e2e/hub-fixture.ts` |
| ephemeral | `helpers/answers-oracle.mjs` stub servers |

`node --test` runs files in parallel, so a file that reuses another file's base port will
fail in a way that has nothing to do with what it asserts. Give a new file its own range.

## Fixtures

| File | Exists because |
|---|---|
| `legacy-v1-kinds.json` | one record per kind in the exact v1 shape |
| `legacy-v1-curly-apostrophe.json` | reproduces the **shape** of the live D-01 defect — an answer whose punctuation drifted from its option — plus em dash, curly quotes, whitespace/case, and an ambiguous pair the matcher must refuse to guess between |
| `legacy-v1-edge-cases.json` | an off-menu answer, an option label containing `" | "`, an answered-but-empty record, a withdrawn record |
| `legacy-v1-empty.json` | a first-boot database |
| `already-v3.json` | migrating twice must change nothing |
| `future-version-99.json` | a newer server's file; loading it must refuse, not downgrade |
| `e2e-seed.json` | the UI suite's world. **Its counts are load-bearing** — 11 questions, 1 answered, 1 blocking, exactly 3 open recommendations in `1 · Scope & truth`, exactly 1 recommended and 1 not in `5 · Only you can settle`. Change a count and `accept-all.spec.ts` changes with it. |
| `media-safety.json` | every hostile `src` is *referenced*, so gate 6 passes for all of them and any 404 must come from an earlier gate the test can name |
| `unknown-attachment.json` | a database written by a newer hub: an unknown attachment type, an image with no `src`, and `javascript:`/`data:` links. Fed through the data file rather than `POST /api/ask` because ask-time validation would reject them, and the case being tested is a client meeting data it has never seen. |

Nothing here is copied out of `data/`. If you need a new scenario, write the record.

## Proving a test can fail

The media path-safety suite was verified by copying `lib/media.mjs` into a scratch
directory, introducing three real defects — a bare `startsWith` on the root allow-list,
re-admitting `.svg`, and dropping the withdrawn check from the referenced set — and
confirming that exactly the three intended tests went red and nothing else moved. The
mobile predicates were verified the same way, by injecting a 900px element with no scroll
parent and a 30px button and confirming both were caught.

Do the same for any assertion you are not sure bites. Mutate a **copy**; the production
modules belong to the server and client agents.
