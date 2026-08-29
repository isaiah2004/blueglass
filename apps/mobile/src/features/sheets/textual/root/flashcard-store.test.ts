/**
 * Tests for the flashcard seam.
 *
 * What is worth asserting here
 *   The button must be honest: pressing it saves, pressing it again un-saves, and saving
 *   one word must not report a different word as saved. That last one is the bug that makes
 *   every `[Root]` sheet in a chapter light up gold after a single save, and it is one
 *   missing key away.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import type { RootSheetPayload } from '../model/textual-payloads';
import {
  draftFromPayload,
  selectIsSaved,
  selectSavedCount,
  useFlashcardDrafts,
  type FlashcardDraft,
} from './flashcard-store';

const ACTS_16_14 = 44016014;

/**
 * A `[Root]` payload.
 *
 * @param overrides - Fields to replace.
 * @returns The payload. Side effects: none.
 */
function payload(overrides: Partial<RootSheetPayload> = {}): RootSheetPayload {
  return {
    lemma: 'πορφυρόπωλις',
    language: 'greek',
    transliteration: 'porphuropōlis',
    strongsNumber: 'G4211',
    gloss: 'dealer in purple',
    surface: 'πορφυρόπωλις',
    occurrenceCount: 1,
    verseCount: 1,
    bookCount: 1,
    ...overrides,
  };
}

/**
 * A draft built from a payload at a fixed instant.
 *
 * @param overrides - Payload fields to replace.
 * @returns The draft. Side effects: none.
 */
function draft(overrides: Partial<RootSheetPayload> = {}): FlashcardDraft {
  return draftFromPayload(payload(overrides), ACTS_16_14, 1_760_000_000_000);
}

beforeEach(() => {
  useFlashcardDrafts.getState().clear();
});

describe('draftFromPayload', () => {
  it('carries the verse it was saved from, so the card can cite itself', () => {
    expect(draft()).toEqual({
      strongsNumber: 'G4211',
      lemma: 'πορφυρόπωλις',
      language: 'greek',
      transliteration: 'porphuropōlis',
      gloss: 'dealer in purple',
      sourceVerseKey: ACTS_16_14,
      savedAt: 1_760_000_000_000,
    });
  });

  it('takes the instant as an argument rather than reading the clock', () => {
    expect(draftFromPayload(payload(), ACTS_16_14, 42).savedAt).toBe(42);
  });
});

describe('useFlashcardDrafts', () => {
  it('starts empty', () => {
    expect(selectSavedCount(useFlashcardDrafts.getState())).toBe(0);
  });

  it('saves a draft under its Strongs number', () => {
    useFlashcardDrafts.getState().save(draft());

    expect(selectIsSaved('G4211')(useFlashcardDrafts.getState())).toBe(true);
  });

  it('does not report a different word as saved', () => {
    useFlashcardDrafts.getState().save(draft());

    expect(selectIsSaved('G2862')(useFlashcardDrafts.getState())).toBe(false);
  });

  it('replaces an earlier save of the same word rather than duplicating it', () => {
    useFlashcardDrafts.getState().save(draft());
    useFlashcardDrafts.getState().save(draft({ gloss: 'seller of purple' }));

    const state = useFlashcardDrafts.getState();
    expect(selectSavedCount(state)).toBe(1);
    expect(state.drafts['G4211']?.gloss).toBe('seller of purple');
  });

  it('removes a draft', () => {
    useFlashcardDrafts.getState().save(draft());
    useFlashcardDrafts.getState().remove('G4211');

    expect(selectIsSaved('G4211')(useFlashcardDrafts.getState())).toBe(false);
  });

  it('ignores a remove for a word that was never saved', () => {
    useFlashcardDrafts.getState().remove('G9999');

    expect(selectSavedCount(useFlashcardDrafts.getState())).toBe(0);
  });

  it('toggles on then off', () => {
    const card = draft();

    useFlashcardDrafts.getState().toggle(card);
    expect(selectIsSaved('G4211')(useFlashcardDrafts.getState())).toBe(true);

    useFlashcardDrafts.getState().toggle(card);
    expect(selectIsSaved('G4211')(useFlashcardDrafts.getState())).toBe(false);
  });

  it('keeps other words when one is removed', () => {
    useFlashcardDrafts.getState().save(draft());
    useFlashcardDrafts.getState().save(draft({ strongsNumber: 'G2862', lemma: 'κολωνία' }));
    useFlashcardDrafts.getState().remove('G4211');

    const state = useFlashcardDrafts.getState();
    expect(selectSavedCount(state)).toBe(1);
    expect(selectIsSaved('G2862')(state)).toBe(true);
  });
});
