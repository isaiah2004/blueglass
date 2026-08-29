/**
 * Full-text scripture search, over the reader rather than instead of it.
 *
 * Purpose
 *   The API has served `GET /search` since M1 opened and no client ever called it, so the
 *   only search in the app filtered the 66-book list inside the navigator — a different
 *   feature with a similar name. This is the missing one.
 *
 * Why an overlay and not a screen
 *   The prototype built a full-screen search screen, left it dead, and shipped an overlay
 *   instead (`flutter-port-map.md` §2). The reason is the reader's place: searching
 *   mid-chapter and then not finding the way back is a detour, and pillar 2 exists to
 *   remove detours. The chapter stays mounted behind this the whole time.
 *
 * Why the query is debounced and trimmed
 *   Every keystroke is a round trip otherwise, and the server answers `422 query_too_short`
 *   for a blank or one-character query — spending a request to be told that is this
 *   component's job to avoid.
 *
 * Dependencies
 *   `@/api` for the search query, `@/stores` for the active translation, and the reader's
 *   own sheet-free modal surface.
 */

import type { JSX } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useSearchQuery, type ApiSearchHit } from '@/api';
import { selectTranslationCode, usePrefs } from '@/stores';
import { borderWidth, radius, size, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import { useDebouncedValue } from '../hooks/use-debounced-value';

import { ReaderButton } from './ReaderButton';
import { SearchResultRow } from './SearchResultRow';

/** What the overlay needs. */
export interface SearchOverlayProps {
  readonly visible: boolean;
  readonly query: string;
  readonly onChangeQuery: (value: string) => void;
  readonly onClose: () => void;
  /** Open a hit. The caller navigates and closes. */
  readonly onOpenHit: (hit: ApiSearchHit) => void;
}

/** How long the box waits for the reader to stop typing, in ms. */
const DEBOUNCE_MS = 250;

/** Shortest query worth a round trip. The server's own floor is two characters. */
const MIN_QUERY_LENGTH = 2;

/** How many hits to ask for. Enough to be useful, few enough to scan. */
const RESULT_LIMIT = 40;

/**
 * Render the search overlay.
 *
 * @param props - See {@link SearchOverlayProps}.
 * @returns The overlay, or nothing when closed.
 *
 * Side effects: issues a search request as the debounced query settles.
 */
export function SearchOverlay({
  visible,
  query,
  onChangeQuery,
  onClose,
  onOpenHit,
}: SearchOverlayProps): JSX.Element {
  const theme = useTheme();
  const translation = usePrefs(selectTranslationCode);
  const settled = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isSearchable = settled.length >= MIN_QUERY_LENGTH;

  const results = useSearchQuery(
    isSearchable ? { query: settled, translation, limit: RESULT_LIMIT } : null,
    { enabled: visible && isSearchable },
  );
  const hits = results.data?.hits ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close search"
        style={[styles.scrim, { backgroundColor: theme.overlay.scrim }]}
        onPress={onClose}
      />
      <View
        testID="search-overlay"
        style={[
          styles.panel,
          { backgroundColor: theme.background.elevated, borderColor: theme.line.hairline },
        ]}
      >
        <View style={styles.bar}>
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search all scripture"
            placeholderTextColor={theme.ink.tertiary}
            accessibilityLabel="Search scripture"
            autoFocus
            returnKeyType="search"
            style={[
              styles.input,
              {
                color: theme.ink.primary,
                borderColor: theme.line.hairline,
                backgroundColor: theme.background.canvas,
              },
            ]}
          />
          <ReaderButton label="Close" onPress={onClose} testID="search-close" />
        </View>

        <SearchBody
          isSearchable={isSearchable}
          isPending={results.isPending}
          isError={results.isError}
          hits={hits}
          query={settled}
          onOpenHit={onOpenHit}
        />
      </View>
    </Modal>
  );
}

/**
 * Whichever of search's four states applies: idle, loading, empty, or results.
 *
 * Separated so the overlay above stays a description of a surface, and so the four states
 * are mutually exclusive by construction rather than by four conditionals that could all
 * be true at once (`flutter-port-map.md` §7.4).
 *
 * @param props.isSearchable - Whether the settled query is long enough to send.
 * @param props.isPending - Whether a request is in flight.
 * @param props.isError - Whether the last request failed.
 * @param props.hits - What came back.
 * @param props.query - The settled query, for the empty state's sentence.
 * @param props.onOpenHit - Open one hit.
 * @returns One of the four states. Side effects: none.
 */
function SearchBody({
  isSearchable,
  isPending,
  isError,
  hits,
  query,
  onOpenHit,
}: {
  readonly isSearchable: boolean;
  readonly isPending: boolean;
  readonly isError: boolean;
  readonly hits: readonly ApiSearchHit[];
  readonly query: string;
  readonly onOpenHit: (hit: ApiSearchHit) => void;
}): JSX.Element {
  const theme = useTheme();

  if (!isSearchable) {
    return (
      <Text testID="search-idle" style={[styles.note, { color: theme.ink.secondary }]}>
        Type at least two letters to search every verse in this translation.
      </Text>
    );
  }

  if (isError) {
    return (
      <Text testID="search-error" style={[styles.note, { color: theme.state.danger }]}>
        Search could not reach Atlas. Check your connection and try again.
      </Text>
    );
  }

  if (isPending) {
    return (
      <Text testID="search-pending" style={[styles.note, { color: theme.ink.secondary }]}>
        Searching…
      </Text>
    );
  }

  if (hits.length === 0) {
    return (
      <Text testID="search-empty" style={[styles.note, { color: theme.ink.secondary }]}>
        No verse in this translation contains “{query}”.
      </Text>
    );
  }

  return (
    <ScrollView testID="search-results" contentContainerStyle={styles.results}>
      {hits.map((hit, index) => (
        <SearchResultRow
          key={hit.verseKey}
          hit={hit}
          index={index}
          onPress={() => {
            onOpenHit(hit);
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  panel: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xxl,
    borderRadius: radius.sheet,
    borderWidth: borderWidth.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    minHeight: size.tapTarget,
    paddingHorizontal: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
    ...uiText('md'),
  },
  note: { ...uiText('sm'), paddingVertical: spacing.lg },
  results: { gap: spacing.xs, paddingBottom: spacing.xl },
});
