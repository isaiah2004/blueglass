/**
 * Component tests for the translation switcher (decision `S-01`).
 *
 * The load-bearing assertion is negative: the sheet renders exactly the translations the
 * API sent and never adds one. ESV appears in the mockups, is licensed, and must never
 * ship — the defence is that nothing in the client can invent a translation, and this test
 * is what proves the defence rather than asserting the intention.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));
vi.mock(
  'react-native-reanimated',
  async () => (await import('../testing/reanimated-stub')).default,
);

import type { ApiTranslation } from '@/api';
import { BOTH_THEMES, inDocument, renderReader, resetDocument } from '../testing/render-reader';

import { TranslationSheet } from './TranslationSheet';

/** The four translations the running API actually serves. */
const TRANSLATIONS: readonly ApiTranslation[] = [
  { code: 'BSB', name: 'Berean Standard Bible', language: 'en', canRedistribute: true },
  { code: 'ASV', name: 'American Standard Version (1901)', language: 'en', canRedistribute: true },
  { code: 'KJV', name: 'King James (Authorized) Version', language: 'en', canRedistribute: true },
  { code: 'WEB', name: 'World English Bible', language: 'en', canRedistribute: true },
];

afterEach(resetDocument);

describe.each(BOTH_THEMES)('TranslationSheet in the %s theme', (theme: ThemeName) => {
  it('lists every translation the API supplied, by its full name', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={TRANSLATIONS}
        selectedCode="BSB"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    for (const translation of TRANSLATIONS) {
      expect(inDocument.text()).toContain(translation.name);
    }
    view.unmount();
  });

  it('renders no translation the API did not send — ESV must never appear', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={TRANSLATIONS}
        selectedCode="BSB"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    expect(inDocument.text()).not.toContain('ESV');
    expect(inDocument.text()).not.toContain('English Standard');
    expect(inDocument.all('[data-testid^="translation-option-"]')).toHaveLength(
      TRANSLATIONS.length,
    );
    view.unmount();
  });

  it('marks the open translation as selected, and only that one', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={TRANSLATIONS}
        selectedCode="KJV"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    const selected = inDocument.all('[aria-checked="true"]');
    expect(selected).toHaveLength(1);
    expect(inDocument.byTestId('translation-option-KJV')?.getAttribute('aria-checked')).toBe(
      'true',
    );
    view.unmount();
  });

  it('reports the chosen code when a row is pressed', () => {
    const onSelect = vi.fn();
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={TRANSLATIONS}
        selectedCode="BSB"
        onSelect={onSelect}
        onClose={() => undefined}
      />,
      theme,
    );

    inDocument.byTestId('translation-option-WEB')?.click();
    expect(onSelect).toHaveBeenCalledWith('WEB');
    view.unmount();
  });

  it('says so while the list is loading rather than showing an empty sheet', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading
        translations={undefined}
        selectedCode="BSB"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    expect(inDocument.text()).toContain('Loading translations');
    view.unmount();
  });

  it('explains an empty list instead of rendering nothing', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={[]}
        selectedCode="BSB"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    expect(inDocument.text()).toContain('No translations are loaded');
    view.unmount();
  });

  it('labels a licence-restricted translation from the API flag, never from a guess', () => {
    const view = renderReader(
      <TranslationSheet
        visible
        loading={false}
        translations={[
          { code: 'XYZ', name: 'Restricted Text', language: 'en', canRedistribute: false },
        ]}
        selectedCode="BSB"
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
      theme,
    );

    expect(inDocument.text()).toContain('Server-delivered only');
    view.unmount();
  });
});
