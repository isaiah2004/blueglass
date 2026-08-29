/**
 * The segmented control, and the rule it shipped without.
 *
 * `theme/spacing.ts` states the rule on the token itself — *"44 — the minimum touchable
 * area … a control shorter than this pads its hit area up to it"* — and this component set
 * `minHeight: size.control` (32), added no vertical padding and no `hitSlop`. The
 * walkthrough measured 103x32, 87x32 and 80x32 px at desktop and reported it once per
 * chapter-22 step; nothing in the component's own suite could see it, because it had none.
 *
 * The measurement is `getComputedStyle` rather than a layout pass: jsdom lays nothing out,
 * so a `getBoundingClientRect` here would read zero and pass whatever the component did.
 * react-native-web compiles its styles to real classes in a real stylesheet, so the
 * computed value is the number the browser then lays out with.
 */

import { describe, expect, it } from 'vitest';

import { createMemoryKeyValueStore } from '@/api/storage';
import { size } from '@/theme';
import { ThemeProvider } from '@/theme/runtime';

import { renderComponent } from '../../testing/render';

import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'system' as const, label: 'System' },
  { value: 'light' as const, label: 'Light' },
  { value: 'dark' as const, label: 'Dark' },
];

/** Mount the control with a fixed selection; nothing here changes it. */
function mount(): ReturnType<typeof renderComponent> {
  return renderComponent(
    <ThemeProvider store={createMemoryKeyValueStore()} initialPreference="dark">
      <SegmentedControl
        options={OPTIONS}
        value="dark"
        onChange={() => undefined}
        accessibilityLabel="Theme"
        testID="segment"
      />
    </ThemeProvider>,
  );
}

/** The `min-height` react-native-web resolved for an element, in px. */
function minHeightPx(element: Element | null | undefined): number {
  if (element === null || element === undefined) return 0;
  return Number.parseFloat(getComputedStyle(element).minHeight);
}

describe('SegmentedControl', () => {
  it('gives every segment the minimum touchable height, not the control height', () => {
    const rendered = mount();

    for (const option of OPTIONS) {
      const segment = rendered.byTestId(`segment-${option.value}`);
      expect(segment, option.value).not.toBeNull();
      expect(minHeightPx(segment), option.value).toBeGreaterThanOrEqual(size.tapTarget);
    }
    rendered.unmount();
  });

  it('keeps the visible pill at the height every small control in the app shares', () => {
    // The fix pads the hit area up; it does not make the control look bigger. If the pill
    // grew to 44 too, the segmented control would stop lining up with the header pills and
    // chips that share `size.control` (`flutter-port-map.md` §6).
    const rendered = mount();
    const pill = rendered.byTestId('segment-dark')?.firstElementChild;

    expect(pill).not.toBeNull();
    expect(minHeightPx(pill)).toBe(size.control);
    rendered.unmount();
  });

  it('still announces itself as a radio group with the selection marked', () => {
    const rendered = mount();
    const selected = rendered.byTestId('segment-dark');

    expect(rendered.byTestId('segment')?.getAttribute('role')).toBe('radiogroup');
    expect(selected?.getAttribute('role')).toBe('radio');
    expect(selected?.getAttribute('aria-checked')).toBe('true');
    rendered.unmount();
  });
});
