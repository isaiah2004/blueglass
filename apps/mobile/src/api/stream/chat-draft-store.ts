/**
 * The streaming draft store — an isolated island of fast-changing state.
 *
 * Purpose
 *   The direct answer to `docs/architecture/flutter-port-map.md` risk #2. The in-flight
 *   assistant reply lives here and *only* here, in a store nothing else subscribes to.
 *   The tab bar, the reader, the message history and every layout component read from
 *   their own stores and are therefore untouched while a reply streams. The single
 *   component that subscribes is the streaming bubble.
 *
 * Key responsibilities
 *   - Accumulate deltas off-store and commit at most once per animation frame.
 *   - Hold the `meta` frame so tool chips can render before the first token (§7.1).
 *   - Hand the finished text back on completion so the *conversation* store can append it
 *     to history. History is never mutated mid-stream, so a cancelled or failed turn
 *     leaves no half-message behind — the behaviour worth preserving from `state.dart:552-560`.
 *
 * The rule this module exists to enforce
 *   **No layout or shell component may subscribe to this store.** Subscribe to one field
 *   with a selector, from the smallest component that can render it. A component reading
 *   the whole state object re-renders on every frame of every stream, which is precisely
 *   the failure mode being designed out.
 *
 * Usage
 *   ```ts
 *   // in the streaming bubble, and nowhere else
 *   const text = useStore(chatDraftStore, selectDraftText);
 *   ```
 */

import { createStore, type StoreApi } from 'zustand/vanilla';

import type { ChatToolUse } from './chat-events';
import { createFrameThrottle, defaultFrameScheduler, type FrameScheduler } from './frame-throttle';

/**
 * Where a draft is in its life.
 *
 * `waiting` is the skeleton state — spinner, "Reading your sources…", shimmer bars. It
 * ends at the first delta, not at the first byte, which is why the swap to live text
 * never leaves an empty bubble on screen (§7.1).
 */
export type ChatDraftStatus = 'idle' | 'waiting' | 'streaming' | 'complete' | 'failed';

/** The observable half of the store. Every field is a valid selector target. */
export interface ChatDraftState {
  /** Which conversation this draft belongs to, so a stale stream cannot paint a new thread. */
  readonly conversationId: string | null;
  readonly status: ChatDraftStatus;
  /** Text committed so far. Grows once per frame, never once per token. */
  readonly text: string;
  /** The `meta` frame, available before the first token arrives. */
  readonly meta: ChatToolUse | null;
  /** Set with `failed`; the message the server or transport gave. */
  readonly errorMessage: string | null;
}

/** State plus the actions that drive it. */
export interface ChatDraftSlice extends ChatDraftState {
  /** Start a new draft, clearing everything from the previous one. */
  begin(conversationId: string): void;
  /** Record the one-off tool-use frame. */
  applyMeta(meta: ChatToolUse): void;
  /** Buffer a token. Commits on the next frame, not now. */
  appendDelta(text: string): void;
  /** End the draft as failed, keeping whatever text already arrived. */
  fail(message: string): void;
  /** End the draft as complete. @returns The final text, for appending to history. */
  finish(): string;
  /** Return to `idle` and drop everything. Call after handing the text to history. */
  reset(): void;
}

/** The empty draft. */
const EMPTY_DRAFT: ChatDraftState = {
  conversationId: null,
  status: 'idle',
  text: '',
  meta: null,
  errorMessage: null,
};

/** The store's own actions, separated from its data so each half stays small. */
type DraftActions = Pick<
  ChatDraftSlice,
  'begin' | 'applyMeta' | 'appendDelta' | 'fail' | 'finish' | 'reset'
>;

/** Zustand's `set`, narrowed to the partial updates this store actually performs. */
type DraftSet = (partial: Partial<ChatDraftSlice>) => void;

/** Zustand's `get`. */
type DraftGet = () => ChatDraftSlice;

/**
 * The off-store delta buffer.
 *
 * Tokens land here rather than in the store, so an arriving token costs a string concat
 * and nothing else — no state update, no subscriber notification, no render.
 */
interface DraftBuffer {
  /** Buffer a token and ask for a commit on the next frame. */
  append(text: string): void;
  /**
   * Drop any pending frame and hand back everything buffered.
   *
   * Every terminal action uses this, which is why ending a turn is one state update and
   * not two: the tail of the buffer is folded into the same `set` as the new status.
   */
  flush(): string;
}

/**
 * Create the buffer.
 *
 * @param scheduler Frame source for the commit throttle.
 * @param onFrame   Called with the buffered text at most once per frame, and never with
 *                  an empty string.
 * @returns The buffer. It owns the throttle, so nothing else may schedule a commit.
 */
function createDraftBuffer(
  scheduler: FrameScheduler,
  onFrame: (pending: string) => void,
): DraftBuffer {
  let buffered = '';

  const take = (): string => {
    const pending = buffered;
    buffered = '';
    return pending;
  };

  const throttle = createFrameThrottle(() => {
    const pending = take();
    if (pending.length === 0) return;
    onFrame(pending);
  }, scheduler);

  return {
    append(text: string): void {
      if (text.length === 0) return;
      buffered += text;
      throttle.schedule();
    },

    flush(): string {
      throttle.cancel();
      return take();
    },
  };
}

/**
 * Build the six actions.
 *
 * @param set    Zustand's setter.
 * @param get    Zustand's getter, for the text committed so far.
 * @param buffer The delta buffer this draft commits through.
 * @returns The actions half of {@link ChatDraftSlice}.
 */
function createDraftActions(set: DraftSet, get: DraftGet, buffer: DraftBuffer): DraftActions {
  return {
    begin(conversationId: string): void {
      buffer.flush();
      set({ ...EMPTY_DRAFT, conversationId, status: 'waiting' });
    },

    applyMeta(meta: ChatToolUse): void {
      set({ meta });
    },

    appendDelta(text: string): void {
      buffer.append(text);
    },

    fail(message: string): void {
      set({ status: 'failed', text: get().text + buffer.flush(), errorMessage: message });
    },

    finish(): string {
      const text = get().text + buffer.flush();
      set({ status: 'complete', text });
      return text;
    },

    reset(): void {
      buffer.flush();
      set({ ...EMPTY_DRAFT });
    },
  };
}

/**
 * Build a draft store.
 *
 * @param scheduler Frame source for the commit throttle. Defaults to the platform's
 *                  animation frames; tests inject a manual one.
 * @returns A vanilla Zustand store. Bind it in React with `useStore(store, selector)`.
 */
export function createChatDraftStore(
  scheduler: FrameScheduler = defaultFrameScheduler,
): StoreApi<ChatDraftSlice> {
  return createStore<ChatDraftSlice>()((set, get) => {
    const buffer = createDraftBuffer(scheduler, (pending) => {
      set({ status: 'streaming', text: get().text + pending });
    });

    return { ...EMPTY_DRAFT, ...createDraftActions(set, get, buffer) };
  });
}

/** The app's single draft store. One reply streams at a time. */
export const chatDraftStore: StoreApi<ChatDraftSlice> = createChatDraftStore();

/** Stable selectors. Inline lambdas in components resubscribe on every render. */
export const selectDraftText = (state: ChatDraftState): string => state.text;
export const selectDraftStatus = (state: ChatDraftState): ChatDraftStatus => state.status;
export const selectDraftMeta = (state: ChatDraftState): ChatToolUse | null => state.meta;
export const selectDraftError = (state: ChatDraftState): string | null => state.errorMessage;
