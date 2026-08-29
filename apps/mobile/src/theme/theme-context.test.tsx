/**
 * The theme provider.
 *
 * `D-01` asks for three things a token file cannot deliver on its own: a light theme that
 * really renders, a switcher, and a choice that survives a relaunch. These are the tests
 * for the machinery between them — everything that would still let a correct palette ship
 * as a preference nothing consumes.
 */

import { describe, expect, it } from 'vitest';
import { Pressable, Text, View } from 'react-native';
import type { JSX } from 'react';

import { createMemoryKeyValueStore, THEME_PREFERENCE_STORAGE_KEY } from '@/api/storage';

import { actSync, flush, renderComponent } from '../testing/render';
import { darkTheme } from './colors';
import { lightTheme } from './light-colors';
import { ThemeProvider, useTheme, useThemeController } from './theme-context';

/** Renders the active palette's name and a control that changes it. */
function Probe(): JSX.Element {
  const theme = useTheme();
  const { preference, isHydrated, setPreference } = useThemeController();

  return (
    <View>
      <Text testID="name">{theme.name}</Text>
      <Text testID="canvas">{theme.background.canvas}</Text>
      <Text testID="preference">{preference}</Text>
      <Text testID="hydrated">{String(isHydrated)}</Text>
      <Pressable
        testID="to-light"
        accessibilityRole="button"
        onPress={() => {
          setPreference('light');
        }}
      />
    </View>
  );
}

describe('the provider', () => {
  it('renders the dark palette by default', () => {
    const rendered = renderComponent(
      <ThemeProvider initialPreference="dark">
        <Probe />
      </ThemeProvider>,
    );

    expect(rendered.byTestId('name')?.textContent).toBe('dark');
    expect(rendered.byTestId('canvas')?.textContent).toBe(darkTheme.background.canvas);
    rendered.unmount();
  });

  it('renders the light palette when the preference says so', () => {
    const rendered = renderComponent(
      <ThemeProvider initialPreference="light">
        <Probe />
      </ThemeProvider>,
    );

    expect(rendered.byTestId('name')?.textContent).toBe('light');
    expect(rendered.byTestId('canvas')?.textContent).toBe(lightTheme.background.canvas);
    rendered.unmount();
  });

  it('swaps every colour, not just the canvas', () => {
    // The failure `D-01` exists to prevent: a canvas that inverts while the ink does not,
    // leaving near-white scripture on a near-white page.
    expect(lightTheme.ink.primary).not.toBe(darkTheme.ink.primary);
    expect(lightTheme.accent.cyan).not.toBe(darkTheme.accent.cyan);
  });
});

describe('persistence', () => {
  it('reads a stored preference back on mount', async () => {
    const store = createMemoryKeyValueStore();
    await store.setString(THEME_PREFERENCE_STORAGE_KEY, 'light');

    const rendered = renderComponent(
      <ThemeProvider store={store}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();

    expect(rendered.byTestId('preference')?.textContent).toBe('light');
    expect(rendered.byTestId('name')?.textContent).toBe('light');
    expect(rendered.byTestId('hydrated')?.textContent).toBe('true');
    rendered.unmount();
  });

  it('falls back to the default when the stored value is rubbish', async () => {
    const store = createMemoryKeyValueStore();
    await store.setString(THEME_PREFERENCE_STORAGE_KEY, 'sepia');

    const rendered = renderComponent(
      <ThemeProvider store={store}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();

    // Persisted data is untrusted input. A hand-edited `localStorage` must not render an
    // undefined palette, which in React Native is a blank screen rather than an error.
    expect(rendered.byTestId('preference')?.textContent).toBe('dark');
    expect(rendered.byTestId('name')?.textContent).toBe('dark');
    rendered.unmount();
  });

  it('writes the choice through so the next launch honours it', async () => {
    const store = createMemoryKeyValueStore();

    const rendered = renderComponent(
      <ThemeProvider store={store}>
        <Probe />
      </ThemeProvider>,
    );
    await flush();

    // react-native-web maps `onPress` onto the DOM's click, so a click is the honest way to
    // press a `Pressable` here — and is the same event the Playwright walkthrough sends.
    actSync(() => {
      rendered.byTestId('to-light')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();

    expect(rendered.byTestId('name')?.textContent).toBe('light');
    await expect(store.getString(THEME_PREFERENCE_STORAGE_KEY)).resolves.toBe('light');
    rendered.unmount();
  });

  it('paints before the stored preference has arrived, rather than blocking on it', () => {
    const rendered = renderComponent(
      <ThemeProvider store={createMemoryKeyValueStore()}>
        <Probe />
      </ThemeProvider>,
    );

    // The store is a promise on every platform. Holding the first paint for it would cost a
    // frame for a value that is dark by default anyway.
    expect(rendered.byTestId('name')?.textContent).toBe('dark');
    expect(rendered.byTestId('hydrated')?.textContent).toBe('false');
    rendered.unmount();
  });
});

describe('using the hooks without a provider', () => {
  it('throws loudly rather than falling back to dark', () => {
    // A silent fallback would let a component that is invisible in light mode look correct
    // to whoever wrote it, which is exactly how `D-01` gets half-shipped (rule 6).
    expect(() => renderComponent(<Probe />)).toThrow(/ThemeProvider/);
  });
});
