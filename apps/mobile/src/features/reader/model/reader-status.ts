/**
 * What the reader is told when there is no scripture to show.
 *
 * Purpose
 *   `@/api` produces five typed failures. A reader does not need five screens — they need
 *   to know which of three things happened and what to do next: the network is gone, the
 *   address is wrong, or Atlas is at fault. This module is the mapping, kept here rather
 *   than in the component so it is testable and so the states cannot be collapsed by
 *   accident — which is exactly the failure `flutter-port-map.md` §7.4 warns about.
 *
 * Copy rules, enforced by the tests beside this file
 *   - Never a status code, a URL, a request id, or a decoder path.
 *   - Always a next step: Retry when retrying can help, otherwise a way back to scripture.
 *   - The server's own message wins when it is the specific one, because "John has 21
 *     chapters" is help and "Something went wrong" is not.
 *
 * Dependencies
 *   `@/api` for the failure union. No React, no I/O.
 */

import type { ApiError } from '@/api';

/** Which of the reader's non-content states a screen is. */
export type ReaderMessageTone = 'empty' | 'offline' | 'error' | 'notFound';

/** Everything a message screen renders. */
export interface ReaderStatusCopy {
  readonly tone: ReaderMessageTone;
  readonly title: string;
  readonly body: string;
  /** Label of the primary action, or `null` when there is none. */
  readonly actionLabel: string | null;
}

/** Shown when a chapter loaded successfully but holds no verses. */
export const EMPTY_CHAPTER_COPY: ReaderStatusCopy = Object.freeze({
  tone: 'empty',
  title: 'Nothing here yet',
  body: 'This chapter has no verses in the selected translation. Try another translation.',
  actionLabel: 'Change translation',
});

/**
 * Shown when the route names a book or chapter that does not exist.
 *
 * @param message - The specific reason, from the API or from address resolution. It is
 *   already a complete sentence, so it becomes the body verbatim.
 * @returns The message screen's copy. Side effects: none.
 */
export function badAddressCopy(message: string): ReaderStatusCopy {
  return {
    tone: 'notFound',
    title: 'That passage does not exist',
    body: message,
    actionLabel: 'Open another passage',
  };
}

/** Server error codes that mean "you asked for a passage that is not there". */
const ADDRESS_CODES: ReadonlySet<string> = new Set([
  'book_not_found',
  'chapter_not_found',
  'chapter_out_of_range',
  'translation_not_found',
]);

/** Statuses that mean the request was wrong rather than the server broken. */
const ADDRESS_STATUSES: ReadonlySet<number> = new Set([400, 404, 422]);

/** The screen for a failure that never reached a server. */
const OFFLINE_COPY: ReaderStatusCopy = Object.freeze({
  tone: 'offline',
  title: 'No connection',
  body: 'We can’t reach Atlas right now. Check your connection and retry.',
  actionLabel: 'Retry',
});

/** The screen for a response that did not match the contract. */
const MALFORMED_COPY: ReaderStatusCopy = Object.freeze({
  tone: 'error',
  title: 'That did not arrive intact',
  body: 'The passage came back in a shape we did not expect. Trying again usually fixes it.',
  actionLabel: 'Retry',
});

/** The screen for a server fault that said nothing useful. */
const SERVER_COPY: ReaderStatusCopy = Object.freeze({
  tone: 'error',
  title: 'Atlas had a problem',
  body: 'Atlas could not load this passage. Try again in a moment.',
  actionLabel: 'Retry',
});

/**
 * Whether an HTTP failure is about the address rather than about the server.
 *
 * The code is checked before the status because it is the stable contract — the server
 * may answer 404 or 422 for the same wrong chapter depending on how it failed to resolve.
 *
 * @param error - The HTTP failure.
 * @returns True when a different passage, not a retry, is the way out. Side effects: none.
 */
function isWrongAddress(error: Extract<ApiError, { kind: 'http' }>): boolean {
  return ADDRESS_CODES.has(error.code) || ADDRESS_STATUSES.has(error.status);
}

/**
 * The screen for a failed read.
 *
 * @param error - The typed failure from `@/api`.
 * @returns Tone, title, body and action for the message screen. Side effects: none.
 */
export function readerStatusCopy(error: ApiError): ReaderStatusCopy {
  switch (error.kind) {
    case 'timeout':
    case 'network':
    case 'aborted':
      return OFFLINE_COPY;
    case 'malformed':
      return MALFORMED_COPY;
    case 'http':
      return isWrongAddress(error) ? badAddressCopy(error.message) : SERVER_COPY;
  }
}
