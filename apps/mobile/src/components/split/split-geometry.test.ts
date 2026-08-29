/**
 * The resizable split's arithmetic.
 *
 * The bug being locked out is the one the Flutter prototype already found and fixed
 * (`resizable_split.dart:44-50`): drag past a clamp, drag back, and a delta-accumulating
 * divider is no longer under the cursor. The absolute-position tests below are the
 * regression net for that — they drag out of range and back, and assert the width returns
 * to exactly where the pointer says it should be.
 */

import { describe, expect, it } from 'vitest';

import {
  canSplit,
  clampPaneWidth,
  maxPaneWidth,
  paneWidthFromDrag,
  paneWidthFromPointer,
  resolvePaneWidth,
  type SplitBounds,
} from './split-geometry';

/** A desktop-sized split: 1440 dp wide, a 340 dp context rail, a 460 dp minimum reader. */
const DESKTOP: SplitBounds = {
  containerWidth: 1440,
  handleWidth: 12,
  minPane: 320,
  minOther: 460,
};

describe('maxPaneWidth', () => {
  it('leaves the other pane its minimum and the divider its width', () => {
    expect(maxPaneWidth(DESKTOP)).toBe(1440 - 460 - 12);
  });

  it('never inverts the clamp when the container is too small for both minimums', () => {
    const cramped: SplitBounds = { ...DESKTOP, containerWidth: 500 };

    expect(maxPaneWidth(cramped)).toBe(cramped.minPane);
    expect(maxPaneWidth(cramped)).toBeGreaterThanOrEqual(cramped.minPane);
  });
});

describe('clampPaneWidth', () => {
  it('passes a legal width through untouched', () => {
    expect(clampPaneWidth(340, DESKTOP)).toBe(340);
  });

  it('holds both ends', () => {
    expect(clampPaneWidth(0, DESKTOP)).toBe(DESKTOP.minPane);
    expect(clampPaneWidth(-9000, DESKTOP)).toBe(DESKTOP.minPane);
    expect(clampPaneWidth(9000, DESKTOP)).toBe(maxPaneWidth(DESKTOP));
  });

  it('resolves a non-finite proposal to the minimum instead of poisoning the layout', () => {
    // A `NaN` width does not throw in React Native — it collapses the view to nothing and
    // leaves no trace of where it came from.
    expect(clampPaneWidth(Number.NaN, DESKTOP)).toBe(DESKTOP.minPane);
    expect(clampPaneWidth(Number.POSITIVE_INFINITY, DESKTOP)).toBe(DESKTOP.minPane);
  });
});

describe('paneWidthFromPointer — the absolute-position technique', () => {
  it('centres the divider under the pointer on a leading pane', () => {
    expect(paneWidthFromPointer(700, 'leading', DESKTOP)).toBe(700 - 6);
  });

  it('centres the divider under the pointer on a trailing pane', () => {
    expect(paneWidthFromPointer(1000, 'trailing', DESKTOP)).toBe(1440 - 1000 - 6);
  });

  it('returns to the pointer exactly after being dragged past a clamp and back', () => {
    // The delta-accumulation bug, reproduced as a gesture: out past the minimum, further
    // out, then back to a legal position. An accumulator would be short by the distance
    // travelled while clamped; absolute tracking cannot be.
    const path = [700, 400, 100, -200, 100, 400, 700];
    const widths = path.map((x) => paneWidthFromPointer(x, 'leading', DESKTOP));

    expect(widths.at(-1)).toBe(paneWidthFromPointer(700, 'leading', DESKTOP));
    expect(widths.at(-1)).toBe(694);
  });

  it('is a pure function of the pointer — the same x always gives the same width', () => {
    const first = paneWidthFromPointer(812, 'trailing', DESKTOP);
    // Some drags in between, including illegal ones.
    for (const x of [0, 1440, -50, 3000, 812]) paneWidthFromPointer(x, 'trailing', DESKTOP);

    expect(paneWidthFromPointer(812, 'trailing', DESKTOP)).toBe(first);
  });

  it('clamps at both ends for both edges', () => {
    for (const edge of ['leading', 'trailing'] as const) {
      expect(paneWidthFromPointer(-5000, edge, DESKTOP)).toBeGreaterThanOrEqual(DESKTOP.minPane);
      expect(paneWidthFromPointer(5000, edge, DESKTOP)).toBeLessThanOrEqual(maxPaneWidth(DESKTOP));
    }
  });

  it('leaves the other pane at or above its minimum at every pointer position', () => {
    for (let x = -100; x <= 1540; x += 20) {
      const pane = paneWidthFromPointer(x, 'trailing', DESKTOP);
      const other = DESKTOP.containerWidth - pane - DESKTOP.handleWidth;

      expect(other).toBeGreaterThanOrEqual(DESKTOP.minOther);
    }
  });
});

describe('canSplit', () => {
  it('accepts a container with room for both minimums and the divider', () => {
    expect(canSplit(DESKTOP)).toBe(true);
    expect(canSplit({ ...DESKTOP, containerWidth: 320 + 460 + 12 })).toBe(true);
  });

  it('refuses one pixel short', () => {
    expect(canSplit({ ...DESKTOP, containerWidth: 320 + 460 + 11 })).toBe(false);
  });

  it('refuses the narrowest tablet, which is why that layout keeps the sheet', () => {
    // 600 dp tablet, less a 72 dp nav rail, cannot hold a 280 dp context rail beside a
    // 460 dp reader. Rendering two crushed columns there would be worse than the sheet.
    const narrowTablet: SplitBounds = {
      containerWidth: 600 - 72,
      handleWidth: 12,
      minPane: 280,
      minOther: 460,
    };

    expect(canSplit(narrowTablet)).toBe(false);
  });
});

describe('resolvePaneWidth', () => {
  it('uses the fallback when nothing has been stored', () => {
    expect(resolvePaneWidth(undefined, 340, DESKTOP)).toBe(340);
  });

  it('re-clamps a remembered width after the window shrinks', () => {
    const shrunk: SplitBounds = { ...DESKTOP, containerWidth: 900 };

    // The reader had dragged the rail out to 900 on a wide monitor; the window is now 900
    // wide in total. Honouring the stored width would push the reader pane off-screen.
    expect(resolvePaneWidth(900, 340, shrunk)).toBe(maxPaneWidth(shrunk));
    expect(resolvePaneWidth(900, 340, shrunk)).toBe(428);
  });

  it('keeps a still-legal remembered width', () => {
    expect(resolvePaneWidth(512, 340, DESKTOP)).toBe(512);
  });
});

describe('paneWidthFromDrag — the form the gesture uses', () => {
  it('moves a leading pane with the finger', () => {
    expect(paneWidthFromDrag(400, 120, 'leading', DESKTOP)).toBe(520);
    expect(paneWidthFromDrag(400, -120, 'leading', DESKTOP)).toBe(280 + 40);
  });

  it('moves a trailing pane against the finger', () => {
    // Dragging right shrinks a right-hand rail, which is what a reader expects.
    expect(paneWidthFromDrag(400, 120, 'trailing', DESKTOP)).toBe(320);
    expect(paneWidthFromDrag(400, -120, 'trailing', DESKTOP)).toBe(520);
  });

  it('agrees with the pointer form it is derived from', () => {
    for (const edge of ['leading', 'trailing'] as const) {
      for (const translation of [-800, -100, 0, 100, 800]) {
        const viaDrag = paneWidthFromDrag(500, translation, edge, DESKTOP);
        const halfHandle = DESKTOP.handleWidth / 2;
        const pointerAtStart =
          edge === 'leading' ? 500 + halfHandle : DESKTOP.containerWidth - 500 - halfHandle;

        expect(viaDrag).toBe(paneWidthFromPointer(pointerAtStart + translation, edge, DESKTOP));
      }
    }
  });

  it('returns to the exact width after a drag past a clamp and back', () => {
    // The regression the whole module exists for. An accumulator would come back short by
    // the distance travelled while pinned at the minimum.
    const start = 400;
    const path = [0, -200, -600, -2000, -600, -200, 0];
    const widths = path.map((t) => paneWidthFromDrag(start, t, 'leading', DESKTOP));

    expect(widths[0]).toBe(start);
    expect(widths.at(-1)).toBe(start);
  });

  it('never lets either pane fall below its minimum, at any translation', () => {
    for (const edge of ['leading', 'trailing'] as const) {
      for (let t = -2000; t <= 2000; t += 50) {
        const pane = paneWidthFromDrag(500, t, edge, DESKTOP);
        const other = DESKTOP.containerWidth - pane - DESKTOP.handleWidth;

        expect(pane).toBeGreaterThanOrEqual(DESKTOP.minPane);
        expect(other).toBeGreaterThanOrEqual(DESKTOP.minOther);
      }
    }
  });
});
