/**
 * CaveatNote — where a sheet says what it does not know.
 *
 * Purpose
 *   Three decisions oblige these sheets to qualify what they show, out loud, in the same
 *   place as the claim:
 *     - `Q-015` — Murai's literary structure ships attributed as "Murai's reading", never
 *       as settled fact.
 *     - `Q-016` — dating is New Testament-era only; a passage with no sourced date says so
 *       rather than inheriting Ussher's 4004 BC.
 *     - The cross-reference sheet carries the text of a span's FIRST verse only.
 *   A caveat set in the same grey as the body copy is a caveat nobody reads, so it gets a
 *   tinted, bordered block of its own.
 *
 * Responsibilities
 *   - Owns: how a qualification looks, and that it is announced to a screen reader as a
 *     note rather than as body text.
 *   - Does NOT own: the wording. Each sheet supplies its own, because the wording *is* the
 *     honesty and hiding it behind a prop default would let it be silently dropped.
 *
 * Why `note` and not a warning colour
 *   `state.danger` means something is wrong. Nothing is wrong when scholarship is
 *   attributed properly; it is the normal, correct state of an honest sheet.
 */

import type { JSX } from 'react';
import { Text, View } from 'react-native';

import { borderWidth, metadataText, radius, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

/** Inputs to {@link CaveatNote}. */
export interface CaveatNoteProps {
  /** The short uppercase label, e.g. `MURAI'S READING`. */
  readonly label: string;
  /** The qualification itself, in full sentences. */
  readonly body: string;
  /** The hue the label and border take. Defaults to the theme's cyan. */
  readonly tint?: string | undefined;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/**
 * One qualification, set apart from the claim it qualifies.
 *
 * @param props - See {@link CaveatNoteProps}.
 * @returns The note.
 *
 * Side effects: none.
 */
export function CaveatNote({ label, body, tint, testID }: CaveatNoteProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const hue = tint ?? theme.accent.cyan;

  return (
    <View
      style={[styles.note, { borderColor: hue }]}
      testID={testID}
      role="note"
      accessibilityLabel={`${label}. ${body}`}
    >
      <Text style={[styles.label, { color: hue }]}>{label}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  note: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.control,
    borderWidth: borderWidth.hairline,
    // The fill is the surface below it, not a tinted wash: `D-05` asks for no excessive
    // glass, and a coloured panel behind body copy costs contrast in the light theme.
    backgroundColor: theme.background.card,
  },
  label: metadataText('sm', 'bold'),
  body: { ...uiText('sm'), color: theme.ink.secondary },
}));
