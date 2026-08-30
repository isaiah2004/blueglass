/**
 * The Studio Assistant's client — barrel export.
 *
 * See `assistant-api.ts`, `assistant-models.ts`, `assistant-decoders.ts` and
 * `use-ask-assistant.ts` for the pieces this re-exports.
 */

export { assistantApi, createAssistantApi, type AssistantApi } from './assistant-api';
export { decodeAssistantAnswer } from './assistant-decoders';
export type { AssistantAnswer, AssistantCitation, GroundingConfidence } from './assistant-models';
export {
  useAskAssistantMutation,
  type AskAssistantOptions,
} from './use-ask-assistant';
