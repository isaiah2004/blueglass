/**
 * Ask the Studio Assistant one question.
 *
 * Purpose
 *   The one write in this app that costs real money per call, which is exactly why it
 *   is a `useMutation` and not a `useQuery`: nothing here should be retried, refetched
 *   on refocus, or deduplicated behind a cache key the way a chapter read is. A tap
 *   asks; asking twice must be the reader's choice, never TanStack Query's.
 *
 * Why it throws {@link AtlasApiException} rather than returning a result
 *   `useMutation`'s own `error` field is the idiomatic place a component reads a
 *   failure — same bridge `use-scripture-queries.ts` and `use-service-queries.ts` use
 *   for reads, kept consistent here for a write.
 *
 * Dependencies
 *   `@tanstack/react-query`, `@/api`, and this folder's API and models.
 */

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { AtlasApiException, unwrapForQuery } from '@/api';

import { assistantApi, type AssistantApi } from './assistant-api';
import type { AssistantAnswer } from './assistant-models';

/** Overrides the hook accepts. Tests pass a double rather than a server. */
export interface AskAssistantOptions {
  /** The API to call. Defaults to the app's. */
  readonly api?: AssistantApi | undefined;
}

/**
 * The mutation that asks one question.
 *
 * @param options - Overrides.
 * @returns The mutation. Call `.mutate(question)` or `await .mutateAsync(question)`.
 *          `.error`, when set, is always an {@link AtlasApiException} — branch on
 *          `.failure.kind`, never on `.message`.
 */
export function useAskAssistantMutation(
  options: AskAssistantOptions = {},
): UseMutationResult<AssistantAnswer, AtlasApiException, string> {
  const api = options.api ?? assistantApi;
  return useMutation<AssistantAnswer, AtlasApiException, string>({
    mutationFn: async (question: string) => unwrapForQuery(await api.ask(question)),
  });
}
