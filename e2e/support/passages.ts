/**
 * The passages the walkthrough drives, and why each one is in the list.
 *
 * Purpose
 *   Chapters 1-15 drive **two chapters of one book** — Acts 16 and Acts 1, with John 3 and
 *   Leviticus 13 touched once each. That is a walkthrough of Acts, not of a Bible. Every
 *   line of the reader outside those two chapters — Hebrew-era book names, a 176-verse
 *   scroll, a book with no chapter 2, the first and last books of the canon, the three
 *   translations nobody reads in a test — ships unexercised.
 *
 *   This table is the answer to "which passages, and why". Each entry names the code path
 *   it exists to stress. A passage that stresses nothing new does not belong here: a
 *   walkthrough that drives sixty chapters the same way is not more coverage, it is a
 *   longer run.
 *
 * The counts are measured, not assumed
 *   `verseCount` and `badgeCount` were read from the live API on 2026-08-29 and are
 *   re-checked against it by chapter 16 before any chapter concludes anything from them.
 *   A hard-coded number that silently drifts is worse than no number, because it turns a
 *   data regression into a green run.
 *
 * Dependencies
 *   None. Pure data, so a chapter can import one passage without importing a page.
 */

/** Everything a chapter needs to drive one passage and to say why it is driving it. */
export interface WalkthroughPassage {
  /** The book slug as `@atlas/shared` spells it in a route, e.g. `psalms`. */
  readonly book: string;
  /** The chapter number. */
  readonly chapter: number;
  /** The human reference the API answers with, e.g. `Psalms 119`. */
  readonly reference: string;
  /** How many verses the API holds for it in every shipped translation. */
  readonly verseCount: number;
  /** How many badges the API selects for it in the default translation. */
  readonly badgeCount: number;
  /** The code path this passage exists to stress. Quoted in failure messages. */
  readonly stresses: string;
}

/**
 * The route for a passage.
 *
 * @param passage Which passage.
 * @returns The reader route, e.g. `/read/psalms/119`.
 */
export function passagePath(passage: WalkthroughPassage): string {
  return `/read/${passage.book}/${String(passage.chapter)}`;
}

/**
 * Genesis 1 — the most-read chapter in the canon.
 *
 * There is no chapter where a regression is seen by more people, and it is the first
 * chapter of the first book, so it is also the only place `previousChapter` returns
 * `undefined`. Four cross-ref badges, no route, no root: the common case for the Old
 * Testament, which is 39 of the 66 books and none of the existing walkthrough.
 */
export const GENESIS_1: WalkthroughPassage = {
  book: 'genesis',
  chapter: 1,
  reference: 'Genesis 1',
  verseCount: 31,
  badgeCount: 4,
  stresses: 'the canon head: no previous chapter, and the chapter most readers open first',
};

/**
 * Psalm 119 — the longest chapter in the Bible, at 176 verses.
 *
 * Six times Acts 1 and nearly three times Leviticus 13. It is where a reader that renders
 * every verse eagerly, or one that windows them and forgets to restore the window, shows
 * the difference. It is also poetry, so the line rhythm the badge system must not disturb
 * is at its most visible. The WEB translation prints the Hebrew acrostic letters (`ALEPH`)
 * inside the verse text, which no other passage in this table does.
 */
export const PSALM_119: WalkthroughPassage = {
  book: 'psalms',
  chapter: 119,
  reference: 'Psalms 119',
  verseCount: 176,
  badgeCount: 4,
  stresses: 'the longest chapter in the canon: 176 verses of poetry, and a long scroll',
};

/**
 * Psalm 117 — the shortest chapter in the Bible, at 2 verses.
 *
 * The opposite end of the same axis. A chapter footer, an attribution line and a chapter
 * pager laid out under two verses is the case where fixed chrome has nothing to push
 * against, and where a canvas with a minimum height leaves a gap the size of a screen.
 */
export const PSALM_117: WalkthroughPassage = {
  book: 'psalms',
  chapter: 117,
  reference: 'Psalms 117',
  verseCount: 2,
  badgeCount: 2,
  stresses: 'the shortest chapter in the canon: chrome with almost no content under it',
};

/**
 * Leviticus 13 — measured to carry no badges at all.
 *
 * The state most of the canon is in, and the one the empty path must handle gracefully.
 * Already used by chapter 11; named here so the table is the single list of what the
 * walkthrough drives rather than half a list.
 */
export const LEVITICUS_13: WalkthroughPassage = {
  book: 'leviticus',
  chapter: 13,
  reference: 'Leviticus 13',
  verseCount: 59,
  badgeCount: 0,
  stresses: 'no enrichment at all: the empty state must read as scripture, not as an absence',
};

/**
 * Obadiah 1 — a single-chapter book in the Old Testament.
 *
 * `previousChapter` must roll back into Amos 9 and `nextChapter` forward into Jonah 1,
 * because there is no Obadiah 2 to step to. A pager that assumes a book has more than one
 * chapter dead-ends here, and there are five such books in the canon.
 */
export const OBADIAH_1: WalkthroughPassage = {
  book: 'obadiah',
  chapter: 1,
  reference: 'Obadiah 1',
  verseCount: 21,
  badgeCount: 6,
  stresses: 'a one-chapter Old Testament book: both chapter boundaries at once',
};

/**
 * Jude 1 — a single-chapter book in the New Testament, with badges.
 *
 * Obadiah's counterpart on the enriched side of the corpus: eleven badges over ten verses,
 * so the boundary case and the loaded case coincide. Its neighbours are 3 John 1 and
 * Revelation 1, both themselves single-chapter or first chapters.
 */
export const JUDE_1: WalkthroughPassage = {
  book: 'jude',
  chapter: 1,
  reference: 'Jude 1',
  verseCount: 25,
  badgeCount: 11,
  stresses: 'a one-chapter New Testament book, enriched: boundary and load together',
};

/**
 * Revelation 22 — the last chapter of the last book.
 *
 * The only chapter where `nextChapter` returns `undefined`. A pager that clamps rather than
 * hides offers a Next control that goes nowhere; one that wraps sends the reader to
 * Genesis 1 without saying so.
 */
export const REVELATION_22: WalkthroughPassage = {
  book: 'revelation',
  chapter: 22,
  reference: 'Revelation 22',
  verseCount: 21,
  badgeCount: 8,
  stresses: 'the canon tail: no next chapter',
};

/**
 * John 3 — a chapter at the badge selection cap.
 *
 * Twelve badges is `MAX_BADGES_PER_CHAPTER` exactly, over ten verses, with two verses
 * carrying `MAX_BADGES_PER_VERSE`. It is the densest reading the selection rules permit,
 * which makes it the only place the per-verse cap and the reading rhythm under load can be
 * observed rather than reasoned about. Acts 16 is equally dense and already driven; John 3
 * is chosen so the assertion is not made against the one chapter the whole milestone was
 * tuned on.
 */
export const JOHN_3: WalkthroughPassage = {
  book: 'john',
  chapter: 3,
  reference: 'John 3',
  verseCount: 36,
  badgeCount: 12,
  stresses: 'the badge selection cap: 12 in the chapter, 2 on a verse',
};

/**
 * Ruth 1 — an Old Testament narrative with a route badge.
 *
 * The only Old Testament passage in this table that produces a spatial badge, so it is
 * where an Old Testament reader can reach a map at all. Places in the Hebrew Bible resolve
 * through the same gazetteer as the Acts itinerary but by a different path.
 */
export const RUTH_1: WalkthroughPassage = {
  book: 'ruth',
  chapter: 1,
  reference: 'Ruth 1',
  verseCount: 22,
  badgeCount: 5,
  stresses: 'an Old Testament passage that reaches a map',
};

/**
 * Every passage the widened walkthrough drives, in canon order.
 *
 * Chapter 16 re-measures this whole table against the live API in one test, so a data
 * regression anywhere in the canon is one failure with a name rather than nine chapters
 * failing for reasons that look unrelated.
 */
export const WALKTHROUGH_PASSAGES: readonly WalkthroughPassage[] = [
  GENESIS_1,
  LEVITICUS_13,
  RUTH_1,
  PSALM_117,
  PSALM_119,
  OBADIAH_1,
  JOHN_3,
  JUDE_1,
  REVELATION_22,
] as const;

/**
 * The four public-domain translations, in the order the switcher lists them.
 *
 * Duplicated from `journeys.ts` deliberately narrowly: this is the list a chapter iterates
 * to prove every translation renders, and importing the whole M1 journeys module for one
 * array would drag the reader helpers into a data file.
 */
export const ALL_TRANSLATIONS: readonly string[] = ['BSB', 'KJV', 'WEB', 'ASV'];
