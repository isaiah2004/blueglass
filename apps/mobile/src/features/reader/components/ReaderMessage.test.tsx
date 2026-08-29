/**
 * Component tests for the reader's non-content states.
 *
 * The point being defended is `flutter-port-map.md` §7.4: the prototype kept loading, "no
 * content here", and a genuine error visually distinct, and "most rewrites collapse these
 * three into one". These tests fail if they are ever collapsed, and they fail if a Retry
 * button appears where retrying cannot help.
 */

import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock(
  'react-native-reanimated',
  async () => (await import('../testing/reanimated-stub')).default,
);

import { httpError, malformedResponseError, networkError } from '@/api';
import { EMPTY_CHAPTER_COPY, readerStatusCopy } from '../model/reader-status';
import { BOTH_THEMES, renderReader } from '../testing/render-reader';

import { ReaderMessage } from './ReaderMessage';

/**
 * The message screen for one failure kind.
 *
 * @param copy - The copy the model produced.
 * @param onAction - Optional handler; omitted to prove the button disappears without one.
 * @returns The element. Side effects: none.
 */
function message(copy: ReturnType<typeof readerStatusCopy>, onAction?: () => void): ReactElement {
  return <ReaderMessage {...copy} {...(onAction === undefined ? {} : { onAction })} />;
}

describe.each(BOTH_THEMES)('ReaderMessage in the %s theme', (theme: ThemeName) => {
  it('renders the offline state with its own title and a Retry', () => {
    const copy = readerStatusCopy(networkError(new TypeError('Failed to fetch')));
    const view = renderReader(
      message(copy, () => undefined),
      theme,
    );

    expect(view.byTestId('reader-offline')).not.toBeNull();
    expect(view.text()).toContain('No connection');
    expect(view.text()).toContain('Retry');
    view.unmount();
  });

  it('renders a wrong address with a way out rather than a Retry', () => {
    const copy = readerStatusCopy(
      httpError({ status: 404, code: 'book_not_found', message: 'Unknown book.' }),
    );
    const view = renderReader(
      message(copy, () => undefined),
      theme,
    );

    expect(view.byTestId('reader-notFound')).not.toBeNull();
    expect(view.text()).not.toContain('Retry');
    view.unmount();
  });

  it('renders a fault distinctly from an empty chapter', () => {
    const fault = renderReader(
      message(readerStatusCopy(malformedResponseError('chapter.verses[3].verse_key', 'a number'))),
      theme,
    );
    const empty = renderReader(message(EMPTY_CHAPTER_COPY), theme);

    expect(fault.byTestId('reader-error')).not.toBeNull();
    expect(empty.byTestId('reader-empty')).not.toBeNull();
    expect(fault.text()).not.toBe(empty.text());

    fault.unmount();
    empty.unmount();
  });

  it('hides the action entirely when there is no handler for it', () => {
    const copy = readerStatusCopy(networkError(new Error('x')));
    const view = renderReader(message(copy), theme);

    expect(view.byTestId('reader-message-action')).toBeNull();
    view.unmount();
  });

  it('calls the action when it is pressed', () => {
    const onAction = vi.fn();
    const view = renderReader(
      message(readerStatusCopy(malformedResponseError('x', 'y')), onAction),
      theme,
    );

    view.byTestId('reader-message-action')?.click();
    expect(onAction).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('announces itself as an alert', () => {
    const view = renderReader(message(EMPTY_CHAPTER_COPY), theme);
    expect(view.byRole('alert').length).toBeGreaterThan(0);
    view.unmount();
  });

  it('never shows a reader a status code or a URL', () => {
    for (const failure of [
      networkError(new TypeError('Failed to fetch http://localhost:8010/chapters')),
      httpError({ status: 500, code: 'internal_error', message: 'boom' }),
      malformedResponseError('chapter.verses[3].verse_key', 'a number'),
    ]) {
      const view = renderReader(
        message(readerStatusCopy(failure), () => undefined),
        theme,
      );
      expect(view.text()).not.toMatch(/https?:\/\//);
      expect(view.text()).not.toMatch(/\b[45]\d{2}\b/);
      view.unmount();
    }
  });
});
