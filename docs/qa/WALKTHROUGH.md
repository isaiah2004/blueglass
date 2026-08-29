# The walkthrough harness

CLAUDE.md's definition of done for a feature is not "tests pass". It is: design a
high-coverage walkthrough of the app, run it, find bugs, fix them, repeat until a full pass
is clean. This is that walkthrough — twenty-two chapters that drive the real UI in a real
browser at three widths, photograph every step, and audit each screen for the things a reader
notices and a unit test cannot see.

| | |
|---|---|
| Target | The Expo **web** build (`Q-04`: the web build in a headless browser, continuously) |
| Browser | The **installed Chrome**, via `channel: 'chrome'`. Nothing is downloaded (`A-8`) |
| Widths | phone 375×812 · tablet 768×1024 · desktop 1280×800 (`Q-006`) |
| Scripture | Nine passages across eight books, in all four shipped translations — §2 says why each one |
| Size | 237 tests · 517 screenshots · **10.4 minutes** at four workers |
| Evidence | `docs/qa/walkthroughs/<run>/` — one PNG per step, plus `RESULTS.md` |
| Entry point | `pnpm walkthrough` |

---

## 1 · Running it

```bash
pnpm walkthrough                      # every chapter, all three widths
pnpm walkthrough --project=phone      # one width
pnpm walkthrough -g "translation"     # one chapter, matched by title
pnpm walkthrough e2e/walkthrough/03-reader.spec.ts
```

Anything after `pnpm walkthrough` is passed straight through to `playwright test`.

`pnpm e2e` still works and runs the same suite; the difference is who owns the dev server.
`pnpm walkthrough` starts it, waits on a real HTTP response, and kills the whole process
tree afterwards — on success, on failure, and on Ctrl-C. It is safe to run a hundred times
in a row without cleaning anything up by hand. If a dev server is already listening it is
reused and **left running**, so the loop never kills the terminal you were working in.

### Environment

| Variable | Default | What it does |
|---|---|---|
| `ATLAS_WEB_BASE_URL` | `http://localhost:8081` | Where the web build is served. |
| `ATLAS_WALKTHROUGH_RUN` | an ISO timestamp | Names the run, and therefore its evidence folder. |
| `ATLAS_KEEP_RUNS` | `4` | How many run folders to retain; older ones are pruned. A run is roughly 5 MB of screenshots. |
| `ATLAS_E2E_WORKERS` | Playwright's default | Cap parallelism on a busy machine. |

### What a run leaves behind

```
docs/qa/walkthroughs/2026-08-29T05-59-12-431Z/
  run.json          what was driven, where, and when
  results.json      Playwright's machine-readable report
  RESULTS.md        the human summary: counts, and a table of every failure
  web-server.log    the Expo dev server's own output, if this run started it
  phone/01-launch/  one PNG per step, numbered in the order they happened
  tablet/...
  desktop/...
```

Screenshots are committed evidence rather than build output, which is why the runner prunes
old runs instead of `.gitignore`-ing them.

---

## 2 · What it covers

Twenty-two chapters, run at all three widths unless noted. Chapters 1–10 are the M1 reading
canvas; 11–15 are the M2 inline badge system; 16–22 are the breadth pass that took the suite
off Acts.

| Chapter | Journey | The questions it answers |
|---|---|---|
| `01-launch` | Cold launch at `/`, and an unknown deep link | Did the bundle mount, is the shell navigable, does the browser tab name the app, is the canvas painted dark (`D-01`), does a bad URL degrade honestly? |
| `02-tabs` | Tap through Home, Bible, Discover, Studio, Journal, then back again | Is every tab reachable by tapping, does the shell survive ten navigations without duplicating itself? |
| `03-reader` | Bible tab → reader → read a chapter | Does the tab reach the reader, is this real scripture rather than a fixture, is the whole chapter present and in order, is it set in Source Serif 4, can it be scrolled? |
| `04-translation` | Open the switcher, change translation | Are all four open translations offered, is **no licensed translation** offered, does the scripture itself change (`S-01`)? |
| `05-navigation` | Next/previous chapter, the reference picker, browser Back | Does stepping change the route, does the picker resolve a book by id, does history work on web (`T-01`)? |
| `06-verse-selection` | Tap a verse, then another, then close | Does the detail open **over** the canvas rather than replacing it (pillar 2), does it name the right verse, does closing restore a responsive reader? |
| `07-theme` | Toggle light, navigate, toggle back | Does the canvas actually invert, does scripture stay legible in the other theme, does the choice survive navigation, does the toggle travel both ways (`D-01`)? |
| `08-responsive` | Resize a live page 375 → 768 → 1280, then drag the rail | Does the layout recompute on resize, do the rail and split pane obey the 600 dp and 1100 dp breakpoints, is the rail divider actually draggable (`Q-006`, port-map risk #5)? |
| `09-search` | Open search, find a word, open a result, and search for nothing | Does search float over the reader rather than replacing it, do results contain what was searched for, is there an explicit empty state? |
| `10-error-states` | Cut the API off, then bring it back | Is there an honest error state rather than a blank canvas or an endless spinner, is the message fit for a reader, does Retry actually retry, is a 503 treated as a failure? |
| `11-badges-inline` | Read Acts 16, then read a chapter with no badges | Are there pills for all five `P-04` kinds, is each one inside its verse rather than beside it, is any pill taller than the line it sits on, does scripture still dominate the canvas (pillar 1), does a chapter with no enrichment simply read? |
| `12-badge-sheets` | Tap one badge of every kind | Does a surface open, does it carry its source **and its licence** (`AI-05`), does everything in it fit inside it, and does it show the thing that kind exists to show — the map, the timeline, the lexicon entry, the linked passages? Plus: does the history sheet say "Murai's reading" (`Q-015`) rather than stating his reading as fact? |
| `13-badge-summary` | Scroll to the chapter foot, tap a row, follow a cross-reference | Is every badge repeated as pill, teaser and chevron (`design-language.md` §5), does a row open the same badge its pill does, are the summary's sources printed, and does tapping a linked passage actually navigate? |
| `14-badge-surfaces` | Open a badge at each width; cut the API mid-session | Half sheet below 600 dp and rail at or above it, never both (`Q-006`); is the sheet really half, does the rail really not overlap the canvas; and with the API gone, are there no pills claiming data the app does not have, and do they come back when it returns? |
| `15-badges-light` | Toggle to light and revisit every badge surface | `D-01`: are the pills still painted, does a badge still open and read, does the summary still read, and does the toggle travel back? |
| `16-canon-breadth` | Genesis 1, Psalm 119, Psalm 117, Leviticus 13 | Does the reader work outside Acts at all: does the most-read chapter in the canon render whole, does the longest one (176 verses) render whole and scroll to its end, does the shortest one (2 verses) leave the chrome sane, and does a chapter with no enrichment simply read? Plus: does `support/passages.ts` still describe the corpus? |
| `17-book-boundaries` | Genesis 1, Revelation 22, Jude 1, Obadiah 1 · phone only | Is there no Previous at the head of the canon and no Next at its tail, does a one-chapter book page into its neighbours rather than to a chapter that does not exist, and does the picker's chapter grid offer exactly one tile for a one-chapter book? |
| `18-translations` | Psalm 119 and John 3 in BSB, KJV, WEB and ASV · desktop only | Is the text on screen **the text the API returned for that code**, or the previous translation's under a new label? Does every translation hold the whole chapter? And do the badges re-anchor per translation, or keep offsets computed against another one? |
| `19-deep-links` | Land on a chapter URL cold, reload, walk Back and Forward through three chapters | Does a shared link open the chapter it names or the one the store remembers, does the shell mount around it, does a reload keep the reader's place, does the pager read the route rather than a stored address, and does history hold up over more than one press? |
| `20-sheet-continuity` | Follow a cross-reference out of an open sheet and come back; switch translation three times with a rail open; scroll Psalm 119 to verse 176 with a badge open | Does a surface outlive the chapter that produced it (a correct citation about a passage no longer on screen), does a race between three translation switches leave pills the server never sent, is the phone bottom sheet genuinely modal, and can a 176-verse chapter still be read to its end with a badge open? |
| `21-badge-density` | John 3, the chapter at the selection cap | Are the server's caps — 12 per chapter, 2 per verse — still true of what the reader sees, is any badge rendered twice, does every pill sit against the word it names, and does a verse carrying two pills keep its line rhythm? |
| `22-hebrew-rtl` | `/spike/textual-sheets` · desktop only | Does `writingDirection: 'rtl'` reach the browser, are the Hebrew glyphs actually drawn rather than substitution boxes, is Greek still left-to-right, does it hold at all three container widths and in both themes — and does a badge with its provenance removed show none of its content (`AI-05`)? |

### Why these passages, and not more of Acts

Chapters 1–15 drive **Acts 16 and Acts 1**, with John 3 and Leviticus 13 touched once each.
That is a walkthrough of one book. Everything below was chosen because it stresses a
different code path, not because it is more scripture. The table lives in
`e2e/support/passages.ts` with the same reasons on each entry, and chapter 16 re-measures
every row against the live API before any chapter reasons from it.

| Passage | Why it is in the suite |
|---|---|
| **Genesis 1** (31 v) | The most-read chapter in the canon, and book 1 — a book-number lookup that works for Acts (44) and not for Genesis is the exact bug `DECISIONS.md` §4 records the prototype shipping. Also the only place `previousChapter` is `undefined`. |
| **Psalm 119** (176 v) | The longest chapter in the Bible. Twenty-six verses fit inside almost any wrong assumption about a list; 176 fit inside none of them. Poetry, so line rhythm is at its most visible. |
| **Psalm 117** (2 v) | The shortest chapter. Nothing to scroll, so every piece of fixed chrome has to fit the viewport at once. |
| **Leviticus 13** (0 badges) | The state most of the canon is in. A pill here is enrichment the server never sent. |
| **Obadiah 1**, **Jude 1** | One-chapter books, one in each testament. Five exist; their pagers must roll into the neighbouring book, and their chapter grids must hold exactly one tile. |
| **Revelation 22** | The last chapter of the last book — the only place `nextChapter` is `undefined`. |
| **John 3** (12 badges) | At `MAX_BADGES_PER_CHAPTER` exactly, with two verses at `MAX_BADGES_PER_VERSE`. The densest reading the selection rules permit, reached from a different mix of kinds than Acts 16 — so the caps are evidence rather than a repeat of the chapter they were tuned on. |
| **All four translations** | BSB, KJV, WEB and ASV, compared verse by verse against the API. Chapter 4 only ever opened KJV, and only checked that the words *changed*. |

### Two probes the breadth pass added

Both exist because the DOM alone cannot answer the question.

- **`support/scripture-api.ts`** reads the API *from Node*, so a chapter can compare what
  the reader shows against what the server said. Issued from the test process rather than
  the page, so chapter 10's staged outage cannot cut it off and make a correct app look
  like a liar.
- **`support/anchor-integrity.ts`** compares the text immediately before each pill against
  the anchor its badge declares. `anchor.start_offset` indexes into the verse text of **one
  translation**; a reader that keeps badges across a translation change anchors every pill
  to whatever word now sits at that offset. Nothing errors, every sheet still cites its
  source, and every claim is now about the wrong word. This is the only check in the suite
  that can see it.
- **`support/script-rendering.ts`** measures a word's advance against the same number of
  Private Use code points in the element's own resolved font. `toHaveText('שָׁלוֹם')`
  passes on a row of substitution boxes, because `textContent` is what was written, not
  what was painted.

### The standing audit — run after **every** step of every chapter

This is what makes each step a review rather than a smoke test. All of it is measured in
the page, none of it is a screenshot comparison.

| Check | The bug it catches |
|---|---|
| No horizontal page scroll | A rail, verse row or badge wider than the viewport. |
| No element hanging past the right edge | The specific element responsible, including when an ancestor clips it so the page does not scroll and the content is simply gone. |
| No text clipped by its own box | A translation code truncated to "BS", a button label that lost its last word. Elements with an explicit ellipsis are exempt — that is a design choice. |
| No text below the viewport with nothing to scroll | Fixed chrome taller than the space it was given: a tab bar whose labels are sliced by the bottom edge. |
| No overlapping sibling text | A verse number colliding with its verse, two tab labels on top of each other. |
| Every pressable control ≥ 44 px | A tab bar with 32 px buttons, an icon-only close with no padding. |
| No text under 9 px, none at zero alpha | Metadata below the design system's own smallest step (`metadataSize.xs`), and text that is present, correctly sized, and painted at zero alpha. |
| No console errors, no uncaught page errors | A component that throws inside an effect and leaves the tree rendered. |
| No failed or ≥ 400 network requests | A request that fails behind a component that quietly renders its empty state. |

Two audits are asserted where they mean something rather than everywhere: **the scripture
serif** (chapter 3, on a real verse — it checks both that the style names Source Serif 4
and that a face with that family is genuinely loaded, because a stylesheet naming a font
the browser never received looks entirely plausible) and **theme inversion** (chapter 7,
by measured lightness rather than by inequality, so a "light" theme darker than the dark
one still fails).

---

## 3 · The test-id contract

Playwright can only address what the app names. `e2e/support/test-ids.ts` is the agreed
vocabulary between the feature screens and this harness: the screens put these strings in
`testID`, the harness looks them up, and neither side has to read the other's source.
React Native Web renders `testID="x"` as `data-testid="x"`, and the same prop works on the
Android build, so nothing here is web-only.

**The app names things; the harness follows.** Where a screen already ships an id, the
contract records that id rather than asking for a rename — a harness is not worth three
agents renaming forty props.

| Surface | Test ids the app ships today |
| --- | --- |
| Shell | `tab-bar` · `theme-toggle` · `nav-settings` |
| Tabs | `tab-home` · `tab-bible` · `tab-discover` · `tab-studio` · `tab-journal` |
| Screens | `home-screen` · `bible-screen` · `discover-screen` · `studio-screen` · `journal-screen` · `not-found-screen` · `settings-screen` |
| Reader | `reader-screen` · `reader-header` · `chapter-canvas` · `chapter-title` · `chapter-previous` · `chapter-next` · `chapter-attribution` · `verse-row-{n}` |
| Translation | `open-translations` · `translation-sheet` · `translation-{CODE}` |
| Reference picker | `open-navigator` · `navigator-sheet` (phone) · `navigator-rail` (≥ 600 dp) · `book-navigator` · `book-{bookId}` · `chapter-grid` · `chapter-tile-{n}` |
| Failure and loading | `reader-offline` · `reader-error` · `reader-notFound` · `reader-bad-address` · `reader-message-action` · `chapter-skeleton` |
| Verse detail | `verse-sheet` · `verse-sheet-reference` · `verse-sheet-close` |
| Search | `search-open` · `search-overlay` · `search-input` · `search-results` · `search-result-{i}` · `search-empty` · `search-close` |
| Split layout | `reader-context-rail` · `reader-rail-handle` · `reader-split-pane` |
| **Badges (M2)** | `inline-badge-{badgeId}` · `badge-sheet` · `reader-context-badge` · `badge-rail-close` · `badge-detail-{badgeId}` · `badge-detail-teaser` · `badge-sources-{badgeId}` · `chapter-badge-summary` · `chapter-badge-sources` · `badge-summary-row-{badgeId}` |
| **Badge bodies (M2)** | `spatial-route-map` · `spatial-city-map` · `history-axes` · `root-lemma` · `cross-ref-targets` · `cross-ref-row-{verseKey}` · `history-murai-note` |
| **Diagnostic route** (`/spike/textual-sheets`) | `textual-sheet-gallery` · `gallery-width` · `gallery-width-{phone\|rail\|wide}` · `gallery-sheet-{root\|root-hebrew\|history\|cross-ref\|unattributed}` · `root-lemma` · `root-transliteration` · `root-strongs` · `root-surface` |

### Two contracts, not one

`e2e/support/test-ids.ts` holds the M1 vocabulary; `e2e/support/badge-ids.ts` holds M2's.
They are separate because a badge id is not a shell id and a chapter that only drives
badges should not have to import forty ids it will never use — not because M2's are any
less binding.

### Unreachable — an id a real component carries that nothing in the reader mounts

Every id in the M1 table above is now set by a shipped component; the surfaces once marked
**OWED** have all been built. The **badge bodies** row is different, and the difference
matters. Those ids are carried by finished components in
`apps/mobile/src/features/sheets/`, but nothing mounts `BadgeSheetProvider`, so the reader
never renders any of them. `/spike/spatial-sheets` and `/spike/textual-sheets` show what
the reader is missing.

A step that fails on one of these is **not** a harness bug, and the assertion must not be
weakened to "the chrome is present" — that would turn the headline M2 defect into a pass.

## 4 · Adding a step

1. **Find the chapter it belongs to** in `e2e/walkthrough/`. A new chapter is a new
   numbered file; the number is its place in the journey, and it becomes the screenshot
   folder name.
2. **Wrap it in `walkthrough.step()`.** That is what photographs it, runs the standing
   audit, and asserts the console is clean. A bare `await page.click(...)` outside a step
   is invisible in the evidence trail.
3. **Address elements by test id**, adding the id to `e2e/support/test-ids.ts` first if it
   does not exist. Matching on visible copy breaks the day a word changes and cannot
   address an icon-only control.
4. **Say what the assertion catches**, in a comment, above it. This is the harness's one
   hard rule: an assertion that cannot fail is noise, and an assertion whose purpose is not
   written down gets weakened by the next person who sees it go red.
5. **Wait on a condition, never on a duration.** `expect(...).toBeVisible()` and
   `expect.poll(...)` retry; `waitForTimeout` guesses. A flaky walkthrough is worse than
   no walkthrough, because it teaches everyone to ignore a red run.

```ts
await walkthrough.step('switch to the KJV', async () => {
  await page.getByTestId(TRANSLATION_IDS.switcher).click();
  await page.getByTestId(translationOptionId('KJV')).click();

  // Catches: a menu that never closes, which leaves the reading canvas covered —
  // a direct pillar-1 failure ("no floating menus over scripture").
  await expect(page.getByTestId(TRANSLATION_IDS.menu)).toBeHidden();
});
```

---

## 5 · How the API outage is staged

Chapter 10 does not run `docker compose stop api`. It cuts the connection inside the
browser (`e2e/support/api-outage.ts`): every request to an origin other than the page's
own, plus anything on an `/api/` path, is either refused or answered with a 503.

From the app's point of view that is the same fact, and it is a great deal more
deterministic — instant, isolated from every other test running in parallel, always undone,
and it cannot leave a developer's stack down because a run was interrupted.

The outage counts what it intercepts, and chapter 10 asserts that count is above zero
before it concludes anything. Without that guard, an app that never calls the API at all
would be reported as "missing an error state", sending someone to fix the wrong file.

---

## 6 · What this does **not** cover yet

Stated plainly, because an unwritten gap gets mistaken for a passing check.

**Not covered — out of scope by decision**

- **iOS.** Out of scope entirely (`T-01`).
- **The Android device build.** Device coverage is Maestro's job, before each milestone
  (`Q-01`). Everything here is the web build.
- **Colour contrast ratios.** Already locked at the token level by
  `apps/mobile/src/theme/colors.contrast.test.ts` against WCAG AA (`Q-017`). Re-deriving
  them from rendered pixels would be less accurate and would fail for reasons the design
  system has already settled.
- **AI output quality.** Golden-set evals own citation accuracy. This harness must never
  trigger a model call — an unattended loop that could spend the budget is a loop that
  eventually will.

**Not covered — not built yet, or not yet worth an assertion**

- **Six of the eleven inline badges.** `P-04` ships five — Route, Site, History, Root,
  Cross-Ref — and chapters 11-15 drive all five end to end, including their sheet bodies.
  Manuscript, Structure, Cultural, Context, Meditate and Lineage have no wire spelling yet
  and therefore nothing to walk through. The badge spike has its own spec
  (`e2e/inline-badge-spike.spec.ts`), which is deleted with the spike route.
- **Hebrew *in scripture*.** `L-06`: the word layer covers books 40-66 only — 142,096 rows,
  all Greek — so no Root badge a reader can reach is Hebrew, while the lexicon already holds
  8,021 Hebrew and 653 Aramaic headwords. Chapter 22 now drives right-to-left rendering
  through the synthetic probe at `/spike/textual-sheets`, which is the only place it exists.
  **That is a probe, not the product**: the day Hebrew verse words land, chapter 22 moves to
  the reader and its assertions come with it unchanged.
- **The Discover, Studio and Journal tabs beyond "it renders and is sound".** Their content
  is not built. Chapter 2 audits them; it does not exercise them.
- **The settings screen and the reader's display sheet.** `nav-settings` and the display
  controls are shipped and reachable, and no chapter opens either. This is the surface the
  `SegmentedControl` tap-target defect actually shipped on — fixed in `0.19.0` — and chapter
  22 caught it only because a diagnostic route happens to mount the same component. That is
  luck, not coverage: the component now carries its own test
  (`components/controls/SegmentedControl.test.tsx`), which is where a control's own rule
  belongs.
- **Verse-level and word-level selection inside a long chapter.** Chapter 6 taps a verse in
  Acts 1; nothing taps verse 140 of Psalm 119, where a sheet opening near the foot of a very
  long scroll is a different layout problem.
- **The remaining 57 books.** The suite drives nine passages across eight books by design —
  each chosen for a code path (see §2, "Why these passages"). Coverage of the canon is by
  *shape*, not by enumeration: a tenth narrative chapter would add run time and no new path.
- **Audio.** Stubbed by `AU-01`, so there is nothing behaving to walk through.
- **Journal encryption (`J-01`) and cross-device sync (`A-03`).** Both need a second client
  to be meaningful; a single browser cannot observe a sync conflict.
- **Offline behaviour**, beyond the API outage in chapter 10. Service-worker caching and
  a genuinely offline launch are untested.
- **Keyboard navigation and screen readers.** Tap targets and text size are audited; focus
  order, focus visibility, and the accessibility tree are not.
- **Whether the translation choice survives a reload**, and whether the theme choice
  survives one. Nothing has decided that they should, and the harness does not assert
  behaviour nobody has asked for. Chapter 7 does check that the theme survives
  *navigation*, which is a different and unambiguous promise.
- **Scroll position restoration** when returning to a chapter, and the reader's "last
  saved position" that the Bible tab is supposed to redirect to. Chapter 3 asserts the tab
  reaches *a* chapter, not that it is the right one.

**Known limits of the audits themselves**

- **Overlap detection only sees sibling text in normal flow.** An absolutely positioned
  element covering content is indistinguishable from a sheet doing its job, so it is not
  reported. Overlap between non-siblings is missed.
- **Screenshots are not compared between runs.** There is no visual-regression baseline, so
  a purely cosmetic change is invisible to the assertions; it is visible to a human
  flipping through the run folder, which is what that folder is for.
- **The tap-target minimum is 44 px at every width**, including desktop, where a mouse
  makes a smaller control merely unpleasant rather than unusable.
- **A verse row is measured as a tap target**, because tapping it is how a reader opens
  verse context. A single-line verse at 20 pt with 1.6 line-height lands at about 42 px,
  so short verses fail by two pixels. That is a real tension between the reading rhythm and
  the touch minimum, and it is surfaced rather than exempted: the product owner should
  decide whether verse rows get extra vertical padding or their own smaller minimum.
- **One defect can fail several tests.** The standing audit runs after every step, so a
  small control anywhere on a route fails every test that visits it. Chapter 22 reported the
  `SegmentedControl` tap-target defect five times for one cause before `0.19.0` fixed it;
  `RESULTS.md` groups failures by cause, which is what makes that readable rather than
  misleading.

### Run cost, and what was traded to keep it

The breadth pass roughly doubles the chapter count. Three deliberate trades keep the run
usable rather than letting it grow to match:

| Trade | Why |
|---|---|
| **Chapters 17, 18 and 22 run at one width.** 17 is arithmetic plus one row of chrome, tightest at 375 px; 18 compares text against the API, which does not vary with the window; 22 sets its own container widths inside the page. Running each at three would triple the run and re-prove chapter 8's breakpoint work. | Costs three-width coverage of journeys that are not about width. |
| **Chapter 18 samples six verses of a 176-verse chapter**, evenly spaced and always including the first and the last, rather than comparing all 176 in four translations. | 704 DOM reads per chapter would dominate the run. Six catches a wholesale wrong translation, which is the failure; it would miss a single corrupted verse in the middle, which nothing else would catch either. |
| **Chapter 22's tests are one step each.** | The standing audit used to fail on that route (see above), and a chapter split into four steps would have aborted at the first one and measured no Hebrew at all. One step per test means the chapter's own subject is always evaluated before the audit fires — worth keeping now that the audit passes, because the next defect on that route would otherwise hide the Hebrew again. It costs the per-step screenshot trail on that chapter. |

What was **not** traded: `retries` is still 0, no assertion was relaxed to fit the budget,
and every new step still photographs itself and runs the full standing audit.

---

## 6b · Timeouts, and why there are five of them

`retries` is **0** and stays 0 (`OP-01`, and `playwright.config.ts` says so): a retry would
hide exactly the flake this harness exists to expose. The way flake is dealt with instead is
to give each wait a budget that matches what it is waiting for, so a failure names the right
thing.

| Wait | Budget | Why |
|---|---|---|
| An assertion about an element that is either in the tree or is not | 10 s (`expect.timeout`) | The default. A genuinely missing element must fail fast. |
| A click, once the page has settled | 15 s (`actionTimeout`) | Instant in practice. A control that is covered, disabled or moving still fails inside a step. |
| **A control settling after a cold start** | 60 s (`support/settle.ts`) | Playwright's own stability check — the same bounding box across two consecutive animation frames — cannot settle while the main thread is starved by a cold Metro bundle under six workers. Used before every inline pill and before the spike's tap test. |
| **The first painted verse of a chapter** | 30 s (`support/journeys.ts`) | An HTTP round trip behind a bundle that may still be compiling. Measured at 7-9 s with four workers and past 10 s with six. |
| A step as a whole | 90 s (`timeout`) | Absorbs all of the above and still fails a genuinely hung run. |

The budget nobody should need is the one for **compiling a route**. Metro compiles per
route, and `support/global-setup.ts` warmed only `/`, so a diagnostic spike — a route
nothing else in the app imports — was compiled inside a chapter's own 90 s and
`inline-badge-spike.spec.ts` duly failed run after run at desktop with 1.6 minutes burned
in a `beforeEach`. `0.19.0` warms `/spike/badges` and `/spike/textual-sheets` in the setup
alongside `/`. The budget was deliberately **not** raised: a longer timeout would have
moved the cost into the number this harness reports rather than out of it.

None of these changes an **assertion**. Verse 1 must still be on screen; the pill must still
be tappable; a badge with no provenance must still not render. What they change is how long
the harness waits for the machine, which is not the thing under test.

---

## 7 · The other specs in `e2e/`

| Spec | Status |
|---|---|
| `e2e/walkthrough/*.spec.ts` | The walkthrough. This document. |
| `e2e/shell.spec.ts` | The original routing scaffold check — five routes, `+not-found`, no missing-icon placeholder. It asserts on placeholder copy (`Today's Drop`, `Acts 1:1`), so it is expected to go red as the real screens land, and should be deleted when the last `PlaceholderScreen` does. |
| `e2e/inline-badge-spike.spec.ts` | Drives `/spike/badges`, which `global-setup.ts` now warms so the compile is not charged to this spec. Delete both with the spike route once the reader renders badges for real. |
