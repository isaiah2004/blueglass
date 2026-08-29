/**
 * Public API of the reading canvas.
 *
 * Purpose
 *   One import path for everything outside `features/reader/` that needs the reader: the
 *   two routes under `app/read/`, and — later — the Bible tab that will open at the
 *   reader's last position. Nothing else may reach into this folder (rule 5.3.3), which is
 *   what keeps the reader's internals free to move.
 *
 * What is deliberately not exported
 *   Every component below `ReaderScreen`, the API layer, and the settings store. They are
 *   implementation, and a route that reached for `VerseRow` or `fetchChapter` directly
 *   would be building a second reader.
 */

export { ReaderScreen } from './components/ReaderScreen';
export type { ReaderScreenProps } from './components/ReaderScreen';

export {
  nextChapter,
  previousChapter,
  readerPath,
  readerReference,
  resolveReaderAddress,
} from './model/reader-address';
export type { ReaderAddress, ReaderAddressError } from './model/reader-address';

export { badAddressCopy, readerStatusCopy } from './model/reader-status';
export type { ReaderMessageTone, ReaderStatusCopy } from './model/reader-status';

export { ReaderMessage } from './components/ReaderMessage';
