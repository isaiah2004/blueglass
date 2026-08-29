/**
 * The translation switcher (decision `S-01`).
 *
 * Purpose
 *   Multiple open translations ship, and the reader chooses between them here. The list is
 *   whatever `GET /translations` returns — the API only lists translations that actually
 *   have verses loaded, so the switcher can never open onto a blank chapter — and each row
 *   shows the attribution that endpoint supplies.
 *
 * What must never appear here
 *   ESV is in the mockups and is licensed. It is not in the API's list, and nothing in this
 *   component adds a translation the server did not send, which is what keeps it out.
 *
 * Redistribution
 *   A translation whose licence forbids shipping the text to a device is labelled as such
 *   from the API's own `can_redistribute` flag. The client never infers a licence.
 *
 * Dependencies
 *   The reader's theme hook, `ReaderSheet`, `OptionRow`, and the translations query's
 *   result — passed in rather than fetched here, so the sheet stays a pure view.
 */

import type { JSX } from 'react';
import { StyleSheet, Text } from 'react-native';

import { spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ApiTranslation } from '@/api';

import { OptionRow } from './OptionRow';
import { ReaderSheet } from './ReaderSheet';

/** What the switcher needs. */
export interface TranslationSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly translations: readonly ApiTranslation[] | undefined;
  readonly selectedCode: string;
  readonly onSelect: (code: string) => void;
  /** True while the list is still loading. */
  readonly loading: boolean;
  /**
   * True when the request failed. Distinct from an empty list on purpose: "no translations
   * are loaded" is a claim about the database, and a request that timed out has established
   * nothing about it. Seen for real — the client's ten-second budget elapsed under load
   * while the API answered every call in single-digit milliseconds, and the sheet told the
   * reader to re-seed a database that was fine.
   */
  readonly failed: boolean;
}

/**
 * The second line under a translation's name.
 *
 * @param translation - The translation being listed.
 * @returns Its code, its language, and a licence note when the API flagged one.
 *   Side effects: none.
 */
function detailFor(translation: ApiTranslation): string {
  const parts = [translation.code, translation.language.toUpperCase()];
  if (!translation.canRedistribute) {
    parts.push('Server-delivered only');
  }
  return parts.join(' · ');
}

/**
 * Render the translation switcher.
 *
 * @param props - See {@link TranslationSheetProps}.
 * @returns The sheet. Side effects: none beyond its callbacks.
 */
export function TranslationSheet({
  visible,
  onClose,
  translations,
  selectedCode,
  onSelect,
  loading,
  failed,
}: TranslationSheetProps): JSX.Element {
  const theme = useTheme();
  const rows = translations ?? [];

  return (
    <ReaderSheet visible={visible} title="Translation" onClose={onClose} testID="translation-sheet">
      {loading && rows.length === 0 ? (
        <Text style={[styles.note, { color: theme.ink.secondary }]}>Loading translations…</Text>
      ) : null}

      {failed && rows.length === 0 ? (
        <Text style={[styles.note, { color: theme.ink.secondary }]}>
          The translation list could not be loaded. Close this and try again.
        </Text>
      ) : null}

      {!loading && !failed && rows.length === 0 ? (
        <Text style={[styles.note, { color: theme.ink.secondary }]}>
          No translations are loaded. Seed the database with `pnpm db:seed`.
        </Text>
      ) : null}

      {rows.map((translation) => (
        <OptionRow
          key={translation.code}
          label={translation.name}
          detail={detailFor(translation)}
          selected={translation.code === selectedCode}
          testID={`translation-option-${translation.code}`}
          onPress={() => {
            onSelect(translation.code);
          }}
        />
      ))}
    </ReaderSheet>
  );
}

const styles = StyleSheet.create({
  note: { ...uiText('sm'), paddingVertical: spacing.md },
});
