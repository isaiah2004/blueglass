/**
 * Component tests for the reference picker.
 *
 * `flutter-port-map.md` §7.6 asks for this to be ported faithfully, and names the parts
 * that make it fast: two steps rather than a wheel, a query that normalises away spaces,
 * and Enter jumping straight to the first match. Those three are asserted here; the
 * matching rules themselves are `model/book-filter.test.ts`.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CANONICAL_BOOK_COUNT } from '@atlas/shared';
import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock(
  'react-native-reanimated',
  async () => (await import('../testing/reanimated-stub')).default,
);

import { actSync } from '@/testing/render';

import { BOTH_THEMES, renderReader, resetDocument } from '../testing/render-reader';

import { BookNavigator } from './BookNavigator';

afterEach(resetDocument);

/**
 * Types into the search field the way a browser does.
 *
 * @param input - The rendered field.
 * @param value - What to type.
 * Side effects: dispatches an `input` event, so React's onChange fires.
 */
function type(input: HTMLInputElement, value: string): void {
  // React installs its own `value` setter on the element, so assigning `input.value`
  // directly is invisible to it. Going through the prototype's setter is the standard way
  // to make a controlled input see typed text.
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis.HTMLInputElement.prototype,
    'value',
  );
  const setValue = descriptor?.set?.bind(input);

  actSync(() => {
    setValue?.(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe.each(BOTH_THEMES)('BookNavigator in the %s theme', (theme: ThemeName) => {
  it('lists the whole canon before anything is typed', () => {
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={() => undefined} />,
      theme,
    );

    expect(view.container.querySelectorAll('[data-testid^="book-row-"]')).toHaveLength(
      CANONICAL_BOOK_COUNT,
    );
    view.unmount();
  });

  it('narrows to one book on a query that ignores spaces', () => {
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={() => undefined} />,
      theme,
    );

    const search = view.byTestId('book-search') as HTMLInputElement | null;
    expect(search).not.toBeNull();
    if (search === null) return;

    type(search, '1 c o r');
    const books = [...view.container.querySelectorAll('[data-testid^="book-row-"]')];
    expect(books).toHaveLength(1);
    expect(view.text()).toContain('1 Corinthians');
    view.unmount();
  });

  it('opens the current book’s chapter grid without being asked', () => {
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={() => undefined} />,
      theme,
    );

    // John has 21 chapters; the grid should already be showing them.
    expect(view.byTestId('chapter-grid')).not.toBeNull();
    expect(view.byTestId('chapter-tile-21')).not.toBeNull();
    expect(view.byTestId('chapter-tile-22')).toBeNull();
    view.unmount();
  });

  it('reports the book and chapter a tile selects', () => {
    const onSelect = vi.fn();
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={onSelect} />,
      theme,
    );

    view.byTestId('chapter-tile-11')?.click();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0]?.[0]).toMatchObject({ name: 'John' });
    expect(onSelect.mock.calls[0]?.[1]).toBe(11);
    view.unmount();
  });

  it('filters to one testament from the pills', () => {
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={() => undefined} />,
      theme,
    );

    actSync(() => {
      view.byTestId('testament-ot')?.click();
    });
    const books = [...view.container.querySelectorAll('[data-testid^="book-row-"]')];
    expect(books).toHaveLength(39);
    view.unmount();
  });

  it('says so when nothing matches, rather than showing an empty list', () => {
    const view = renderReader(
      <BookNavigator currentBookNumber={43} currentChapter={3} onSelect={() => undefined} />,
      theme,
    );

    const search = view.byTestId('book-search') as HTMLInputElement | null;
    if (search === null) return;
    type(search, 'hezekiah');

    expect(view.text()).toContain('No book matches');
    view.unmount();
  });
});
