/**
 * The two theme controls.
 *
 * `D-01` asks for a switcher that works and a choice that sticks. Two failures are worth
 * locking out specifically: a toggle wired to state nothing consumes, and a toggle that only
 * travels one way — both look fine in a demo, because a demo only goes one direction.
 */

import { describe, expect, it } from 'vitest';
import type { JSX } from 'react';
import { Text } from 'react-native';

import { createMemoryKeyValueStore } from '@/api/storage';
import { themePreferences } from '@/theme';
import { ThemeProvider, useTheme } from '@/theme/runtime';

import { actSync, renderComponent, type RenderResult } from '../../testing/render';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ThemeToggleButton } from './ThemeToggleButton';

/** Reports which palette is rendering, so a control can be checked against an effect. */
function PaletteProbe(): JSX.Element {
  return <Text testID="palette">{useTheme().name}</Text>;
}

/**
 * Mount a control under a fresh provider.
 *
 * @param control - The control to render.
 * @returns The render result.
 */
function mount(control: JSX.Element): RenderResult {
  return renderComponent(
    <ThemeProvider store={createMemoryKeyValueStore()} initialPreference="dark">
      {control}
      <PaletteProbe />
    </ThemeProvider>,
  );
}

/**
 * Click an element the way react-native-web expects a press.
 *
 * @param element - The element to press.
 */
function press(element: HTMLElement | null): void {
  actSync(() => {
    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ThemeToggleButton', () => {
  it('carries the test id the walkthrough addresses it by', () => {
    const rendered = mount(<ThemeToggleButton />);

    expect(rendered.byTestId('theme-toggle')).not.toBeNull();
    rendered.unmount();
  });

  it('inverts the rendered palette, and inverts back', () => {
    const rendered = mount(<ThemeToggleButton />);

    expect(rendered.byTestId('palette')?.textContent).toBe('dark');

    press(rendered.byTestId('theme-toggle'));
    expect(rendered.byTestId('palette')?.textContent).toBe('light');

    // The one-way toggle: half of "verified in both themes" is being able to get back.
    press(rendered.byTestId('theme-toggle'));
    expect(rendered.byTestId('palette')?.textContent).toBe('dark');

    rendered.unmount();
  });

  it('names the action it will perform, not the state it is in', () => {
    const rendered = mount(<ThemeToggleButton />);
    const toggle = rendered.byTestId('theme-toggle');

    // A screen reader hears the label before the state, so "Switch to light theme" is
    // useful where "Dark theme, on" is a riddle.
    expect(toggle?.getAttribute('aria-label')).toBe('Switch to light theme');
    press(toggle);
    expect(rendered.byTestId('theme-toggle')?.getAttribute('aria-label')).toBe(
      'Switch to dark theme',
    );

    rendered.unmount();
  });
});

describe('ThemeSwitcher', () => {
  it('offers all three positions as one radio group', () => {
    const rendered = mount(<ThemeSwitcher />);

    expect(rendered.byRole('radiogroup')).toHaveLength(1);
    expect(rendered.byRole('radio')).toHaveLength(themePreferences.length);
    rendered.unmount();
  });

  it('marks exactly one position as selected', () => {
    const rendered = mount(<ThemeSwitcher />);
    const checked = rendered
      .byRole('radio')
      .filter((r) => r.getAttribute('aria-checked') === 'true');

    expect(checked).toHaveLength(1);
    rendered.unmount();
  });

  it('changes the rendered palette when a position is chosen', () => {
    const rendered = mount(<ThemeSwitcher />);

    press(rendered.byTestId('theme-switcher-light'));
    expect(rendered.byTestId('palette')?.textContent).toBe('light');

    press(rendered.byTestId('theme-switcher-dark'));
    expect(rendered.byTestId('palette')?.textContent).toBe('dark');

    rendered.unmount();
  });

  it('says what is actually rendering, so "System" never looks broken', () => {
    const rendered = mount(<ThemeSwitcher />);

    expect(rendered.byTestId('theme-status')?.textContent).toContain('Always dark');

    press(rendered.byTestId('theme-switcher-system'));
    // Under jsdom the platform reports no scheme, so `system` resolves to the default.
    expect(rendered.byTestId('theme-status')?.textContent).toContain('Following your system');

    rendered.unmount();
  });

  it('labels every position for a screen reader', () => {
    const rendered = mount(<ThemeSwitcher />);

    for (const radio of rendered.byRole('radio')) {
      expect(radio.getAttribute('aria-label')).toMatch(/\S/);
    }
    rendered.unmount();
  });
});
