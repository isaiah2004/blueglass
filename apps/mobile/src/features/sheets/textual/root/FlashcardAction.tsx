/**
 * FlashcardAction — the gold primary action at the foot of the `[Root]` sheet.
 *
 * Purpose
 *   `image6.png` makes "Save as Flashcard" the sheet's one filled, gold control: gold is
 *   the reader's own journey (`design-language.md` §8.2), and saving a word is the reader
 *   doing something rather than the system telling them something. This is that control.
 *
 * Responsibilities
 *   - Owns: the button, its saved state, and the sentence that tells the reader exactly how
 *     far a save has got.
 *   - Does NOT own: storage, scheduling or sync. Those are `flashcard-store`'s seam and,
 *     beyond it, the Studio milestone's. See that module's header.
 *
 * Why it says what it does
 *   A button that appears to save something that vanishes on reload is a small lie, and
 *   pillar 3's habit of not overstating what the app knows applies to its own state too.
 *   `SAVE_CONFIRMATION` is shown after the first save, not hidden in a tooltip.
 *
 * Accessibility
 *   The control is a checkbox, not a button: it has two states and the second is reachable
 *   by pressing it again. `aria-checked` is what makes a screen reader say "saved" rather
 *   than leaving the reader to guess whether the press landed.
 *
 *   `role` and `aria-checked`, not `accessibilityRole` and `accessibilityState`: React
 *   Native has accepted the W3C spellings since 0.71, and react-native-web maps only those
 *   two — `accessibilityState` reaches the DOM as nothing at all, which is a silently
 *   inaccessible control on the target `T-01` made first-class.
 */

import type { JSX } from 'react';
import { Pressable, Text, View } from 'react-native';

import { borderWidth, radius, size, spacing, uiText, type Theme } from '@/theme';
import { createThemedStyles, useTheme } from '@/theme/runtime';

import type { RootSheetPayload } from '../model/textual-payloads';
import {
  SAVE_CONFIRMATION,
  draftFromPayload,
  selectIsSaved,
  useFlashcardDrafts,
} from './flashcard-store';

/** Inputs to {@link FlashcardAction}. */
export interface FlashcardActionProps {
  /** The `[Root]` payload on screen. */
  readonly payload: RootSheetPayload;
  /** The packed key of the verse the badge is anchored to, stored with the card. */
  readonly verseKey: number;
  /** Test hook. */
  readonly testID?: string | undefined;
}

/** The label in each state. */
const LABEL = { idle: 'Save as Flashcard', saved: 'Saved as Flashcard' } as const;

/**
 * The save control.
 *
 * @param props - See {@link FlashcardActionProps}.
 * @returns The button, plus the confirmation once something is saved.
 *
 * Side effects: writes to the session flashcard store, and reads the clock to stamp the
 * draft.
 */
export function FlashcardAction({ payload, verseKey, testID }: FlashcardActionProps): JSX.Element {
  const theme = useTheme();
  const styles = useStyles(theme);
  const saved = useFlashcardDrafts(selectIsSaved(payload.strongsNumber));
  // Zustand actions are closures created in the store factory, never `this`-bound, so
  // selecting one is safe. The rule cannot see that from the interface's method syntax.
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const toggle = useFlashcardDrafts((state) => state.toggle);

  return (
    <View style={styles.block}>
      <Pressable
        testID={testID ?? 'root-save-flashcard'}
        role="checkbox"
        aria-checked={saved}
        accessibilityLabel={`${LABEL.idle}: ${payload.lemma}`}
        onPress={() => {
          toggle(draftFromPayload(payload, verseKey, Date.now()));
        }}
        style={({ pressed }) => [
          styles.button,
          saved ? styles.savedButton : styles.idleButton,
          pressed ? styles.pressed : null,
        ]}
      >
        <Text style={[styles.label, saved ? styles.savedLabel : styles.idleLabel]}>
          {saved ? LABEL.saved : LABEL.idle}
        </Text>
      </Pressable>
      {saved ? <Text style={styles.confirmation}>{SAVE_CONFIRMATION}</Text> : null}
    </View>
  );
}

const useStyles = createThemedStyles((theme: Theme) => ({
  block: { gap: spacing.sm },
  button: {
    minHeight: size.tapTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.control,
    borderWidth: borderWidth.hairline,
  },
  // Filled gold at rest: this is the sheet's primary action and the only filled control on
  // it, which is what makes it findable without a second glance.
  idleButton: { backgroundColor: theme.accent.gold, borderColor: theme.accent.gold },
  // Saved is an outline, not a second filled state: the work is done, so the control should
  // stop competing with the content for attention.
  savedButton: { backgroundColor: theme.background.card, borderColor: theme.accent.goldDim },
  pressed: { opacity: 0.85 },
  label: uiText('md', 'semiBold'),
  // On the filled gold, the label takes the canvas colour. That inverts correctly in both
  // palettes without a second rule: the dark theme's gold is bright and its canvas is
  // near-black, the light theme's gold is a dark bronze and its canvas is paper.
  idleLabel: { color: theme.background.canvas },
  savedLabel: { color: theme.accent.gold },
  confirmation: { ...uiText('sm'), color: theme.ink.secondary },
}));
