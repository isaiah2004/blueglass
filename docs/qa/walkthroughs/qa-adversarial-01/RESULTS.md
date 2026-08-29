# Walkthrough run

- Finished: 2026-08-29T02:04:10.335Z
- Playwright exit code: 1
- Tests: 108 — 58 passed, 50 not passed
- Screenshots: 87

## Failures, grouped by cause

### 6 test(s) — Error: the search control (testID "search-open") is not on screen, so it cannot be tapped

- walkthrough/09-search.spec.ts · search finds real verses without losing the reader place
- walkthrough/09-search.spec.ts · a query with no matches says so

### 4 test(s) — Error: expect(locator).toBeVisible() failed

- shell.spec.ts · the tab bar carries all five tabs on every route
- walkthrough/10-error-states.spec.ts · the reader recovers when the API comes back

### 3 test(s) — Error: tapping Bible did not reach the reader (testID "reader-screen")

- walkthrough/03-reader.spec.ts · the Bible tab opens the reader on real scripture

### 3 test(s) — Error: the detail surface for verse 1 (testID "verse-sheet-reference") is not showing Acts 1:1

- walkthrough/06-verse-selection.spec.ts · selecting a second verse updates the detail

### 3 test(s) — Error: scripture is painted "rgb(0, 0, 0)" on a dark canvas, which cannot be read

- walkthrough/07-theme.spec.ts · the theme toggle genuinely inverts the reading canvas

### 3 test(s) — Error: the API returned 503 and the reader showed no failure surface — a non-2xx response is being treated as success

- walkthrough/10-error-states.spec.ts · a 503 from the API is handled like an outage, not ignored

### 2 test(s) — Error: tap-target audit — <viewport> / 03-reader.spec.ts / open Acts 1 — 2 problem(s):

- walkthrough/03-reader.spec.ts · a chapter renders in full, in the scripture serif

### 2 test(s) — Error: tap-target audit — <viewport> / 03-reader.spec.ts / open Acts 1 and scroll to the last rendered verse — 2 problem(s):

- walkthrough/03-reader.spec.ts · the reader scrolls to the end of the chapter

### 2 test(s) — Error: tap-target audit — <viewport> / 04-translation.spec.ts / open the reader — 2 problem(s):

- walkthrough/04-translation.spec.ts · the switcher offers every open translation and no licensed one

### 2 test(s) — Error: tap-target audit — <viewport> / 04-translation.spec.ts / read verse 1 in the default translation — 2 problem(s):

- walkthrough/04-translation.spec.ts · choosing another translation changes the words on screen

### 2 test(s) — Error: tap-target audit — <viewport> / 05-navigation.spec.ts / open Acts 1 — 2 problem(s):

- walkthrough/05-navigation.spec.ts · the reader steps forward and back a chapter

### 2 test(s) — Error: tap-target audit — <viewport> / 05-navigation.spec.ts / open the reference picker from the chapter title — 5 problem(s):

- walkthrough/05-navigation.spec.ts · the reference picker reaches another book

### 2 test(s) — Error: tap-target audit — <viewport> / 06-verse-selection.spec.ts / open Acts 1 — 2 problem(s):

- walkthrough/06-verse-selection.spec.ts · tapping a verse opens its detail over the canvas

### 2 test(s) — Error: tap-target audit — <viewport> / 10-error-states.spec.ts / load the app, then cut the API off — 1 problem(s):

- walkthrough/10-error-states.spec.ts · an unreachable API produces an error state, not a blank screen

### 1 test(s) — TimeoutError: locator.click: Timeout 15000ms exceeded.

- shell.spec.ts · tapping a tab navigates without a reload

### 1 test(s) — Error: tap-target audit — <viewport> / 03-reader.spec.ts / open Acts 1 — 6 problem(s):

- walkthrough/03-reader.spec.ts · a chapter renders in full, in the scripture serif

### 1 test(s) — Error: tap-target audit — <viewport> / 03-reader.spec.ts / open Acts 1 and scroll to the last rendered verse — 6 problem(s):

- walkthrough/03-reader.spec.ts · the reader scrolls to the end of the chapter

### 1 test(s) — Error: tap-target audit — <viewport> / 04-translation.spec.ts / open the reader — 6 problem(s):

- walkthrough/04-translation.spec.ts · the switcher offers every open translation and no licensed one

### 1 test(s) — Error: tap-target audit — <viewport> / 04-translation.spec.ts / read verse 1 in the default translation — 6 problem(s):

- walkthrough/04-translation.spec.ts · choosing another translation changes the words on screen

### 1 test(s) — Error: tap-target audit — <viewport> / 05-navigation.spec.ts / open Acts 1 — 6 problem(s):

- walkthrough/05-navigation.spec.ts · the reader steps forward and back a chapter

### 1 test(s) — Error: the reference-picker control (testID "open-navigator") is not on screen, so it cannot be tapped

- walkthrough/05-navigation.spec.ts · the reference picker reaches another book

### 1 test(s) — Error: tap-target audit — <viewport> / 06-verse-selection.spec.ts / open Acts 1 — 6 problem(s):

- walkthrough/06-verse-selection.spec.ts · tapping a verse opens its detail over the canvas

### 1 test(s) — Error: tap-target audit — <viewport> / 08-responsive.spec.ts / open the reader at <viewport> width — 6 problem(s):

- walkthrough/08-responsive.spec.ts · the reader survives a live resize through every regime

### 1 test(s) — Error: tap-target audit — <viewport> / 08-responsive.spec.ts / below 600 dp there is no rail — 2 problem(s):

- walkthrough/08-responsive.spec.ts · the rail and the split pane appear only above their breakpoints

### 1 test(s) — TimeoutError: locator.boundingBox: Timeout 15000ms exceeded.

- walkthrough/08-responsive.spec.ts · the rail can be resized by dragging its handle

### 1 test(s) — Error: tap-target audit — <viewport> / 10-error-states.spec.ts / load the app, then cut the API off — 4 problem(s):

- walkthrough/10-error-states.spec.ts · an unreachable API produces an error state, not a blank screen

