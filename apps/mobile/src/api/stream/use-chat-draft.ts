/**
 * React bindings for the streaming draft store.
 *
 * Purpose
 *   Gives the streaming bubble four narrow hooks instead of one wide one. Each subscribes
 *   to a single field, so a component that only shows tool chips does not re-render when
 *   text arrives, and a component that only shows text does not re-render when the status
 *   changes. This is the component-level half of the answer to
 *   `docs/architecture/flutter-port-map.md` risk #2.
 *
 * Key responsibilities
 *   - Expose one hook per selectable field, each with a module-level stable selector.
 *   - Give the consumer no way to subscribe to the whole draft object by accident.
 *
 * The rule
 *   Call these from the streaming bubble and its immediate children only. A screen, a
 *   layout, a tab bar or a list container that calls any of them re-renders on every
 *   frame of every stream — the exact cost this module exists to avoid. If a parent needs
 *   to know a stream is running, read the *conversation* store, which changes twice a
 *   turn, not sixty times a second.
 */

import { useStore } from 'zustand';

import type { ChatToolUse } from './chat-events';
import {
  chatDraftStore,
  selectDraftError,
  selectDraftMeta,
  selectDraftStatus,
  selectDraftText,
  type ChatDraftStatus,
} from './chat-draft-store';

/**
 * Subscribe to the draft text.
 *
 * @returns The text committed so far. Changes at most once per animation frame.
 */
export function useDraftText(): string {
  return useStore(chatDraftStore, selectDraftText);
}

/**
 * Subscribe to the draft's lifecycle status.
 *
 * @returns `idle` before a turn, `waiting` while the skeleton shows, `streaming` from the
 *          first token, then `complete` or `failed`. Changes three times per turn.
 */
export function useDraftStatus(): ChatDraftStatus {
  return useStore(chatDraftStore, selectDraftStatus);
}

/**
 * Subscribe to the tool-use frame.
 *
 * @returns The `meta` payload, available before the first token, or `null`.
 */
export function useDraftMeta(): ChatToolUse | null {
  return useStore(chatDraftStore, selectDraftMeta);
}

/**
 * Subscribe to the failure message.
 *
 * @returns The message set by `fail`, or `null` while the turn is healthy.
 */
export function useDraftError(): string | null {
  return useStore(chatDraftStore, selectDraftError);
}
