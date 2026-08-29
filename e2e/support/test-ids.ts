/**
 * The test-id contract between the app and the walkthrough harness.
 *
 * Purpose
 *   Playwright can only address what the app names. This module is the single agreed
 *   vocabulary: the feature screens put these strings in `testID`, the harness looks them
 *   up, and neither side has to read the other's source.
 *
 * How to read it
 *   React Native Web renders `testID="reader-screen"` as `data-testid="reader-screen"`,
 *   which is exactly what Playwright's `getByTestId` queries. The same prop works on the
 *   Android build, so nothing here is web-only.
 *
 * Who names things
 *   **The app does.** Where a screen already ships an id, this file records that id rather
 *   than asking for a rename; a harness is not worth three agents renaming forty props.
 *   Every id below is now carried by a real component — the surfaces that were once marked
 *   **OWED** (the context rail, the verse detail, scripture search) have been built, and
 *   the notes on each say where.
 *
 * Dependencies
 *   None. Pure data.
 */

/** Shell chrome — `components/nav/AdaptiveTabBar.tsx`, the theme switch, the rail footer. */
export const SHELL_IDS = {
  /** The bottom tab bar (phone) or the nav rail (>= 600 dp). */
  tabBar: 'tab-bar',
  /** The theme switch. `D-01`: light mode ships, so this is a real control, not a stub. */
  themeToggle: 'theme-toggle',
  /** The settings entry in the nav rail's footer. */
  settings: 'nav-settings',
} as const;

/** One id per tab, in `(tabs)/_layout.tsx` order. */
export const TAB_IDS = {
  home: 'tab-home',
  bible: 'tab-bible',
  discover: 'tab-discover',
  studio: 'tab-studio',
  journal: 'tab-journal',
} as const;

/** The root view of each destination, used to prove a tap reached the right screen. */
export const SCREEN_IDS = {
  home: 'home-screen',
  bible: 'bible-screen',
  discover: 'discover-screen',
  studio: 'studio-screen',
  journal: 'journal-screen',
  notFound: 'not-found-screen',
  settings: 'settings-screen',
} as const;

/** The reading canvas — `apps/mobile/src/features/reader/components/`. */
export const READER_IDS = {
  /** The reader route's root view. */
  screen: 'reader-screen',
  /** The chrome above the canvas: navigator, translation and display controls. */
  header: 'reader-header',
  /** The scrolling canvas of verses. */
  canvas: 'chapter-canvas',
  /** The chapter heading, e.g. "Acts 1". */
  chapterTitle: 'chapter-title',
  /** Previous / next chapter controls, in the chapter footer. */
  previousChapter: 'chapter-previous',
  nextChapter: 'chapter-next',
  /** The translation attribution line at the foot of the chapter. */
  attribution: 'chapter-attribution',
  /**
   * The context rail, expected at >= 600 dp (`Q-006`, port-map risk #5).
   * Built: `ReaderScreen` passes it to `components/split/ContextRailShell.tsx`.
   */
  contextRail: 'reader-context-rail',
  /** The draggable divider that resizes the rail. Only exists in the resizable regime. */
  railHandle: 'reader-rail-handle',
  /** The two-pane split, expected only at >= 1100 dp. */
  splitPane: 'reader-split-pane',
} as const;

/**
 * The id of one rendered verse.
 *
 * @param verse The verse number within the chapter.
 * @returns The test id `VerseRow` sets on that verse.
 */
export function verseId(verse: number): string {
  return `verse-row-${String(verse)}`;
}

/** The translation switcher — `S-01`, multiple open translations with a switcher. */
export const TRANSLATION_IDS = {
  /** The header control showing the active translation code; opens the sheet. */
  switcher: 'open-translations',
  /** The open sheet of available translations. */
  menu: 'translation-sheet',
} as const;

/**
 * The id of one translation option inside the switcher sheet.
 *
 * `translation-option-${code}` is what `TranslationSheet` renders and what its component
 * test already asserts. This returned `translation-${code}`, so chapter 4 reported every
 * shipped translation as missing from a switcher that was listing all four of them — the
 * harness was wrong, not the app (see the header: the app names things).
 *
 * @param code The translation code as the catalogue spells it, e.g. `BSB`.
 * @returns The test id that option carries.
 */
export function translationOptionId(code: string): string {
  return `translation-option-${code}`;
}

/** The two-step reference picker — book grid, then chapter grid. */
export const PICKER_IDS = {
  /** The control that opens it, in the reader header. */
  open: 'open-navigator',
  /** The picker as a sheet. This is its only home at every width. */
  sheet: 'navigator-sheet',
  /**
   * The picker as a pinned rail.
   *
   * **Nothing renders this any more.** There is room beside the scripture for exactly one
   * pinned rail at desktop width, and it went to the context panel (`Q-024`,
   * `docs/decisions/ASSUMPTIONS.md`). Kept so chapter 5 keeps matching either surface, and
   * so the id is already agreed if the decision is reversed.
   */
  rail: 'navigator-rail',
  /** The book grid inside either surface. */
  bookGrid: 'book-navigator',
  /** The chapter grid, shown once a book is chosen. */
  chapterGrid: 'chapter-grid',
} as const;

/**
 * The id of one book tile in the reference picker.
 *
 * The app names things and this file records the names (see the header). `BookRow` renders
 * `book-row-${id}` and always has; this function returned `book-${id}`, so chapter 5's tap
 * on John could never resolve. The harness was wrong, not the app.
 *
 * @param bookId The book's slug id from `@atlas/shared`, e.g. `acts`.
 * @returns The tile's test id.
 */
export function bookTileId(bookId: string): string {
  return `book-row-${bookId}`;
}

/**
 * The id of one chapter tile in the reference picker.
 *
 * @param chapter The chapter number.
 * @returns The tile's test id.
 */
export function chapterTileId(chapter: number): string {
  return `chapter-tile-${String(chapter)}`;
}

/**
 * The verse detail surface: a sheet on phone, a rail panel above 600 dp.
 *
 * Built. `VerseDetail` is the body and carries all three ids; `VerseSheet` is its phone
 * home and `ContextPanel` its rail home, so the two surfaces cannot say different things.
 */
export const VERSE_SHEET_IDS = {
  root: 'verse-sheet',
  /** The reference the sheet claims to be showing, e.g. "Acts 1:8". */
  reference: 'verse-sheet-reference',
  close: 'verse-sheet-close',
} as const;

/**
 * Full-text scripture search, which floats over the reader rather than replacing it.
 *
 * Built: `features/reader/components/SearchOverlay.tsx`. Not to be confused with
 * `book-search`, which filters the book list inside the navigator.
 */
export const SEARCH_IDS = {
  open: 'search-open',
  root: 'search-overlay',
  input: 'search-input',
  results: 'search-results',
  empty: 'search-empty',
  close: 'search-close',
} as const;

/**
 * The id of one search result row.
 *
 * @param index Zero-based position in the result list.
 * @returns The row's test id.
 */
export function searchResultId(index: number): string {
  return `search-result-${String(index)}`;
}

/**
 * The honest failure surface.
 *
 * `ReaderMessage` renders `reader-{tone}`, so the id depends on which failure it is:
 * `reader-offline` for an unreachable API, `reader-error` for a server failure,
 * `reader-notFound` for an address that does not exist. The harness matches any of them,
 * because which one is right is the app's judgement, not the harness's.
 */
export const ERROR_IDS = {
  tones: ['reader-offline', 'reader-error', 'reader-notFound', 'reader-bad-address'],
  /** The single action the message offers — retry, or "choose another passage". */
  action: 'reader-message-action',
} as const;

/** The reading canvas's loading state. Used to wait loading out, never to assert on. */
export const LOADING_ID = 'chapter-skeleton';

/** A CSS selector matching any of the reader's failure surfaces. */
export const ERROR_SELECTOR = ERROR_IDS.tones.map((tone) => `[data-testid="${tone}"]`).join(', ');
