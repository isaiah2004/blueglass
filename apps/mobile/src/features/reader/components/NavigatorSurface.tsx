/**
 * The book navigator's home: a sheet the reader opens from the reference.
 *
 * Purpose
 *   Step one of "where do I want to be" (`flutter-port-map.md` §7.6). The picker is reached
 *   by tapping the reference the reader is already looking at, which is the shortest route
 *   to another passage and keeps a permanent navigation control off a surface that should
 *   be as quiet as possible (pillar 1).
 *
 * Why the navigator is not also a pinned rail
 *   It was, above 1100 dp, and it cost the reader the thing that actually earns permanent
 *   space beside scripture. A 1280 dp window minus a 232 dp sidebar leaves 1048 dp: a
 *   340 dp book list *and* a 320 dp context rail *and* a 460 dp reading column do not fit,
 *   so one of them had to go. `Q-006` asks for parity with the prototype's layouts, and
 *   `app_shell.dart:386-391`'s trailing rail is the context panel, not the picker —
 *   pillar 2's surface, wanted on every screenful, against a picker used once a session.
 *   Recorded in `docs/decisions/ASSUMPTIONS.md`.
 *
 * Dependencies
 *   `BookNavigator` and `ReaderSheet`. No breakpoints: there is one surface now.
 */

import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CanonicalBook } from '@atlas/shared';

import { BookNavigator } from './BookNavigator';
import { ReaderSheet } from './ReaderSheet';

/** What the navigator surface needs. */
export interface NavigatorSurfaceProps {
  readonly currentBookNumber: number;
  readonly currentChapter: number;
  readonly onSelect: (book: CanonicalBook, chapter: number) => void;
}

/** The sheet form, at every width. */
export interface NavigatorSheetProps extends NavigatorSurfaceProps {
  readonly visible: boolean;
  readonly onClose: () => void;
}

/** How tall the navigator is inside a sheet, so its own list scrolls rather than the sheet. */
const SHEET_BODY_HEIGHT = 420;

/**
 * Render the navigator as a bottom sheet.
 *
 * @param props - See {@link NavigatorSheetProps}.
 * @returns The sheet. Side effects: none beyond its callbacks.
 */
export function NavigatorSheet({ visible, onClose, ...surface }: NavigatorSheetProps): JSX.Element {
  return (
    <ReaderSheet visible={visible} title="Go to" onClose={onClose} testID="navigator-sheet">
      <View style={styles.sheetBody}>
        <BookNavigator
          {...surface}
          onSelect={(book, chapter) => {
            surface.onSelect(book, chapter);
            onClose();
          }}
        />
      </View>
    </ReaderSheet>
  );
}

const styles = StyleSheet.create({
  sheetBody: { height: SHEET_BODY_HEIGHT },
});
