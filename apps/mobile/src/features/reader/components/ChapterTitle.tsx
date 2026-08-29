/**
 * The chapter's own heading, at the top of the canvas.
 *
 * Purpose
 *   A book opens with a title, and so should a chapter. The reference is set in the
 *   scripture serif at its `title` step — `design-language.md` §3 reserves that step for
 *   exactly this, a serif heading that is not itself scripture — with the translation code
 *   beneath it in the monospace metadata face and a hairline rule closing the block.
 *
 * Why the rule is `line.hairline` and not a coloured accent
 *   §8.2 gives gold and cyan meanings. A divider means nothing, so it takes the neutral
 *   hairline; colouring it would say something the design language does not intend.
 *
 * Dependencies
 *   The reader's theme hook and the typography, spacing and border tokens.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, metadataText, scriptureText, spacing } from '@/theme';
import { useTheme } from '@/theme/runtime';

/** What the title block shows. */
export interface ChapterTitleProps {
  /** Human reference, e.g. `John 3`. */
  readonly reference: string;
  /** Translation code, e.g. `BSB`. */
  readonly code: string;
}

/**
 * Render the chapter heading.
 *
 * @param props - See {@link ChapterTitleProps}.
 * @returns The heading block. Side effects: none.
 */
export function ChapterTitle({ reference, code }: ChapterTitleProps): JSX.Element {
  const theme = useTheme();

  return (
    <View style={[styles.block, { borderBottomColor: theme.line.hairline }]}>
      <Text
        accessibilityRole="header"
        testID="chapter-title"
        style={[styles.reference, { color: theme.ink.primary }]}
      >
        {reference}
      </Text>
      <Text style={[styles.code, { color: theme.ink.secondary }]}>{code}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    paddingBottom: spacing.md,
    marginBottom: spacing.lg,
    borderBottomWidth: borderWidth.hairline,
  },
  reference: scriptureText('title', 'semiBold'),
  code: { ...metadataText('sm'), marginTop: spacing.xs },
});
