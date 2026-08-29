/**
 * The reader route: `/read/[book]/[chapter]`.
 *
 * Purpose
 *   Turns two untrusted URL segments into a validated address and renders the canvas at
 *   it. That is the whole job: the route owns navigation and nothing else, so the reading
 *   canvas can be rendered in a test, in a preview, or beside a second pane without a
 *   navigator anywhere in the tree.
 *
 * Why the address is resolved here rather than inside the screen
 *   A bad URL is a routing failure, not a reading failure. Resolving first means the canvas
 *   only ever receives an address it can trust, and a hand-typed `/read/hezekiah/1` gets a
 *   considered screen instead of a request the API would have rejected anyway.
 *
 * Deep links
 *   `atlasbible://read/john/3` and, on the web, `/read/john/3` both land here. Every book
 *   spelling the API accepts works in the URL too, because both sides resolve through the
 *   same canonical table in `@atlas/shared`.
 *
 * Why it lives inside `(tabs)`
 *   Because it is the Bible destination, not a modal above the app. Outside the tab group
 *   the reading canvas had no tab bar, no nav rail and no theme toggle at any width: a
 *   reader who deep-linked to `/read/john/3` could reach Home only with the browser's Back
 *   button. Pillar 1 asks for a pristine canvas, not a canvas with no way out. The group is
 *   a route group, so the URL is still `/read/john/3`; `(tabs)/_layout.tsx` hides it from
 *   the bar, because Bible is already there and a sixth item would be a lie.
 *
 * The `bible-screen` id
 *   This *is* the Bible tab's screen — `(tabs)/bible.tsx` redirects here — so the root
 *   carries the destination id the shell contract names (`e2e/support/test-ids.ts`,
 *   `SCREEN_IDS.bible`) as well as the reader's own.
 *
 * A blurred chapter renders nothing
 *   Stepping from Acts 1 to Acts 2 pushes a screen, which is what makes the browser's Back
 *   button work — and a React Navigation stack keeps every pushed screen mounted. Walking
 *   twenty chapters would otherwise leave twenty full reading canvases in the document,
 *   twenty query subscriptions alive, and twenty elements answering to `verse-row-1`. The
 *   blurred ones keep their frame and drop their contents; going Back re-renders instantly
 *   from the query cache, because scripture is immutable and was never evicted.
 */

import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import type { JSX } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  badAddressCopy,
  ReaderMessage,
  ReaderScreen,
  resolveReaderAddress,
  type ReaderAddress,
} from '@/features/reader';

/**
 * Where a reader is sent when the URL names a passage that does not exist.
 *
 * The typed object form, so a renamed route segment is a compile error rather than a
 * second dead link inside the screen that handles dead links.
 */
const FALLBACK_ROUTE = {
  pathname: '/read/[book]/[chapter]',
  params: { book: 'genesis', chapter: '1' },
} as const;

/**
 * Reads one route segment.
 *
 * Expo Router types a catch-all segment as `string | string[]`; a duplicated segment in a
 * crafted URL is what produces the array, and taking the first element is the only sane
 * reading of it.
 *
 * @param value - The raw parameter.
 * @returns The segment as a string, or an empty string when it is absent.
 *   Side effects: none.
 */
function segment(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

/**
 * Render the reader at the address in the URL.
 *
 * @returns The reading canvas, or the wrong-address screen.
 *
 * Side effects: navigates on chapter and book changes.
 */
export default function ChapterRoute(): JSX.Element {
  const params = useLocalSearchParams<{ book?: string | string[]; chapter?: string | string[] }>();
  const isFocused = useIsFocused();
  const resolved = resolveReaderAddress(segment(params.book), segment(params.chapter));

  if (!isFocused) return <View style={styles.root} />;

  if (!resolved.ok) {
    const copy = badAddressCopy(resolved.error.message);
    return (
      <ReaderMessage
        {...copy}
        testID="reader-bad-address"
        onAction={() => {
          router.replace(FALLBACK_ROUTE);
        }}
      />
    );
  }

  return (
    <View testID="bible-screen" style={styles.root}>
      <ReaderScreen
        address={resolved.value}
        onNavigate={(address: ReaderAddress) => {
          router.push({
            pathname: '/read/[book]/[chapter]',
            params: { book: address.book.id, chapter: String(address.chapter) },
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
