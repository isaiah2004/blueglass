/**
 * ReferenceRow — a passage the reader can follow.
 *
 * Purpose
 *   Two of the three textual sheets end in a list of passages: the cross-references a verse
 *   points at, and the verse a word root was found in. Both rows do the same job — print a
 *   reference, print the scripture under it, and take the reader there — so both are this
 *   component. A reader following a thread through Acts should see the same row shape every
 *   time, whichever sheet they opened.
 *
 * Responsibilities
 *   - Owns: the row's layout, its typography, its pressed state and its hit area.
 *   - Does NOT own: where the tap goes. It calls back; the host decides whether the sheet
 *     dismisses first (a phone) or the canvas simply moves beside it (the context rail).
 *
 * Typography, deliberately mixed
 *   The reference is the gold tracked monospace §3 reserves for references; the verse under
 *   it is the scripture serif, because §8.4 has no exceptions — scripture set in the UI sans
 *   inside a sheet is still scripture.
 *
 * The tap target
 *   `size.tapTarget` is the floor, not the height: the row is as tall as its text and is
 *   padded up to 44 dp when the text is short, so a one-line reference is still reachable
 *   with a thumb.
 */

import type { JSX, ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  borderWidth,
  metadataText,
  radius,
  scriptureText,
  size,
  spacing,
  uiText,
  type Theme,
} from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link ReferenceRow}. */
export interface ReferenceRowProps {
  /** The passage, e.g. `Acts 2:38-39`. */
  readonly reference: string;
  /** The scripture itself, when the payload carries it. */
  readonly text?: string | undefined;
  /** A short qualifier under the text, e.g. that only the first verse is shown. */
  readonly note?: string | undefined;
  /** Anything on the right of the reference — a vote count, a strength bar. */
  readonly trailing?: ReactNode | undefined;
  /** Open this passage in the reader. Absent makes the row static rather than dead. */
  readonly onPress?: (() => void) | undefined;
  /** What a screen reader announces. Defaults to "Open {reference}". */
  readonly accessibilityLabel?: string | undefined;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * One passage in a list.
 *
 * @param props - See {@link ReferenceRowProps}.
 * @returns The row: pressable when `onPress` is given, a plain block when it is not.
 *
 * Side effects: none beyond `onPress`.
 */
export function ReferenceRow({
  reference,
  text,
  note,
  trailing,
  onPress,
  accessibilityLabel,
  testID,
}: ReferenceRowProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);

  const body = (
    <>
      <View style={styles.header}>
        <Text style={styles.reference}>{reference}</Text>
        {trailing}
      </View>
      {text === undefined ? null : <Text style={styles.text}>{text}</Text>}
      {note === undefined ? null : <Text style={styles.note}>{note}</Text>}
    </>
  );

  if (onPress === undefined) {
    return (
      <View style={styles.row} testID={testID}>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? `Open ${reference}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, styles.pressableRow, pressed ? styles.pressed : null]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  row: { gap: spacing.xs, minHeight: size.tapTarget, justifyContent: 'center' },
  pressableRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: radius.control,
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
  },
  // A press changes the surface, not the size: a row that grows on touch drags the rows
  // below it, which reads as the list jumping under the finger.
  pressed: { backgroundColor: theme.background.cardHover, borderColor: theme.line.strong },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reference: { ...metadataText('md', 'bold'), color: theme.accent.gold, flexShrink: 1 },
  text: { ...scriptureText('sm'), color: theme.ink.primary },
  note: { ...uiText('sm'), color: theme.ink.secondary },
}));
