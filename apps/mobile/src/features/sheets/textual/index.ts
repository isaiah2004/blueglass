/**
 * Public API of the textual badge sheets.
 *
 * Purpose
 *   `[Root]`, `[History]` and `[Cross-Ref]` — the three badges about the words on the page
 *   and where they came from. The reader host imports from here and nothing deeper (rule
 *   5.3.3), so the internal split into `chrome/`, `model/` and one folder per badge can
 *   change without touching a caller.
 *
 * What a host needs, and all it needs
 *   ```tsx
 *   import { TextualSheet, isTextualBadgeKind, textualSheetTitle } from '@/features/sheets/textual';
 *
 *   // Phone: over the bottom half of the screen.
 *   <ReaderSheet visible title={textualSheetTitle(badge)} onClose={close}>
 *     <TextualSheet badge={badge} verseText={verse.text} onOpenVerse={openVerse} />
 *   </ReaderSheet>
 *
 *   // Tablet and desktop: in the context rail, beside the scripture.
 *   <RailPanel eyebrow="Context" title={textualSheetTitle(badge)}>
 *     <TextualSheet badge={badge} verseText={verse.text} onOpenVerse={openVerse} />
 *   </RailPanel>
 *   ```
 *   `TextualSheet` is a body: no modal, no scroll view, no close button. Both homes already
 *   provide those, and a second scroll view nested in either measures zero height.
 *
 * The decoding boundary
 *   These components take resolved `VerseKey` values, which is what `@atlas/shared`'s badge
 *   envelope declares. The wire sends packed integers; `decodeVerseKey` and
 *   `decodeVerseRange` are exported for a host that has not converted them yet.
 *
 * Dependencies
 *   `@atlas/shared`, `@/theme`, `@/components/surface`, `zustand`. No navigation, no
 *   queries: this folder renders what it is given and calls back when the reader taps.
 */

export { TextualSheet } from './TextualSheet';
export type { TextualSheetProps } from './TextualSheet';

export { RootSheet } from './root/RootSheet';
export type { RootSheetProps } from './root/RootSheet';
export { HistorySheet } from './history/HistorySheet';
export type { HistorySheetProps } from './history/HistorySheet';
export { CrossRefSheet } from './crossref/CrossRefSheet';
export type { CrossRefSheetProps } from './crossref/CrossRefSheet';

export { isTextualBadgeKind, textualSheetTitle } from './model/sheet-title';

export type { SheetChrome } from './model/sheet-chrome';

export type {
  CrossRefSheetBadge,
  HistorySheetBadge,
  HistorySheetPayload,
  RootSheetBadge,
  RootSheetPayload,
  TextualBadge,
  TextualBadgeKind,
} from './model/textual-payloads';

export {
  decodeVerseKey,
  decodeVerseRange,
  passageLabel,
  rangeTarget,
  verseLabel,
  verseTarget,
} from './model/verse-target';
export type { VerseTarget } from './model/verse-target';

// `AI-05`'s gate, exported so a host can decide not to draw the inline pill at all when a
// badge arrives unattributed — cheaper than opening a sheet that refuses to show anything.
export { hasProvenance, provenanceSummary } from './model/provenance';

// The flashcard seam. Saving is session-only until the Studio milestone; see the store's
// header for what it deliberately does not do.
export { SAVE_CONFIRMATION, selectSavedCount, useFlashcardDrafts } from './root/flashcard-store';
export type { FlashcardDraft } from './root/flashcard-store';
