# The walkthrough harness

CLAUDE.md's definition of done for a feature is not "tests pass". It is: design a
high-coverage walkthrough of the app, run it, find bugs, fix them, repeat until a full pass
is clean. This is that walkthrough — ten chapters that drive the real UI in a real browser
at three widths, photograph every step, and audit each screen for the things a reader
notices and a unit test cannot see.

| | |
|---|---|
| Target | The Expo **web** build (`Q-04`: the web build in a headless browser, continuously) |
| Browser | The **installed Chrome**, via `channel: 'chrome'`. Nothing is downloaded (`A-8`) |
| Widths | phone 375×812 · tablet 768×1024 · desktop 1280×800 (`Q-006`) |
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

Ten chapters, run at all three widths unless noted.

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

### Owed — the harness reaches for these and nothing sets them

A step that fails on one of these is **not** a harness bug. It is a walkthrough step whose
screen has not been built, and the failure message names the id to add.

| Id | Which chapter needs it | What it is |
| --- | --- | --- |
| `reader-context-rail` | 8 | The ≥ 600 dp context rail. `components/split/ContextRailShell.tsx` accepts a `railTestID`; the reader does not pass one. |
| `reader-rail-handle` | 8 | The draggable divider, from the same component. |
| `reader-split-pane` | 8 | The ≥ 1100 dp two-pane split. |
| `verse-sheet`, `verse-sheet-reference`, `verse-sheet-close` | 6 | The verse detail surface. Tapping a verse currently selects and highlights it; nothing opens. |
| `search-open`, `search-overlay`, `search-input`, `search-results`, `search-result-{i}`, `search-empty`, `search-close` | 9 | Full-text scripture search. The reader's `book-search` filters the book list, which is a different feature. |

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

- **The eleven inline badges.** M1 is "real scripture on screen"; badge sheets, the map,
  the timeline and word roots are later milestones. The badge spike has its own spec
  (`e2e/inline-badge-spike.spec.ts`), which is deleted with the spike route.
- **The Discover, Studio and Journal tabs beyond "it renders and is sound".** Their content
  is not built. Chapter 2 audits them; it does not exercise them.
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

---

## 7 · The other specs in `e2e/`

| Spec | Status |
|---|---|
| `e2e/walkthrough/*.spec.ts` | The walkthrough. This document. |
| `e2e/shell.spec.ts` | The original routing scaffold check — five routes, `+not-found`, no missing-icon placeholder. It asserts on placeholder copy (`Today's Drop`, `Acts 1:1`), so it is expected to go red as the real screens land, and should be deleted when the last `PlaceholderScreen` does. |
| `e2e/inline-badge-spike.spec.ts` | Drives `/spike/badges`. Delete it with the spike route once the reader renders badges for real. |
