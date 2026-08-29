/**
 * The reader's modal surfaces, in one place.
 *
 * Purpose
 *   Navigator, translation switcher and display settings are the only things allowed to
 *   cover scripture (pillar 1: "except a sheet the reader deliberately opened"). Grouping
 *   them makes that list explicit and enforces the rule they share: exactly one is open at
 *   a time, because `OpenSheet` is a single value rather than three booleans.
 *
 * Why the verse detail is not one of them
 *   It is not opened from the header, it is not modal, and it does not cover the canvas:
 *   it is `VerseDock` below 600 dp and `ContextPanel` above, both mounted by
 *   `ReaderScreen` and both driven by the selection rather than by a sheet flag.
 *
 * Why it reads the store and the query itself
 *   Every control it renders writes to the preferences store, and the translation list is
 *   already cached by the query it shares with the header — asking for it here costs a map
 *   lookup, not a request. Threading six props through the screen would add indirection and
 *   nothing else.
 *
 * Dependencies
 *   `@/api`, `@/stores`, and the three sheet components.
 */

import type { JSX } from 'react';

import type { CanonicalBook } from '@atlas/shared';
import { useTranslationsQuery } from '@/api';
import { selectScriptureSize, selectTranslationCode, usePrefs } from '@/stores';
import type { ScriptureStep } from '@/theme';

import { DisplaySheet } from './DisplaySheet';
import { NavigatorSheet } from './NavigatorSurface';
import { TranslationSheet } from './TranslationSheet';

/** Which sheet is open. `none` is a value, so "closed" is never `undefined`. */
export type OpenSheet = 'none' | 'navigator' | 'translations' | 'display';

/** What the sheet stack needs. */
export interface ReaderSheetsProps {
  readonly open: OpenSheet;
  readonly onClose: () => void;
  readonly currentBookNumber: number;
  readonly currentChapter: number;
  readonly onNavigate: (book: CanonicalBook, chapter: number) => void;
  /** The step the reading-size choice currently resolves to, for the live preview. */
  readonly resolvedStep: ScriptureStep;
}

/**
 * The preference reads and writes the sheets need.
 *
 * Split out so `ReaderSheets` itself stays a description of three surfaces rather than a
 * list of store selectors.
 *
 * @returns The two values and the two setters. Side effects: subscribes to the store.
 */
function usePreferenceControls(): {
  readonly translationCode: string;
  readonly readingSize: ReturnType<typeof selectScriptureSize>;
  readonly setTranslationCode: (code: string) => void;
  readonly setScriptureSize: (size: ReturnType<typeof selectScriptureSize>) => void;
} {
  // Zustand actions are closures created in the store factory, never `this`-bound, so
  // selecting one is safe. The rule cannot see that from the interface's method syntax.
  /* eslint-disable @typescript-eslint/unbound-method */
  const setTranslationCode = usePrefs((state) => state.setTranslationCode);
  const setScriptureSize = usePrefs((state) => state.setScriptureSize);
  /* eslint-enable @typescript-eslint/unbound-method */

  return {
    translationCode: usePrefs(selectTranslationCode),
    readingSize: usePrefs(selectScriptureSize),
    setTranslationCode,
    setScriptureSize,
  };
}

/**
 * Render the three sheets.
 *
 * @param props - See {@link ReaderSheetsProps}.
 * @returns All three, of which at most one is visible.
 *
 * Side effects: none beyond its callbacks and the preferences it writes.
 */
export function ReaderSheets({
  open,
  onClose,
  currentBookNumber,
  currentChapter,
  onNavigate,
  resolvedStep,
}: ReaderSheetsProps): JSX.Element {
  const prefs = usePreferenceControls();
  const translations = useTranslationsQuery();

  return (
    <>
      <NavigatorSheet
        visible={open === 'navigator'}
        currentBookNumber={currentBookNumber}
        currentChapter={currentChapter}
        onSelect={onNavigate}
        onClose={onClose}
      />

      <TranslationSheet
        visible={open === 'translations'}
        translations={translations.data}
        loading={translations.isPending}
        failed={translations.isError}
        selectedCode={prefs.translationCode}
        onClose={onClose}
        onSelect={(code) => {
          prefs.setTranslationCode(code);
          onClose();
        }}
      />

      <DisplaySheet
        visible={open === 'display'}
        readingSize={prefs.readingSize}
        onSelectReadingSize={prefs.setScriptureSize}
        resolvedStep={resolvedStep}
        onClose={onClose}
      />
    </>
  );
}
