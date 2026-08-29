/**
 * The chrome above the scripture.
 *
 * Purpose
 *   Pillar 1 says nothing floats over scripture, so every control the reader needs while
 *   reading is gathered into one bar that sits *above* the canvas and scrolls nothing. It
 *   carries the reference (which opens the navigator), search, the translation pill, the
 *   display button, and — where no nav rail exists to carry them — the shell's theme toggle
 *   and settings link.
 *
 * Why the reference is always a button
 *   Tapping where you are to choose where to go is the shortest possible route to another
 *   passage. It used to become inert text above 1100 dp, on the reasoning that a pinned
 *   navigator rail made it redundant; the rail is gone (`NavigatorSurface`) and the
 *   reasoning went with it. A desktop reader was left with `open-navigator` on no surface
 *   at all.
 *
 * Why the shell controls are here
 *   The reading canvas is a whole screen, and a whole screen must offer a way to change the
 *   theme (`D-01`) and reach Settings. Above 600 dp the nav rail's footer already does, and
 *   `shell-chrome.tsx` is where the two halves agree so exactly one of each is ever mounted.
 *
 * Dependencies
 *   The reader's theme hook, `ReaderButton`, `ShellControls`, and the typography, spacing
 *   and border tokens.
 */

import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import { ShellControls } from '@/components/nav/ShellControls';
import { useChromeHasThemeToggle } from '@/components/nav/shell-chrome';
import { borderWidth, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { ReaderButton } from './ReaderButton';

/** What the header needs. */
export interface ReaderHeaderProps {
  /** Human reference, e.g. `John 3`. */
  readonly reference: string;
  readonly translationCode: string;
  readonly reduceMotion: boolean;
  readonly onOpenNavigator: () => void;
  readonly onOpenTranslations: () => void;
  readonly onOpenDisplay: () => void;
  readonly onOpenSearch: () => void;
}

/**
 * The display button's label.
 *
 * The typographer's `Aa` rather than a gear or a sun: this control changes how the text is
 * *set*, and `Q-021` has not yet chosen an icon family, so a wrong glyph would read worse
 * than none.
 */
const DISPLAY_LABEL = 'Aa';

/** The search button's label, for the same reason. */
const SEARCH_LABEL = 'Find';

/**
 * Render the reader's control bar.
 *
 * @param props - See {@link ReaderHeaderProps}.
 * @returns The header. Side effects: none beyond its callbacks.
 */
export function ReaderHeader(props: ReaderHeaderProps): JSX.Element {
  const { reference, reduceMotion, onOpenNavigator } = props;
  const theme = useTheme();

  return (
    <View
      testID="reader-header"
      style={[
        styles.bar,
        { backgroundColor: theme.background.elevated, borderBottomColor: theme.line.hairline },
      ]}
    >
      <View style={styles.reference}>
        <ReaderButton
          emphasis="ghost"
          label={reference}
          onPress={onOpenNavigator}
          reduceMotion={reduceMotion}
          testID="open-navigator"
          accessibilityLabel={`${reference}. Choose a book or chapter`}
        />
      </View>

      <HeaderActions {...props} />
    </View>
  );
}

/**
 * The controls on the right of the bar.
 *
 * All the same quiet pill, because none is more important than the others and none should
 * compete with the scripture below.
 *
 * @param props - See {@link ReaderHeaderProps}; the reference is not used here.
 * @returns The action group. Side effects: none beyond its callbacks.
 */
function HeaderActions({
  translationCode,
  reduceMotion,
  onOpenTranslations,
  onOpenDisplay,
  onOpenSearch,
}: ReaderHeaderProps): JSX.Element {
  const chromeHasControls = useChromeHasThemeToggle();

  return (
    <View style={styles.actions}>
      <ReaderButton
        label={SEARCH_LABEL}
        onPress={onOpenSearch}
        reduceMotion={reduceMotion}
        testID="search-open"
        accessibilityLabel="Search scripture"
      />
      <ReaderButton
        label={translationCode}
        onPress={onOpenTranslations}
        reduceMotion={reduceMotion}
        testID="open-translations"
        accessibilityLabel={`Translation ${translationCode}. Change translation`}
      />
      <ReaderButton
        label={DISPLAY_LABEL}
        onPress={onOpenDisplay}
        reduceMotion={reduceMotion}
        testID="open-display"
        accessibilityLabel="Display settings"
      />
      {chromeHasControls ? null : <ShellControls />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: borderWidth.hairline,
  },
  reference: { flexShrink: 1, minWidth: 0 },
  actions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
});
