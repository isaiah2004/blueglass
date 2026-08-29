/**
 * Tests for the one-commit-per-frame throttle.
 *
 * This is the proof for `docs/architecture/flutter-port-map.md` risk #2: a hundred deltas
 * inside one frame must produce exactly one commit, not a hundred.
 */

import { describe, expect, it, vi } from 'vitest';

import { createFrameThrottle, type FrameThrottle } from './frame-throttle';
import { createManualScheduler } from './stream-test-doubles';

describe('createFrameThrottle', () => {
  it('coalesces a hundred schedules inside one frame into a single run', () => {
    const run = vi.fn();
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(run, manual.scheduler);

    for (let index = 0; index < 100; index += 1) throttle.schedule();

    expect(manual.requestCount()).toBe(1);
    expect(run).not.toHaveBeenCalled();

    manual.tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs once per frame across several frames', () => {
    const run = vi.fn();
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(run, manual.scheduler);

    for (let frame = 0; frame < 3; frame += 1) {
      throttle.schedule();
      throttle.schedule();
      manual.tick();
    }

    expect(run).toHaveBeenCalledTimes(3);
    expect(manual.requestCount()).toBe(3);
  });

  it('reports whether a frame is pending', () => {
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(() => undefined, manual.scheduler);

    expect(throttle.isPending).toBe(false);
    throttle.schedule();
    expect(throttle.isPending).toBe(true);
    manual.tick();
    expect(throttle.isPending).toBe(false);
  });

  it('lets the callback schedule the next frame from inside a run', () => {
    const manual = createManualScheduler();
    let runs = 0;
    let throttle: FrameThrottle | null = null;
    throttle = createFrameThrottle(() => {
      runs += 1;
      // A stream still running re-arms from inside the commit. The handle must already
      // be cleared by then, or the next frame is silently dropped.
      if (runs < 2) throttle?.schedule();
    }, manual.scheduler);

    throttle.schedule();
    manual.tick();
    manual.tick();

    expect(runs).toBe(2);
  });

  it('drops a pending frame on cancel without running', () => {
    const run = vi.fn();
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(run, manual.scheduler);

    throttle.schedule();
    throttle.cancel();
    manual.tick();

    expect(run).not.toHaveBeenCalled();
    expect(manual.pendingCount()).toBe(0);
  });

  it('runs immediately on flush and cancels the pending frame', () => {
    const run = vi.fn();
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(run, manual.scheduler);

    throttle.schedule();
    throttle.flush();
    expect(run).toHaveBeenCalledTimes(1);

    manual.tick();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does nothing on flush when no frame is pending', () => {
    const run = vi.fn();
    const throttle = createFrameThrottle(run, createManualScheduler().scheduler);

    throttle.flush();

    expect(run).not.toHaveBeenCalled();
  });

  it('is idempotent on repeated cancels', () => {
    const manual = createManualScheduler();
    const throttle = createFrameThrottle(() => undefined, manual.scheduler);

    throttle.schedule();
    throttle.cancel();
    throttle.cancel();

    expect(throttle.isPending).toBe(false);
  });
});
