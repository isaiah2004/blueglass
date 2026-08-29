# Walkthrough run

- Finished: 2026-08-29T02:54:59.116Z
- Playwright exit code: 1
- Tests: 108 — 92 passed, 10 failed, 6 skipped
- Screenshots: 173

## Failures, grouped by cause

### 3 test(s) — Error: BSB is missing from the switcher, though the seeded catalogue ships it

- walkthrough/04-translation.spec.ts · the switcher offers every open translation and no licensed one

### 3 test(s) — Error: the KJV option (testID "translation-KJV") is not on screen, so it cannot be tapped

- walkthrough/04-translation.spec.ts · choosing another translation changes the words on screen

### 3 test(s) — Error: browser Back did not return to the previous chapter

- walkthrough/05-navigation.spec.ts · the reference picker reaches another book

### 1 test(s) — TimeoutError: locator.click: Timeout 15000ms exceeded.

- walkthrough/06-verse-selection.spec.ts · selecting a second verse updates the detail

