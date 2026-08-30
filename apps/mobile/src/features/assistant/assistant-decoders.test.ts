/**
 * The assistant decoder, against the wire shape `AskOut` actually sends.
 *
 * The fixture is hand-written rather than captured from a live call
 * because a real answer needs a configured `OPENAI_API_KEY`/`OPENROUTER_API_KEY`
 * (see `docs/PROGRESS_TRACKER.md`'s M6 entry); the shape itself is small and stable
 * (`app/modules/assistant/presentation/schemas.py`), so it is asserted against directly.
 */

import { describe, expect, it } from 'vitest';

import { decodeAssistantAnswer } from './assistant-decoders';

const ASK_OUT_BODY = {
  answer: 'Lydia was a dealer in purple cloth from Thyatira who worshipped God.',
  citations: [
    { label: 'Acts 16:14', verse_key: 44016014, score: 0.91 },
    { label: 'Acts 16:15', verse_key: 44016015, score: 0.62 },
  ],
  confidence: 'high',
};

describe('decodeAssistantAnswer', () => {
  it('decodes a real AskOut body', () => {
    const result = decodeAssistantAnswer(ASK_OUT_BODY, '');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.answer).toBe(ASK_OUT_BODY.answer);
    expect(result.value.confidence).toBe('high');
    expect(result.value.citations).toEqual([
      { label: 'Acts 16:14', verseKey: 44016014, score: 0.91 },
      { label: 'Acts 16:15', verseKey: 44016015, score: 0.62 },
    ]);
  });

  it('accepts a citation with no resolvable verse key', () => {
    const result = decodeAssistantAnswer(
      { ...ASK_OUT_BODY, citations: [{ label: 'a passage spanning Acts 16:6-10', verse_key: null, score: 0.4 }] },
      '',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.citations[0]?.verseKey).toBeNull();
  });

  it('rejects an unknown confidence grade', () => {
    const result = decodeAssistantAnswer({ ...ASK_OUT_BODY, confidence: 'certain' }, '');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.path).toBe('confidence');
  });

  it('rejects a body with no citations array', () => {
    const result = decodeAssistantAnswer({ answer: 'x', confidence: 'low' }, '');

    expect(result.ok).toBe(false);
  });

  it('rejects an empty answer object', () => {
    const result = decodeAssistantAnswer({}, '');

    expect(result.ok).toBe(false);
  });
});
