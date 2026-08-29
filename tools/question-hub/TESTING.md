# Testing the Question Hub

The hub is a second first-class project, not a script, so it is tested to the same bar as
the app: a walkthrough of the real UI, not a green unit-test run.

Everything below runs against **disposable servers on ports 7788+ with temp data
directories**. The instance on **7777 is never stopped, never pointed at test data, and
never written to**. The suite proves that rather than promising it — see
[Why this cannot touch your answers](#why-this-cannot-touch-your-answers).

---

## Run it

```bash
node tools/question-hub/tests/smoke.mjs
```

That is the gate. It syntax-checks every source file, asserts the server still imports
nothing but `node:*`, runs the unit tests, runs the API integration tests, runs the
Playwright walkthroughs, and finally re-fingerprints the live answers file. It exits
non-zero on any of them.

From inside `tools/question-hub/` you can also use the scripts:

| Command | What it runs | Roughly |
|---|---|---|
| `npm test` | the whole gate | ~3 min |
| `npm run test:fast` | everything except Playwright | ~20 s |
| `npm run test:unit` | `node:test` units — migrate, answer-detail, attachments, media gates | ~1 s |
| `npm run test:api` | `node:test` integration against real servers on 7788+ | ~15 s |
| `npm run test:e2e` | Playwright, both viewports | ~2 min |
| `npm run test:e2e:phone` | Playwright, 390×844 only | ~1 min |
| `npm run test:gate` | the whole gate **plus** the §4.6 migration gate against the live backup | ~3 min |

`tools/question-hub/package.json` exists only for these scripts. It sits outside the
workspace globs (`apps/*`, `packages/*`), so `pnpm install` at the root neither reads nor
links it, and **no root script was added** — the root `package.json`, `playwright.config.ts`
and `vitest.config.ts` are shared with the app workflow and are owned by nobody.

### Browsers

Playwright resolves from the repo root's `node_modules`. If the pinned browser revision
has not been downloaded, `playwright.config.mjs` falls back to the newest Chromium already
present under `%LOCALAPPDATA%\ms-playwright`, so the suite stays runnable without a
download. Override with `HUB_CHROME=/path/to/chrome`. If no Chromium exists at all, run
`npx playwright install chromium` once.

---

## Why this cannot touch your answers

`data/questions.json` holds answers a human already gave. Four independent mechanisms keep
the suite away from it, in `tests/helpers/hub-server.mjs`:

1. **Source check before spawning.** If neither `server.mjs` nor `lib/db.mjs` mentions
   `HUB_DATA_DIR`, `startHub()` throws instead of starting anything — a server that ignored
   the override would open the live file, so the check happens while nothing is running.
2. **Path check.** A resolved data directory inside the real `data/` aborts the run.
3. **Count check after boot.** `/api/health` must report exactly the fixture's live question
   count. A server that loaded the real file reports ~97 and is killed immediately, before
   any test issues a write.
4. **Answer census before and after.** `smoke.mjs` records every answered question — id,
   answer text, timestamp — at the start of the run and compares it at the end. **A lost or
   rewritten answer fails the run even if every test passed.**

   That check is a census rather than a hash of the whole file on purpose. The hub on 7777
   is a live service: while the suite runs, a fleet agent may post a new question and change
   those bytes for entirely legitimate reasons. A whole-file hash would fail the run every
   time that happened, and a gate that cries wolf gets ignored — at which point it protects
   nothing. New questions and new answers are fine; **losing or altering an existing answer
   is not.**

Fixtures are hand-written and live in `tests/fixtures/`. **Nothing is ever copied out of
`data/`.** If you need a new scenario, write the record — do not paste a real one.

---

## The layers

| Layer | Where | What it is for |
|---|---|---|
| Pure units | `tests/*.test.mjs` | migrate, answer-detail, attachment validation, `/media/` gates |
| API integration | `tests/api/*.test.mjs` | every endpoint against a real server on a temp dir |
| Data safety | `tests/api/migration-safety.test.mjs` | **the most important file**: a v1 database loads through the real server and loses no answer |
| UI | `tests/e2e/*.spec.ts` | Playwright walkthroughs at 390×844 and 1280×800 |
| Migration gate | `verify-migration.mjs` | the §4.6 pre-restart gate: backup, dry run, identity, old-reader equivalence, idempotence |

### The migration gate, run on its own

```bash
node tools/question-hub/verify-migration.mjs --backup     # copy + verify by size and SHA-256
node tools/question-hub/verify-migration.mjs --dry-run    # migrate the COPY; identity + idempotence
node tools/question-hub/verify-migration.mjs --report     # the above plus answers.mjs byte-equality
```

`--backup` is the only step that reads `data/questions.json`, and it only ever reads it.
Every later step loads the backup instead. **This tool never writes `data/questions.json`.**

---

## Adding a test case

### A new UI journey

Add a `*.spec.ts` under `tests/e2e/` and import the shared fixture:

```ts
import { test, expect, save, sel, revealCard } from './hub-fixture';

test('answering M-01 records both picks', async ({ hubPage }) => {
  const { page, hub } = hubPage;          // fresh server, fresh temp dir, page already loaded

  await page.click(sel.option('M-01', 'Route'));
  await save(page);

  const stored = (await hub.readDb()).questions.find((q) => q.id === 'M-01');
  expect(stored.answerDetail.selected).toEqual(['Route']);
});
```

Four things to know:

- **`sel` is the selector contract.** Every DOM hook the suite depends on is in one object
  at the bottom of `hub-fixture.ts`. If the client markup is renamed, that is the only file
  to edit.
- **Assert against `hub.readDb()`, not only the screen.** A UI that displays an answer it
  never saved is precisely the failure worth catching, and it looks green if you only check
  the DOM.
- **Use `revealCard(page, id)`** when a question may be filtered out or inside a completed
  section — finished sections collapse, so a card can be legitimately hidden after it is
  answered.
- **Need different data?** `test.use({ seedFixture: 'unknown-attachment.json' })` inside a
  `describe` swaps the seed for that block.

### A new fixture

Hand-write it into `tests/fixtures/` with a `_comment` saying what it is for and what would
break without it. Keep it small: a fixture that covers one thing tells you what failed.

### A new unit or API test

Drop a `*.test.mjs` into `tests/` or `tests/api/`. API tests boot their own server:

```js
const nextPort = portAllocator(7900);            // give each FILE its own base port
async function hub(t, fixture = 'e2e-seed.json') {
  const instance = await startHub({ fixture, port: nextPort() });
  t.after(() => instance.stop());                // per TEST, never per file
  return instance;
}
```

Ports are handed out monotonically and never reused. That is not fussiness: a reused port
lets a server that failed to bind leave the *previous* test's server answering, and the new
test then asserts against the old test's data. It cost an hour to find once already.

---

## Rules for tests here

- **Wait on conditions, not durations.** No `waitForTimeout` in a committed test. To make
  the background poll fire, post a question as a fleet agent would and wait for its card to
  appear. To reload after staging, wait for the draft to reach `localStorage`.
- **No shared state.** One server, one temp directory, one test.
- **Every test must be able to fail.** State in a comment or an assertion message what bug
  it would catch. The media path-safety suite was verified by mutating a *copy* of
  `lib/media.mjs` — bare `startsWith` on the root allow-list, re-admitting `.svg`, and
  dropping the withdrawn check — and confirming exactly the three intended tests went red.
- **Never weaken a test to make it pass.** If a test is red because a sibling agent's code
  has not landed, leave it red and say so.

---

## Where the suite stands

Measured on the last full run, against the code as it stood when this harness was written.

| Layer | Tests | Passing |
|---|---|---|
| `node:test` units | 92 | 92 |
| `node:test` API integration | 73 | 73 |
| Playwright (phone + desktop) | 170 | 170 |
| **Total** | **335** | **335** |

Plus: syntax check, the zero-dependency check, the live-answer census, and the full §4.6
migration gate — all green. Confirmed over three consecutive full-gate runs, because the suite
runs with `retries: 0` on purpose and a defect that shows up one run in three is still a defect.

## Known-red tests

None. The suite is fully green.

The three defects this table used to carry have been fixed at their root, and the tests that
caught them now pass unchanged — none was edited to make it green:

| Was red | Fixed by |
|---|---|
| `answer-safety.test.mjs` › *a batch entry with no answer field is skipped* | The test was right and the implementation was wrong: hub-platform.md §7 freezes `skipped: [ids]`. `handleAnswerBatch` now returns bare ids and carries the per-id reason alongside in the new `skippedDetail`, so the diagnosis survives without bending the contract. |
| `migrate.test.mjs` › *a database from a newer server is never silently downgraded* | `migrate()` now throws `FutureSchemaError` before touching a field. The guard lives in the pure function, not only in `loadDb()`, because a property that holds only via one caller is not a property. `verify-migration.mjs` reports the refusal as a refusal rather than a stack trace. |
| `accept-all.spec.ts` › *the sticky bar reports the staged answers* | `render()` updated the Save button but never the status text, so the accept sheet could stage four answers under an "Up to date" label. Both are now written together in one `syncSaveBar()`, which every staging path already routes through — so the accept sheet, Undo, and the input listener were all fixed by the same change. |

### A fourth defect, found while fixing the third

`mobile-and-board.spec.ts` › *leaving the board returns to the questions* failed once in three
full runs and passed 5/5 in isolation, which is the shape of a flake. It was not one.

The artifact showed the page stuck at "0 of 0 answered" with an empty list, while the fixture's
own boot gate had already proved the server was serving 11 questions. So the browser's *first*
`/api/questions` fetch had failed transiently — and `load()` scheduled no retry. The event
subscription only reloads when an event **arrives**, and a test hub with no agents posting sends
none, so the page stayed empty for good. On a phone that reads as "the fleet has asked me
nothing" rather than as an error.

`load()` now retries on the existing backoff ladder and never gives up, and the status bar says
`offline … retrying` instead of `Up to date` while it is cut off — the same lie as the sticky
bar, wearing a different coat. Covered by `resilience.spec.ts` (6 tests), each verified to fail
against the unfixed code.

Run `npm run test:fast` to see the current list without waiting for Playwright.
