/**
 * Component tests for a verse with badges spliced into it.
 *
 * This is the interaction the product exists for
 *   A pill inside flowing scripture, immediately after the word it annotates. Three things
 *   have to be true at once and only a render can show all three: the verse still reads as
 *   one uninterrupted sentence, the pill is a real control that names its own badge, and the
 *   row's geometry does not move when a badge appears.
 *
 * The geometry assertion, and why it is a class list
 *   react-native-web hoists every static style into an atomic CSS class and leaves only the
 *   dynamic ones inline, so the class list IS the layout. Comparing the row's boxes with and
 *   without a badge is therefore a real assertion that a pill appearing does not shift the
 *   text a reader is mid-sentence on — `flutter-port-map.md` §7.3's constant footprint.
 */

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

vi.mock(
  'react-native-reanimated',
  async () => (await import('../testing/reanimated-stub')).default,
);

import type { VerseBadgeAnchor } from '../model/verse-badges';
import { BOTH_THEMES, renderReader } from '../testing/render-reader';

import { VerseRow } from './VerseRow';

const VERSE =
  'So, setting sail from Troas, we made a direct voyage to Samothrace, and the following day to Neapolis.';

const TROAS_OFFSET = VERSE.indexOf('Troas');

const ROUTE_ANCHOR: VerseBadgeAnchor = {
  kind: 'route',
  word: 'Troas',
  startOffset: TROAS_OFFSET,
  badgeId: 'route~44016011~chapter:Acts.16',
};

/**
 * One verse row, with or without badges.
 *
 * @param anchors - Badges to splice in.
 * @param onBadgePress - What a pill press calls.
 * @returns The element. Side effects: none.
 */
function row(
  anchors: readonly VerseBadgeAnchor[],
  onBadgePress?: (badgeId: string) => void,
  onPress: (verseNumber: number) => void = () => undefined,
): ReactElement {
  return (
    <VerseRow
      verseNumber={11}
      text={VERSE}
      tone="rest"
      scriptureStep="md"
      anchors={anchors}
      reduceMotion
      onPress={onPress}
      onLongPress={() => undefined}
      {...(onBadgePress === undefined ? {} : { onBadgePress })}
    />
  );
}

/**
 * The row's boxes, as react-native-web expresses them.
 *
 * The badge's own nodes are excluded: the question is whether the *verse row* moved, not
 * whether a pill exists.
 *
 * @param container - The rendered container.
 * @returns One class list per box that belongs to the row itself. Side effects: none.
 */
function rowGeometry(container: HTMLElement): readonly string[] {
  return ['verse-bar-11', 'verse-gutter-11']
    .map((testId) => container.querySelector<HTMLElement>(`[data-testid="${testId}"]`))
    .map((node) => node?.className ?? 'missing');
}

describe.each(BOTH_THEMES)('a verse with inline badges — %s theme', (theme: ThemeName) => {
  it('renders the verse unchanged, character for character', () => {
    const view = renderReader(row([ROUTE_ANCHOR]), theme);
    const body = view.byTestId('verse-row-11')?.textContent ?? '';

    // The verse number leads, and the pill's own mark is inside the flow; removing the mark
    // must leave the scripture exactly as the translation printed it. The glyph is a vector
    // (`Q-021`), so it contributes no characters — the mark is `[Route]`.
    expect(body.replace('[Route]', '')).toContain(VERSE);
    view.unmount();
  });

  it('places the pill immediately after the word it annotates', () => {
    const view = renderReader(row([ROUTE_ANCHOR]), theme);
    const body = view.byTestId('verse-row-11')?.textContent ?? '';

    expect(body).toContain('Troas[Route]');
    view.unmount();
  });

  it('does not move the row when a badge appears', () => {
    const plain = renderReader(row([]), theme);
    const plainGeometry = rowGeometry(plain.container);
    plain.unmount();

    const annotated = renderReader(row([ROUTE_ANCHOR]), theme);
    expect(rowGeometry(annotated.container)).toEqual(plainGeometry);
    annotated.unmount();
  });

  it('makes the pill a control that opens its own badge', () => {
    const opened: string[] = [];
    const view = renderReader(
      row([ROUTE_ANCHOR], (badgeId) => {
        opened.push(badgeId);
      }),
      theme,
    );

    const pill = view.container.querySelector<HTMLElement>('[data-testid^="inline-badge-"]');
    pill?.click();

    expect(opened).toEqual(['route~44016011~chapter:Acts.16']);
    view.unmount();
  });

  it('opens the badge without also selecting the verse under it', () => {
    const opened: string[] = [];
    const selected: number[] = [];
    const view = renderReader(
      row(
        [ROUTE_ANCHOR],
        (badgeId) => {
          opened.push(badgeId);
        },
        (verseNumber) => {
          selected.push(verseNumber);
        },
      ),
      theme,
    );

    view.container.querySelector<HTMLElement>('[data-testid^="inline-badge-"]')?.click();

    expect(opened).toHaveLength(1);
    expect(selected).toEqual([]);
    view.unmount();
  });

  it('still selects the verse when the scripture itself is tapped', () => {
    const selected: number[] = [];
    const view = renderReader(
      row(
        [ROUTE_ANCHOR],
        () => undefined,
        (verseNumber) => {
          selected.push(verseNumber);
        },
      ),
      theme,
    );

    view.byTestId('verse-row-11')?.click();

    expect(selected).toEqual([11]);
    view.unmount();
  });

  it('leaves a pill with no badge behind it decorative rather than dead', () => {
    const opened: string[] = [];
    const view = renderReader(
      row([{ kind: 'route', word: 'Troas' }], (badgeId) => {
        opened.push(badgeId);
      }),
      theme,
    );

    view.container.querySelector<HTMLElement>('[data-testid^="inline-badge-"]')?.click();

    expect(opened).toEqual([]);
    expect(view.byTestId('verse-row-11')?.textContent).toContain('Route]');
    view.unmount();
  });

  it('never nests one control inside another on the web (Q-024)', () => {
    const view = renderReader(
      row([ROUTE_ANCHOR], () => undefined),
      theme,
    );
    const rowButton = view.byTestId('verse-row-11');

    expect(rowButton?.tagName.toLowerCase()).toBe('button');
    expect(rowButton?.querySelectorAll('button')).toHaveLength(0);
    view.unmount();
  });

  it('honours the per-verse density the canvas asked for', () => {
    const view = renderReader(
      row([ROUTE_ANCHOR, { kind: 'root', word: 'Samothrace', badgeId: 'root~44016011~6' }]),
      theme,
    );
    const body = view.byTestId('verse-row-11')?.textContent ?? '';

    expect(body).toContain('Route]');
    expect(body).toContain('Root]');
    view.unmount();
  });

  it('drops an anchor that does not match this translation rather than blanking the verse', () => {
    const view = renderReader(
      row([{ kind: 'route', word: 'Antioch', startOffset: 4, badgeId: 'x' }]),
      theme,
    );
    const body = view.byTestId('verse-row-11')?.textContent ?? '';

    expect(body).toContain(VERSE);
    expect(body).not.toContain('Route]');
    view.unmount();
  });
});
