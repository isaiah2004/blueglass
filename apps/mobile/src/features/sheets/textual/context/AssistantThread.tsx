/**
 * AssistantThread — the `[Context]` sheet's live grounded-chat box.
 *
 * Purpose
 *   `image11.png`'s "ask about this passage" chips seed a real question-and-answer
 *   thread, once M6 wires them up: this is that wiring. A tap on a suggested question,
 *   or typed text plus Enter, calls `POST /assistant/ask` (`useAskAssistantMutation`)
 *   and appends the answer — with its own citations and its own Grounding Confidence —
 *   to a running thread. Nothing here invents a citation the server did not send
 *   (pillar 3: every claim carries a citation, or it is not rendered).
 *
 * Why a local `turns` array and not TanStack Query's cache
 *   Each question is its own mutation, billed once and never refetched; the thread is
 *   conversational state (what was asked, in what order), which is this component's own
 *   concern, not the query cache's.
 *
 * Responsibilities
 *   - Owns: the input field, the running thread, and per-turn loading/error rendering.
 *   - Does NOT own: the mutation itself (`useAskAssistantMutation`) or the wire contract
 *     (`assistant-api.ts`).
 */

import { useCallback, useState, type JSX } from 'react';
import { ActivityIndicator, Pressable, TextInput, View, Text } from 'react-native';

import { useAskAssistantMutation, type AssistantAnswer } from '@/features/assistant';
import {
  borderWidth,
  metadataText,
  radius,
  size,
  spacing,
  uiText,
  type Theme,
} from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import { GroundingMeter } from './GroundingMeter';

/** One question-and-answer pair in the thread. */
interface Turn {
  readonly id: string;
  readonly question: string;
  readonly status: 'pending' | 'answered' | 'failed';
  readonly answer?: AssistantAnswer;
  readonly errorMessage?: string;
}

/** Inputs to {@link AssistantThread}. */
export interface AssistantThreadProps {
  /** Starter prompts, shown as tappable chips above the input. */
  readonly suggestedQuestions: readonly string[];
  /** The badge's hue. */
  readonly tint: string;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** Build a turn id that does not depend on a clock the tests would have to fake. */
function nextTurnId(existing: readonly Turn[]): string {
  return `turn-${String(existing.length)}`;
}

/**
 * The live grounded-chat thread.
 *
 * @param props - See {@link AssistantThreadProps}.
 * @returns The chip row, the input, and the running thread beneath it.
 *
 * Side effects: one `POST /assistant/ask` per submitted question.
 */
export function AssistantThread({
  suggestedQuestions,
  tint,
  testID,
}: AssistantThreadProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const mutation = useAskAssistantMutation();
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<readonly Turn[]>([]);

  const ask = useCallback(
    (question: string) => {
      const trimmed = question.trim();
      if (trimmed.length === 0) return;

      const turnId = nextTurnId(turns);
      setTurns((previous) => [
        ...previous,
        { id: turnId, question: trimmed, status: 'pending' },
      ]);
      setDraft('');

      mutation.mutate(trimmed, {
        onSuccess: (answer) => {
          setTurns((previous) =>
            previous.map((turn) =>
              turn.id === turnId ? { ...turn, status: 'answered', answer } : turn,
            ),
          );
        },
        onError: (error) => {
          setTurns((previous) =>
            previous.map((turn) =>
              turn.id === turnId
                ? { ...turn, status: 'failed', errorMessage: error.message }
                : turn,
            ),
          );
        },
      });
    },
    [mutation, turns],
  );

  return (
    <View style={styles.thread} testID={testID ?? 'assistant-thread'}>
      {suggestedQuestions.length === 0 ? null : (
        <View style={styles.chipRow}>
          {suggestedQuestions.map((question) => (
            <Pressable
              key={question}
              onPress={() => {
                ask(question);
              }}
              style={styles.chip}
              accessibilityRole="button"
              accessibilityLabel={`Ask: ${question}`}
              testID="assistant-suggested-question"
            >
              <Text style={styles.chipText}>{question}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {turns.map((turn) => (
        <View key={turn.id} style={styles.turn} testID="assistant-turn">
          <Text style={styles.question}>{turn.question}</Text>

          {turn.status === 'pending' ? (
            <ActivityIndicator
              color={tint}
              testID="assistant-turn-pending"
              accessibilityLabel="Asking the Studio Assistant"
            />
          ) : null}

          {turn.status === 'failed' ? (
            <Text style={styles.error} testID="assistant-turn-error">
              {turn.errorMessage ?? 'The assistant could not answer that. Try again.'}
            </Text>
          ) : null}

          {turn.status === 'answered' && turn.answer !== undefined ? (
            <View style={styles.answerBlock}>
              <Text style={styles.answer}>{turn.answer.answer}</Text>
              <GroundingMeter confidence={turn.answer.confidence} tint={tint} />
              {turn.answer.citations.length === 0 ? null : (
                <View style={styles.citationRow}>
                  {turn.answer.citations.map((citation) => (
                    <View
                      key={`${citation.label}-${String(citation.verseKey)}`}
                      style={styles.citationChip}
                    >
                      <Text style={styles.citationText}>{citation.label}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      ))}

      <TextInput
        testID="assistant-input"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => {
          ask(draft);
        }}
        placeholder="Ask about this passage…"
        placeholderTextColor={theme.ink.tertiary}
        accessibilityLabel="Ask the Studio Assistant"
        returnKeyType="send"
        style={styles.input}
      />
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  thread: { gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipText: { ...uiText('sm'), color: theme.ink.primary },
  turn: { gap: spacing.xs },
  question: { ...uiText('sm', 'semiBold'), color: theme.ink.primary },
  error: { ...uiText('sm'), color: theme.state.danger },
  answerBlock: { gap: spacing.xs },
  answer: { ...uiText('sm'), color: theme.ink.primary },
  citationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  citationChip: {
    borderWidth: borderWidth.hairline,
    borderColor: theme.line.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
  },
  citationText: { ...metadataText('xs', 'medium'), color: theme.ink.secondary },
  input: {
    ...uiText('md'),
    minHeight: size.tapTarget,
    paddingHorizontal: spacing.md,
    borderWidth: borderWidth.hairline,
    borderRadius: radius.control,
    color: theme.ink.primary,
    backgroundColor: theme.background.card,
    borderColor: theme.line.hairline,
  },
}));
