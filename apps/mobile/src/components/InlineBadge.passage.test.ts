/**
 * Tests for the spike's fixture passage and its word expansion.
 *
 * Purpose
 *   The fixture only earns its place if it actually stresses what the spike is testing: all
 *   eleven badge kinds, badges deep enough into long verses that one lands on a wrap, and a word
 *   expansion that neither drops text nor splits a pill.
 */

import { describe, expect, it } from 'vitest';

import { badgeKinds } from '@/theme';

import {
  actsSixteenPassage,
  openingVerse,
  toPlainText,
  toWords,
  type PassageSegment,
} from './InlineBadge.passage';

/** The number of verses Acts 16:11-15 has. */
const VERSE_COUNT = 5;

/**
 * Every badge kind the fixture uses.
 *
 * @returns The set of kinds appearing as a badge anywhere in the passage.
 */
function usedKinds(): ReadonlySet<string> {
  return new Set(
    actsSixteenPassage.flatMap((verse) =>
      verse.segments.filter((segment) => segment.type === 'badge').map((segment) => segment.kind),
    ),
  );
}

describe('the fixture passage', () => {
  it('is Acts 16:11-15, numbered in order', () => {
    expect(actsSixteenPassage).toHaveLength(VERSE_COUNT);
    expect(actsSixteenPassage.map((verse) => verse.number)).toStrictEqual([11, 12, 13, 14, 15]);
  });

  it('exercises all eleven badge kinds, as the reference mockup does plus Lineage (Q-018)', () => {
    const used = usedKinds();
    for (const kind of badgeKinds) {
      expect(used.has(kind)).toBe(true);
    }
  });

  it('starts with the verse the size ladder renders', () => {
    expect(actsSixteenPassage[0]).toBe(openingVerse);
  });

  it('puts a badge immediately after the word it annotates', () => {
    // §5: the pill sits "immediately after the word it annotates", so every tinted run must
    // be followed by a badge of the same kind.
    for (const verse of actsSixteenPassage) {
      verse.segments.forEach((segment, index) => {
        if (segment.type !== 'tinted') {
          return;
        }
        const next: PassageSegment | undefined = verse.segments[index + 1];
        expect(next?.type).toBe('badge');
        expect(next?.type === 'badge' ? next.kind : undefined).toBe(segment.kind);
      });
    }
  });

  it('holds at least one verse long enough to force a badge onto a wrap', () => {
    const longest = Math.max(
      ...actsSixteenPassage.map((verse) => toPlainText(verse.segments).length),
    );
    expect(longest).toBeGreaterThan(120);
  });
});

describe('toWords', () => {
  it('keeps every badge as a single unbreakable entry', () => {
    for (const verse of actsSixteenPassage) {
      const badges = verse.segments.filter((segment) => segment.type === 'badge');
      const expanded = toWords(verse.segments).filter((word) => word.type === 'badge');
      expect(expanded).toHaveLength(badges.length);
    }
  });

  it('emits no empty words, which would render as stray gaps in the flex row', () => {
    for (const verse of actsSixteenPassage) {
      for (const word of toWords(verse.segments)) {
        if (word.type === 'word') {
          expect(word.text.trim()).toBe(word.text);
          expect(word.text.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('carries the annotated word tint through the expansion', () => {
    const tinted = toWords(openingVerse.segments).filter(
      (word) => word.type === 'word' && word.kind !== undefined,
    );
    expect(tinted).not.toHaveLength(0);
  });

  it('loses no characters, only the spacing between them', () => {
    for (const verse of actsSixteenPassage) {
      const rejoined = toWords(verse.segments)
        .filter((word) => word.type === 'word')
        .map((word) => word.text)
        .join('');
      expect(rejoined).toBe(toPlainText(verse.segments).replace(/ /g, ''));
    }
  });

  it('DETACHES punctuation that follows a badge — the known cost of the flex-wrap strategy', () => {
    // "Troas" [badge] ", we made..." expands to a bare "," token, which the row then spaces
    // away from the word it belongs to. Pinned deliberately: a production flex-wrap renderer
    // needs a tokeniser that glues trailing punctuation to the preceding word, and this test
    // is what will fail when someone writes one. See docs/architecture/spike-inline-badges.md.
    const rejoined = toWords(openingVerse.segments)
      .filter((word) => word.type === 'word')
      .map((word) => word.text)
      .join(' ');
    expect(rejoined).toContain('Troas ,');
    expect(toPlainText(openingVerse.segments)).toContain('Troas,');
  });
});

describe('toPlainText', () => {
  it('drops the badges and keeps the scripture', () => {
    const text = toPlainText(openingVerse.segments);
    expect(text).toContain('Troas');
    expect(text).toContain('Samothrace');
    expect(text).not.toContain('[');
  });

  it('collapses the seam between adjacent runs to a single space', () => {
    expect(toPlainText(openingVerse.segments)).not.toMatch(/\s{2}/);
  });
});
