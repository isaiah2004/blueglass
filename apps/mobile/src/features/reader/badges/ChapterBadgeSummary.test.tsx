/**
 * Component tests for the chapter-end badge summary.
 *
 * Why this list is worth testing rather than eyeballing
 *   It is the route to context for the reader who never taps mid-verse, which is most
 *   readers. If it silently renders nothing — for a chapter that has badges, or for a badge
 *   whose teaser is empty — the feature is gone and the reading canvas looks the same, so
 *   nothing else in the app would notice.
 *
 * Both themes
 *   `D-01`: light mode actually ships, so every assertion runs under both palettes.
 */

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

// `@/theme/runtime` re-exports the font loader, which reaches `expo-modules-core` and its
// native globals. Vitest hoists this above every import below.
vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import { BOTH_THEMES, renderReader } from '../testing/render-reader';

import { decodeChapterBadges } from './badge-decoders';
import type { ChapterBadges } from './badge-models';
import { ChapterBadgeSummary } from './ChapterBadgeSummary';
import { ACTS_16_BADGES } from './testing/badge-fixtures';

/** The captured Acts 16 response, decoded. */
function fixture(): ChapterBadges {
  const decoded = decodeChapterBadges(ACTS_16_BADGES, '');
  if (!decoded.ok) throw new Error('the Acts 16 fixture did not decode');
  return decoded.value;
}

/**
 * The summary over the fixture.
 *
 * @param onOpen - What a row press calls.
 * @returns The element. Side effects: none.
 */
function summary(onOpen: (badgeId: string) => void = () => undefined): ReactElement {
  const chapter = fixture();
  return <ChapterBadgeSummary badges={chapter.badges} sources={chapter.sources} onOpen={onOpen} />;
}

describe.each(BOTH_THEMES)('ChapterBadgeSummary — %s theme', (theme: ThemeName) => {
  it('lists every badge the chapter delivered', () => {
    const view = renderReader(summary(), theme);

    expect(view.byRole('button')).toHaveLength(fixture().badges.length);
    view.unmount();
  });

  it('shows each badge as a bracketed mark beside its teaser', () => {
    const view = renderReader(summary(), theme);
    const text = view.text();

    expect(text).toContain('Route]');
    expect(text).toContain('Site]');
    // "Derbe to Thyatira" until the fixture was re-captured: the server stopped titling the
    // chapter route as a journey when it turned out no dataset says Paul made one, and the
    // stale fixture kept the retracted claim alive in this assertion.
    expect(text).toContain('15 places named in this chapter');
    expect(text).toContain('Samothrace');
    view.unmount();
  });

  it('prints the chapter attribution beneath the list (AI-05)', () => {
    const view = renderReader(summary(), theme);

    expect(view.byTestId('chapter-badge-sources')).not.toBeNull();
    for (const source of fixture().sources) {
      expect(view.text()).toContain(source.attribution);
    }
    expect(view.text()).toContain('Place data © OpenBible.info, CC BY 4.0');
    view.unmount();
  });

  it('marks a share-alike source as such rather than hiding the obligation', () => {
    const chapter = fixture();
    const shareAlike = chapter.sources.filter((source) => source.shareAlike);
    const view = renderReader(
      <ChapterBadgeSummary
        badges={chapter.badges}
        sources={chapter.sources}
        onOpen={() => undefined}
      />,
      theme,
    );

    if (shareAlike.length > 0) {
      expect(view.text()).toContain('share-alike');
    }
    view.unmount();
  });

  it('opens the badge whose row was pressed', () => {
    const opened: string[] = [];
    const view = renderReader(
      summary((badgeId) => {
        opened.push(badgeId);
      }),
      theme,
    );

    const first = fixture().badges[0];
    if (first === undefined) throw new Error('the fixture is empty');
    view.byTestId(`badge-summary-row-${first.id}`)?.click();

    expect(opened).toEqual([first.id]);
    view.unmount();
  });

  it('clamps a teaser at three lines, not two, so none loses its last word', () => {
    const view = renderReader(summary(), theme);

    // `numberOfLines` reaches the DOM as an inline `-webkit-line-clamp`, which is what the
    // browser measurement was taken against. At two, the 375 dp column cut the longest live
    // teasers mid-word — Galatians 3's `used once in th…` and two of Acts 16's Root rows —
    // and a counted claim that stops mid-word is not one the reader can check.
    const clamped = [...view.container.querySelectorAll('[style*="line-clamp"]')];

    expect(clamped).toHaveLength(fixture().badges.length);
    for (const teaser of clamped) {
      expect(teaser.getAttribute('style')).toContain('-webkit-line-clamp: 3');
    }
    view.unmount();
  });

  it('renders nothing at all for a chapter with no enrichment', () => {
    const view = renderReader(
      <ChapterBadgeSummary badges={[]} sources={[]} onOpen={() => undefined} />,
      theme,
    );

    expect(view.byTestId('chapter-badge-summary')).toBeNull();
    expect(view.text()).toBe('');
    view.unmount();
  });
});
