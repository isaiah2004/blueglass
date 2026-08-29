/**
 * The reader's considered failure and empty states.
 *
 * Purpose
 *   `flutter-port-map.md` §7.4 singles this out: the prototype distinguished loading, "no
 *   content here", and a genuine error, and "most rewrites collapse these three into one".
 *   This component is the one that must not. Each state gets its own mark, its own
 *   sentence, and — only when a retry could actually help — its own button.
 *
 * Why Retry is conditional
 *   `isRetryable` says a wrong address is not worth retrying: the same 404 comes back and
 *   the reader learns nothing. Those states offer a way *out* instead, back to a chapter
 *   that exists.
 *
 * Copy
 *   Every sentence here is written for a reader, not for a developer. The API's own message
 *   is preferred whenever it sent one, because "John has 21 chapters" is genuinely helpful;
 *   nothing here ever renders a status code, a URL, or a request id.
 *
 * Dependencies
 *   The reader's theme hook, `ReaderButton`, and the typography and spacing tokens.
 */

import type { JSX } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { scriptureText, spacing, uiText } from '@/theme';
import { useTheme } from '@/theme/runtime';

import type { ReaderMessageTone } from '../model/reader-status';

import { ReaderButton } from './ReaderButton';

/** What a message state shows. */
export interface ReaderMessageProps {
  readonly tone: ReaderMessageTone;
  readonly title: string;
  readonly body: string;
  /**
   * Primary action. `null` or omitted when nothing useful can be done from here — which
   * is a real state, not an oversight: see `isRetryable`.
   */
  readonly actionLabel?: string | null;
  readonly onAction?: () => void;
  readonly reduceMotion?: boolean;
  readonly testID?: string;
}

/**
 * The mark drawn above the message.
 *
 * A typographic mark rather than an icon set: the reader has no icon family yet
 * (`Q-021` is still open), and a wrong icon reads worse than none.
 */
const MARKS: Record<ReaderMessageTone, string> = {
  empty: '—',
  offline: '⌁',
  error: '!',
  notFound: '?',
};

/**
 * Render a message state.
 *
 * @param props - See {@link ReaderMessageProps}.
 * @returns The centred block. Side effects: none beyond `onAction`.
 */
export function ReaderMessage({
  tone,
  title,
  body,
  actionLabel,
  onAction,
  reduceMotion = false,
  testID,
}: ReaderMessageProps): JSX.Element {
  const theme = useTheme();
  const markColor =
    tone === 'error' || tone === 'offline' ? theme.state.danger : theme.ink.tertiary;

  return (
    <View
      testID={testID ?? `reader-${tone}`}
      accessibilityRole="alert"
      style={[styles.root, { backgroundColor: theme.background.canvas }]}
    >
      <Text style={[styles.mark, { color: markColor }]}>{MARKS[tone]}</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.ink.primary }]}>
        {title}
      </Text>
      <Text style={[styles.body, { color: theme.ink.secondary }]}>{body}</Text>
      {actionLabel == null || onAction === undefined ? null : (
        <ReaderButton
          emphasis="strong"
          label={actionLabel}
          onPress={onAction}
          reduceMotion={reduceMotion}
          testID="reader-message-action"
        />
      )}
    </View>
  );
}

/**
 * The widest a block of UI prose may run here, in dp.
 *
 * The same 60-75 character rule the scripture measure comes from, evaluated at the 15 pt
 * sans rather than the 20 pt serif. Named rather than written inline so no raw size sits
 * in a style (CLAUDE.md, "never inline a raw colour, size, or spacing value").
 */
const MESSAGE_MEASURE = 420;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxxl,
  },
  mark: { ...scriptureText('display'), lineHeight: scriptureText('display').fontSize },
  title: { ...uiText('lg', 'semiBold'), textAlign: 'center' },
  body: { ...uiText('md'), textAlign: 'center', maxWidth: MESSAGE_MEASURE },
});
