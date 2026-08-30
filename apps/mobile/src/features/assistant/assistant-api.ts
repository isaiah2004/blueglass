/**
 * The Studio Assistant endpoint, as one typed method.
 *
 * Purpose
 *   `POST /assistant/ask` — one grounded question in, one answer with citations and a
 *   confidence grade out. Lives beside its own models and decoder, the same shape
 *   `badge-api.ts` uses for the reading canvas's enrichment call.
 *
 * Why `NO_RETRY_POLICY`
 *   Every call is billed (`ai_spend_ledger`, migration `0014`) and every retry would ask
 *   the model again — a transient failure must surface as a failure, not as the app
 *   quietly asking (and paying for) the question twice (rule 6.4.2: retries are only
 *   for idempotent requests).
 *
 * Dependencies
 *   `@/api` for the client, the result type and `NO_RETRY_POLICY`, and this folder's
 *   decoder.
 */

import { atlasHttpClient, NO_RETRY_POLICY, type ApiResult, type HttpClient } from '@/api';

import { decodeAssistantAnswer } from './assistant-decoders';
import type { AssistantAnswer } from './assistant-models';

/** The assistant surface. One method: ask a question, get a grounded answer. */
export interface AssistantApi {
  ask(
    question: string,
    options?: { readonly signal?: AbortSignal | undefined },
  ): Promise<ApiResult<AssistantAnswer>>;
}

/**
 * Bind the assistant endpoint to a transport.
 *
 * @param client - The HTTP client to call through. Defaults to the app's.
 * @returns The assistant API. Side effects: none until a method is called.
 */
export function createAssistantApi(client: HttpClient = atlasHttpClient): AssistantApi {
  return {
    ask(question, options = {}): Promise<ApiResult<AssistantAnswer>> {
      return client.request({
        path: '/assistant/ask',
        method: 'POST',
        body: { question },
        decode: decodeAssistantAnswer,
        policy: NO_RETRY_POLICY,
        signal: options.signal,
      });
    },
  };
}

/** The app's assistant API, bound to the shared client. */
export const assistantApi: AssistantApi = createAssistantApi();
