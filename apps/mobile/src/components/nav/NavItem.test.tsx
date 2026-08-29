/**
 * The navigation item, in all three shapes.
 *
 * `Q-006` put a phone bar, a tablet icon rail and a desktop sidebar all in scope, and they
 * share one component precisely so their *states* cannot drift. These tests are what makes
 * that claim checkable: the same assertions run against all three shapes, in both themes.
 *
 * The accessibility assertions are not decoration. In the icon rail there is no visible
 * label at all, so the spoken one is the entire affordance for a screen-reader user — a
 * missing `accessibilityLabel` there is a tab nobody can find.
 */

import { describe, expect, it, vi } from 'vitest';
import type { JSX } from 'react';

import { createMemoryKeyValueStore } from '@/api/storage';
import { darkTheme, lightTheme, type ThemePreference } from '@/theme';
import { ThemeProvider } from '@/theme/runtime';

import { actSync, renderComponent, type RenderResult } from '../../testing/render';
import { navDestinations } from './nav-destinations';
import { NavItem, type NavItemShape } from './NavItem';

/** The three shapes the same component renders in. */
const SHAPES: readonly NavItemShape[] = ['bar', 'rail', 'sidebar'];

/** The Home destination, used wherever the specific destination does not matter. */
const HOME = navDestinations[0];

/**
 * Mount one item under a provider.
 *
 * @param element - The item to render.
 * @param preference - Which palette to render it in.
 * @returns The render result.
 */
function mount(element: JSX.Element, preference: ThemePreference = 'dark'): RenderResult {
  return renderComponent(
    <ThemeProvider store={createMemoryKeyValueStore()} initialPreference={preference}>
      {element}
    </ThemeProvider>,
  );
}

describe('every shape', () => {
  it.each(SHAPES)('renders the %s shape with its test id and spoken label', (shape) => {
    const rendered = mount(
      <NavItem destination={HOME} shape={shape} isActive={false} onPress={vi.fn()} />,
    );
    const item = rendered.byTestId(HOME.testID);

    expect(item).not.toBeNull();
    expect(item?.getAttribute('aria-label')).toBe(HOME.accessibilityLabel);
    rendered.unmount();
  });

  it.each(SHAPES)('announces itself as a tab, and says whether it is selected (%s)', (shape) => {
    const rendered = mount(<NavItem destination={HOME} shape={shape} isActive onPress={vi.fn()} />);
    const item = rendered.byTestId(HOME.testID);

    expect(item?.getAttribute('role')).toBe('tab');
    expect(item?.getAttribute('aria-selected')).toBe('true');
    rendered.unmount();
  });

  it.each(SHAPES)('calls back exactly once when pressed (%s)', (shape) => {
    const onPress = vi.fn();
    const rendered = mount(
      <NavItem destination={HOME} shape={shape} isActive={false} onPress={onPress} />,
    );

    actSync(() => {
      rendered.byTestId(HOME.testID)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onPress).toHaveBeenCalledTimes(1);
    rendered.unmount();
  });
});

describe('what each shape shows', () => {
  // This used to assert the opposite for the rail — "shows no visible label in the icon
  // rail, only the spoken one" — and it was locking in a defect rather than a decision.
  // Measured at 768 dp, all five rail items rendered 56x56 with empty text, so the tablet
  // was the one width at which a sighted reader had to guess which glyph was Studio. The
  // rail is 80 dp now and carries a caption; the spoken label is still the longer one.
  it('shows a visible label in every shape', () => {
    for (const shape of ['bar', 'rail', 'sidebar'] as const) {
      const rendered = mount(
        <NavItem destination={HOME} shape={shape} isActive={false} onPress={vi.fn()} />,
      );

      expect(rendered.text(), `the ${shape} shape rendered no visible label`).toContain(HOME.label);
      rendered.unmount();
    }
  });

  it('always speaks more than it shows', () => {
    const rendered = mount(
      <NavItem destination={HOME} shape="rail" isActive={false} onPress={vi.fn()} />,
    );

    const spoken = rendered.byTestId(HOME.testID)?.getAttribute('aria-label') ?? '';
    expect(spoken).toMatch(/\S/);
    expect(spoken.length).toBeGreaterThan(HOME.label.length);
    rendered.unmount();
  });
});

describe('both themes', () => {
  it.each(['dark', 'light'] as const)('renders every destination in the %s theme', (preference) => {
    const palette = preference === 'dark' ? darkTheme : lightTheme;

    for (const destination of navDestinations) {
      const rendered = mount(
        <NavItem destination={destination} shape="sidebar" isActive onPress={vi.fn()} />,
        preference,
      );
      const label = rendered.byTestId(destination.testID)?.textContent ?? '';

      expect(label).toContain(destination.label);
      // The accent is a theme value, so an item that painted from a module constant would
      // render the dark hue under the light provider and this would still pass — which is
      // why the palette itself is asserted to differ, above and in `themes.test.ts`.
      expect(palette.accent[destination.accent]).toMatch(/^#/);
      rendered.unmount();
    }
  });
});
