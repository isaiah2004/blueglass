/**
 * The resizable split's arithmetic.
 *
 * Purpose
 *   Port-map risk #5: React Native has no split pane, and `Q-006` put the reader's
 *   resizable context rail back in scope. The gesture and the animation are React's
 *   problem; *where the divider goes* is arithmetic, and arithmetic that is wrong at the
 *   clamps is exactly the bug the Flutter prototype hit and fixed. Keeping it here means it
 *   can be tested at every boundary without rendering or dragging anything.
 *
 * The technique being preserved
 *   `resizable_split.dart:44-50` tracks the **absolute pointer position** and derives the
 *   pane width from it, rather than accumulating per-frame deltas. Its own comment says
 *   why: once you drag past a clamp and back, accumulated deltas have drifted and the
 *   handle is no longer under the cursor. {@link paneWidthFromPointer} is that trick,
 *   ported literally.
 *
 * Both edges
 *   The prototype needed a leading pane (desktop Ask) and a trailing one (the reader's
 *   context rail, `app_shell.dart:386-391`) and wrote the sum twice. Here the edge is a
 *   parameter, so the clamp is written — and tested — once.
 *
 * Why every function carries a `'worklet'` directive
 *   The drag handler runs on Reanimated's UI thread, and a worklet may only call other
 *   worklets. The directive is inert everywhere else — under Node it is a string expression
 *   — so the same functions stay directly unit-testable, which is the entire point of
 *   having them here rather than inside the component.
 *
 * Dependencies
 *   None. No React, no React Native, no Reanimated import.
 */

/** Which side of the split the resizable pane is on. */
export type SplitEdge = 'leading' | 'trailing';

/** The fixed sizes a split is laid out within. */
export interface SplitBounds {
  /** The full width available to both panes and the divider, in dp. */
  readonly containerWidth: number;
  /** The divider's hit width, in dp. */
  readonly handleWidth: number;
  /** The narrowest the resizable pane may become, in dp. */
  readonly minPane: number;
  /** The narrowest the other pane may become, in dp. */
  readonly minOther: number;
}

/**
 * The widest the resizable pane may be, given the bounds.
 *
 * @param bounds - See {@link SplitBounds}.
 * @returns A width in dp, never below `minPane`: when the container is too small for both
 *   minimums the clamp collapses to a single value rather than inverting, which would make
 *   `Math.min`/`Math.max` produce a negative width.
 */
export function maxPaneWidth(bounds: SplitBounds): number {
  'worklet';
  const room = bounds.containerWidth - bounds.minOther - bounds.handleWidth;
  return Math.max(bounds.minPane, room);
}

/**
 * Clamp a proposed pane width into the legal range.
 *
 * @param width - The proposed width in dp.
 * @param bounds - See {@link SplitBounds}.
 * @returns The nearest legal width. A non-finite proposal resolves to `minPane` rather
 *   than propagating `NaN` into a layout, where it silently collapses the pane to nothing.
 */
export function clampPaneWidth(width: number, bounds: SplitBounds): number {
  'worklet';
  if (!Number.isFinite(width)) return bounds.minPane;
  return Math.min(Math.max(width, bounds.minPane), maxPaneWidth(bounds));
}

/**
 * The pane width implied by where the pointer is right now.
 *
 * This is the absolute-position technique from `resizable_split.dart:44-50`. The divider
 * is centred under the pointer, so the pane runs from its edge of the container to the
 * pointer, less half the handle.
 *
 * @param pointerX - The pointer's x position **relative to the split container's left
 *   edge**, in dp. Callers convert from a page coordinate before calling.
 * @param edge - Which side the resizable pane is on.
 * @param bounds - See {@link SplitBounds}.
 * @returns The clamped pane width in dp.
 */
export function paneWidthFromPointer(
  pointerX: number,
  edge: SplitEdge,
  bounds: SplitBounds,
): number {
  'worklet';
  const halfHandle = bounds.handleWidth / 2;
  const raw =
    edge === 'leading' ? pointerX - halfHandle : bounds.containerWidth - pointerX - halfHandle;

  return clampPaneWidth(raw, bounds);
}

/**
 * Is there room for two panes at all?
 *
 * @param bounds - See {@link SplitBounds}.
 * @returns True when both minimums and the divider fit inside the container. A 600 dp
 *   tablet minus a 72 dp nav rail cannot hold a 280 dp context rail *and* a 460 dp reader,
 *   so the shell has to fall back to the phone's sheet rather than render two crushed
 *   columns — which is what "tablet parity" means in practice.
 */
export function canSplit(bounds: SplitBounds): boolean {
  'worklet';
  return bounds.containerWidth >= bounds.minPane + bounds.minOther + bounds.handleWidth;
}

/**
 * Re-clamp a remembered width after the window changed size.
 *
 * @param storedWidth - The width the reader last dragged to, or `undefined` on a first run.
 * @param fallback - The width to start from when nothing is stored.
 * @param bounds - See {@link SplitBounds}.
 * @returns A legal width. Resizing a desktop window narrower must move the divider, not
 *   push the reader pane below its minimum and off the screen.
 */
export function resolvePaneWidth(
  storedWidth: number | undefined,
  fallback: number,
  bounds: SplitBounds,
): number {
  'worklet';
  return clampPaneWidth(storedWidth ?? fallback, bounds);
}

/**
 * The pane width implied by a drag, measured from where the drag began.
 *
 * The form the gesture actually uses. It is {@link paneWidthFromPointer} rearranged: a
 * pointer position relative to the container is the width the pane had when the gesture
 * started, plus how far the finger has moved since. Expressing it this way means the
 * component never has to know the split's page coordinates, which React Native only
 * surfaces through an asynchronous `measure`.
 *
 * Crucially it is **not** delta accumulation. `translationX` is itself measured from the
 * gesture's origin on every frame, so a drag that runs past a clamp and comes back lands
 * exactly where the finger says — the property `resizable_split.dart:44-50` exists to
 * preserve.
 *
 * @param startWidth - The pane's width when the gesture began, in dp.
 * @param translationX - How far the pointer has moved since, in dp. Positive is rightward.
 * @param edge - Which side the resizable pane is on.
 * @param bounds - See {@link SplitBounds}.
 * @returns The clamped pane width in dp.
 */
export function paneWidthFromDrag(
  startWidth: number,
  translationX: number,
  edge: SplitEdge,
  bounds: SplitBounds,
): number {
  'worklet';
  const halfHandle = bounds.handleWidth / 2;
  const pointerAtStart =
    edge === 'leading' ? startWidth + halfHandle : bounds.containerWidth - startWidth - halfHandle;

  return paneWidthFromPointer(pointerAtStart + translationX, edge, bounds);
}
