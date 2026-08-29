/**
 * Tests for original-language rendering.
 *
 * What is worth asserting here
 *   The two failure modes that a screenshot of the Greek data would never reveal, because
 *   no Hebrew `[Root]` badge exists yet: a Hebrew lemma must not be handed the Latin-and-
 *   Greek serif, and it must be laid out right to left. Both are one boolean away from
 *   being wrong, and both would ship silently.
 */

import { describe, expect, it } from 'vitest';

import { scriptureText } from '@/theme';

import type { OriginalLanguage } from '../model/textual-payloads';
import {
  isRightToLeft,
  languageLabel,
  lemmaAccessibilityLabel,
  originalTextStyle,
  scriptDirection,
  strongsLabel,
} from './original-language';

const RTL_LANGUAGES: readonly OriginalLanguage[] = ['hebrew', 'aramaic'];

describe('isRightToLeft', () => {
  it.each(RTL_LANGUAGES)('is true for %s', (language) => {
    expect(isRightToLeft(language)).toBe(true);
  });

  it('is false for Greek', () => {
    expect(isRightToLeft('greek')).toBe(false);
  });
});

describe('scriptDirection', () => {
  it('lays Greek out left to right', () => {
    expect(scriptDirection('greek')).toBe('ltr');
  });

  it.each(RTL_LANGUAGES)('lays %s out right to left', (language) => {
    expect(scriptDirection(language)).toBe('rtl');
  });
});

describe('originalTextStyle', () => {
  it('sets Greek in the scripture serif, per design-language §8.4', () => {
    expect(originalTextStyle('greek').fontFamily).toBe(scriptureText('display').fontFamily);
  });

  it.each(RTL_LANGUAGES)(
    'names no font family for %s, which the serif does not cover',
    (language) => {
      const style = originalTextStyle(language);

      // Absent, not `undefined`: an explicit key would reach React Native and re-introduce
      // the missing-glyph problem this omission exists to avoid.
      expect(Object.hasOwn(style, 'fontFamily')).toBe(false);
    },
  );

  it.each(RTL_LANGUAGES)('aligns %s to the right', (language) => {
    const style = originalTextStyle(language);

    expect(style.writingDirection).toBe('rtl');
    expect(style.textAlign).toBe('right');
  });

  it('keeps the token metrics of the step it was asked for', () => {
    const token = scriptureText('title');
    const style = originalTextStyle('greek', 'title');

    expect(style.fontSize).toBe(token.fontSize);
    expect(style.lineHeight).toBe(token.lineHeight);
  });
});

describe('languageLabel', () => {
  it('names each language for the UI', () => {
    expect([languageLabel('greek'), languageLabel('hebrew'), languageLabel('aramaic')]).toEqual([
      'Greek',
      'Hebrew',
      'Aramaic',
    ]);
  });
});

describe('strongsLabel', () => {
  it('keeps the language prefix, which is what disambiguates the number', () => {
    expect(strongsLabel('G4211')).toBe("Strong's G4211");
    expect(strongsLabel('H0430')).toBe("Strong's H0430");
  });
});

describe('lemmaAccessibilityLabel', () => {
  it('names the language before the word', () => {
    expect(lemmaAccessibilityLabel('πορφυρόπωλις', 'greek')).toBe('Greek: πορφυρόπωλις');
  });

  it('adds the transliteration when the lexicon has one', () => {
    expect(lemmaAccessibilityLabel('שָׁלוֹם', 'hebrew', 'shalom')).toBe(
      'Hebrew: שָׁלוֹם, transliterated shalom',
    );
  });

  it('ignores a blank transliteration', () => {
    expect(lemmaAccessibilityLabel('κολωνία', 'greek', '  ')).toBe('Greek: κολωνία');
  });
});
