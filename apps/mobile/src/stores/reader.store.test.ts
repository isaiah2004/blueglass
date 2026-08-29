/**
 * Tests for the reader and chrome stores.
 *
 * What these prove
 *   - Opening a chapter clears everything derived from the previous one, in a single
 *     update rather than in three effects that each cause a render.
 *   - Focusing the same word twice unfocuses it — the prototype's toggle.
 *   - Exactly one overlay is open at a time, enforced by the store rather than by
 *     twelve `onPress` handlers (pillar 1).
 *   - The search query survives its overlay closing, which is what makes "check one
 *     more verse" cost nothing.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_READER_ADDRESS, useReader } from './reader.store';
import { useUi } from './ui.store';

beforeEach(() => {
  useReader.setState({
    address: DEFAULT_READER_ADDRESS,
    selectedVerseKey: null,
    focusedWord: null,
    panel: 'study',
    studyTab: 'overview',
  });
  useUi.setState({ overlay: 'none', searchQuery: '', searchScopeBook: false });
});

describe('the reader store', () => {
  it('opens on the first chapter of the canon in the default translation', () => {
    expect(useReader.getState().address).toEqual({
      translation: 'BSB',
      book: 'Genesis',
      chapter: 1,
    });
  });

  it('clears the selection and the focused word when the chapter changes', () => {
    useReader.getState().selectVerse(43_003_016);
    useReader.getState().focusWord('agape');

    useReader.getState().setAddress({ translation: 'BSB', book: 'John', chapter: 4 });

    const state = useReader.getState();
    expect(state.address.chapter).toBe(4);
    expect(state.selectedVerseKey).toBeNull();
    expect(state.focusedWord).toBeNull();
  });

  it('selects and deselects a verse', () => {
    useReader.getState().selectVerse(43_003_016);
    expect(useReader.getState().selectedVerseKey).toBe(43_003_016);

    useReader.getState().selectVerse(null);
    expect(useReader.getState().selectedVerseKey).toBeNull();
  });

  it('toggles a focused word off when it is focused again', () => {
    useReader.getState().focusWord('hesed');
    expect(useReader.getState().focusedWord).toBe('hesed');

    useReader.getState().focusWord('hesed');
    expect(useReader.getState().focusedWord).toBeNull();
  });

  it('switches to a different word rather than unfocusing', () => {
    useReader.getState().focusWord('hesed');
    useReader.getState().focusWord('agape');

    expect(useReader.getState().focusedWord).toBe('agape');
  });

  it('keeps the panel and tab independent of the selection', () => {
    useReader.getState().setPanel('chat');
    useReader.getState().setStudyTab('words');
    useReader.getState().selectVerse(1_001_001);

    expect(useReader.getState().panel).toBe('chat');
    expect(useReader.getState().studyTab).toBe('words');
  });
});

describe('the chrome store', () => {
  it('opens exactly one overlay at a time', () => {
    useUi.getState().openOverlay('search');
    useUi.getState().openOverlay('translations');

    expect(useUi.getState().overlay).toBe('translations');
  });

  it('toggles the open overlay closed, and a different one open', () => {
    useUi.getState().toggleOverlay('search');
    expect(useUi.getState().overlay).toBe('search');

    useUi.getState().toggleOverlay('search');
    expect(useUi.getState().overlay).toBe('none');

    useUi.getState().toggleOverlay('sheet');
    expect(useUi.getState().overlay).toBe('sheet');
  });

  it('closes idempotently', () => {
    useUi.getState().closeOverlay();
    useUi.getState().closeOverlay();

    expect(useUi.getState().overlay).toBe('none');
  });

  it('keeps the search query when the overlay closes', () => {
    useUi.getState().openOverlay('search');
    useUi.getState().setSearchQuery('lovingkindness');
    useUi.getState().setSearchScopeBook(true);

    useUi.getState().closeOverlay();

    expect(useUi.getState().searchQuery).toBe('lovingkindness');
    expect(useUi.getState().searchScopeBook).toBe(true);
  });

  it('clears the search only when asked', () => {
    useUi.getState().setSearchQuery('lovingkindness');
    useUi.getState().setSearchScopeBook(true);

    useUi.getState().clearSearch();

    expect(useUi.getState().searchQuery).toBe('');
    expect(useUi.getState().searchScopeBook).toBe(false);
  });
});
