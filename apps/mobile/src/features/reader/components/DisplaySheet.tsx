/**
 * Display settings: theme and reading size.
 *
 * Purpose
 *   Decision `D-01` requires light mode to actually ship, which means a reader has to be
 *   able to reach it while reading. This sheet is that door, and it is also where the
 *   19-21 pt reading range `design-language.md` §3 fixes becomes a choice rather than a
 *   constant.
 *
 * Built on the design system, not beside it
 *   The theme control IS `@/components/controls/ThemeSwitcher` — the same three-position
 *   control the rest of the app uses, writing to the same persisted preference. The reading
 *   size uses the same `SegmentedControl` underneath it. Nothing about appearance is
 *   re-implemented here.
 *
 * The preview line
 *   A line of real scripture is rendered at the chosen size, in the theme in force, so the
 *   choice is made by looking rather than by guessing. It is the same serif at the same
 *   line height the canvas uses, which is what makes the preview honest.
 *
 * Dependencies
 *   `@/components/controls`, `@/theme`, `@/theme/runtime`, the reading-size model, and
 *   `ReaderSheet`.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/controls/SegmentedControl';
import { ThemeSwitcher } from '@/components/controls/ThemeSwitcher';
import { borderWidth, metadataText, scriptureText, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ScriptureSize } from '@/stores';

import { READING_SIZES, readingSizeLabel } from '../model/reading-size';

import { ReaderSheet } from './ReaderSheet';

/** A line the reader will recognise, used to preview the reading size. */
const PREVIEW_TEXT = 'In the beginning was the Word, and the Word was with God.';

/** The reading-size control's options, built once from the model's own list. */
const SIZE_OPTIONS: readonly SegmentOption<ScriptureSize>[] = READING_SIZES.map((size) => ({
  value: size,
  label: readingSizeLabel(size),
}));

/** What the display sheet needs. */
export interface DisplaySheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly readingSize: ScriptureSize;
  readonly onSelectReadingSize: (size: ScriptureSize) => void;
  /** The step the current choice resolves to, so the preview matches the canvas exactly. */
  readonly resolvedStep: Parameters<typeof scriptureText>[0];
}

/**
 * Render the display settings.
 *
 * @param props - See {@link DisplaySheetProps}.
 * @returns The sheet. Side effects: none beyond its callbacks.
 */
export function DisplaySheet({
  visible,
  onClose,
  readingSize,
  onSelectReadingSize,
  resolvedStep,
}: DisplaySheetProps): JSX.Element {
  const theme = useTheme();

  return (
    <ReaderSheet visible={visible} title="Display" onClose={onClose} testID="display-sheet">
      {/* `ThemeSwitcher` draws its own "Appearance" label and its own resolved-theme
          caption, so this sheet must not add a second one. */}
      <ThemeSwitcher />

      <Text style={[styles.groupLabel, { color: theme.ink.secondary }]}>Reading size</Text>
      <SegmentedControl
        options={SIZE_OPTIONS}
        value={readingSize}
        onChange={onSelectReadingSize}
        accessibilityLabel="Reading size"
        testID="reading-size"
      />

      <View style={[styles.preview, { borderTopColor: theme.line.hairline }]}>
        <Text
          testID="display-preview"
          style={[scriptureText(resolvedStep), { color: theme.ink.primary }]}
        >
          {PREVIEW_TEXT}
        </Text>
      </View>
    </ReaderSheet>
  );
}

const styles = StyleSheet.create({
  groupLabel: { ...metadataText('sm'), marginTop: spacing.lg, marginBottom: spacing.sm },
  preview: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: borderWidth.hairline },
});
