/**
 * Tests for the streaming draft store.
 *
 * Two things are being proved here, both from `docs/architecture/flutter-port-map.md`:
 *
 *   - risk #2 — a hundred deltas inside one frame produce one state commit, and therefore
 *     one render of the streaming bubble, not a hundred renders of the shell;
 *   - §7.1 — the draft is separate from history, so a cancelled or failed turn can never
 *     leave a half-message behind.
 *
 * The store is tested through `zustand/vanilla`, which is React-free. A subscriber count
 * is a faithful stand-in for a render count: `useStore(store, selector)` re-renders the
 * component exactly when the selected slice changes identity.
 */

import { describe, expect, it, vi } from 'vitest';

import {
  createChatDraftStore,
  selectDraftMeta,
  selectDraftStatus,
  selectDraftText,
} from './chat-draft-store';
import { createManualScheduler } from './stream-test-doubles';

describe('the draft store, per-frame commits', () => {
  it('commits a hundred deltas as one state change', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);
    const onCommit = vi.fn();
    store.subscribe(onCommit);

    store.getState().begin('thread-1');
    onCommit.mockClear();

    for (let index = 0; index < 100; index += 1) store.getState().appendDelta('x');
    expect(onCommit).not.toHaveBeenCalled();

    manual.tick();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(selectDraftText(store.getState())).toBe('x'.repeat(100));
  });

  it('notifies a text subscriber once per frame, not once per token', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);
    const seen: string[] = [];
    let previous = selectDraftText(store.getState());
    store.subscribe((state) => {
      const next = selectDraftText(state);
      if (next === previous) return;
      previous = next;
      seen.push(next);
    });

    store.getState().begin('thread-1');
    for (const token of ['Ruth ', 'is ', "David's "]) store.getState().appendDelta(token);
    manual.tick();
    for (const token of ['great-', 'grandmother']) store.getState().appendDelta(token);
    manual.tick();

    expect(seen).toEqual(["Ruth is David's ", "Ruth is David's great-grandmother"]);
  });

  it('leaves a status-only subscriber untouched after the stream reaches "streaming"', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);
    const statuses: string[] = [];
    let previous = selectDraftStatus(store.getState());
    store.subscribe((state) => {
      const next = selectDraftStatus(state);
      if (next === previous) return;
      previous = next;
      statuses.push(next);
    });

    store.getState().begin('thread-1');
    for (let index = 0; index < 50; index += 1) {
      store.getState().appendDelta('x');
      manual.tick();
    }
    store.getState().finish();

    // waiting -> streaming -> complete. Fifty frames of text changed nothing for it.
    expect(statuses).toEqual(['waiting', 'streaming', 'complete']);
  });

  it('ignores an empty delta rather than scheduling a frame for it', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);
    const onCommit = vi.fn();

    store.getState().begin('thread-1');
    store.subscribe(onCommit);
    store.getState().appendDelta('');
    manual.tick();

    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe('the draft store, lifecycle', () => {
  it('starts in the waiting state so the skeleton renders before the first token', () => {
    const store = createChatDraftStore(createManualScheduler().scheduler);
    store.getState().begin('thread-1');

    expect(selectDraftStatus(store.getState())).toBe('waiting');
    expect(selectDraftText(store.getState())).toBe('');
  });

  it('holds the meta frame while still waiting, so tool chips can render first', () => {
    const store = createChatDraftStore(createManualScheduler().scheduler);
    store.getState().begin('thread-1');
    store.getState().applyMeta({ rag: true, web: false, sources: ['Study notes'] });

    expect(selectDraftMeta(store.getState())).toEqual({
      rag: true,
      web: false,
      sources: ['Study notes'],
    });
    expect(selectDraftStatus(store.getState())).toBe('waiting');
  });

  it('folds the un-committed buffer into the final text on finish', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);

    store.getState().begin('thread-1');
    store.getState().appendDelta('Ruth ');
    manual.tick();
    // These arrive after the last frame and would be lost by a naive implementation.
    store.getState().appendDelta('is ');
    store.getState().appendDelta('loyal.');

    expect(store.getState().finish()).toBe('Ruth is loyal.');
    expect(selectDraftStatus(store.getState())).toBe('complete');
  });

  it('commits the end of a turn in exactly one state change', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);
    store.getState().begin('thread-1');
    store.getState().appendDelta('tail');

    const onCommit = vi.fn();
    store.subscribe(onCommit);
    store.getState().finish();

    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('keeps the text already received when a turn fails', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);

    store.getState().begin('thread-1');
    store.getState().appendDelta('Ruth ');
    manual.tick();
    store.getState().appendDelta('is ');
    store.getState().fail('upstream refused');

    expect(selectDraftText(store.getState())).toBe('Ruth is ');
    expect(selectDraftStatus(store.getState())).toBe('failed');
    expect(store.getState().errorMessage).toBe('upstream refused');
  });

  it('drops a pending frame when a new draft begins', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);

    store.getState().begin('thread-1');
    store.getState().appendDelta('stale');
    store.getState().begin('thread-2');
    manual.tick();

    expect(selectDraftText(store.getState())).toBe('');
    expect(store.getState().conversationId).toBe('thread-2');
  });

  it('clears everything on reset', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);

    store.getState().begin('thread-1');
    store.getState().applyMeta({ rag: true, web: true, sources: ['a'] });
    store.getState().appendDelta('text');
    manual.tick();
    store.getState().reset();

    expect(selectDraftStatus(store.getState())).toBe('idle');
    expect(selectDraftText(store.getState())).toBe('');
    expect(selectDraftMeta(store.getState())).toBeNull();
    expect(store.getState().conversationId).toBeNull();
  });

  it('does not resurrect a dropped buffer on the next frame after reset', () => {
    const manual = createManualScheduler();
    const store = createChatDraftStore(manual.scheduler);

    store.getState().begin('thread-1');
    store.getState().appendDelta('ghost');
    store.getState().reset();
    manual.tick();

    expect(selectDraftText(store.getState())).toBe('');
  });
});
