/**
 * The rail regime, at and around every boundary that decides it.
 *
 * These are the widths the walkthrough drives (`e2e/support/viewports.ts`) plus the two
 * breakpoints themselves, because the defect being locked out here was a rail that existed
 * only at exactly one of them.
 */

import { describe, expect, it } from 'vitest';

import { contentWidthFor, contextRailMode, contextRailWidth } from './context-rail-mode';
import { breakpoint, layout } from '@/theme';

describe('contextRailMode', () => {
  it('gives a phone no rail at any phone width', () => {
    for (const width of [320, 375, 390, 430, 599]) {
      expect(contextRailMode({ width, formFactor: 'phone' })).toBe('none');
    }
  });

  it('gives the canonical tablet a fixed rail', () => {
    expect(contextRailMode({ width: 768, formFactor: 'tablet' })).toBe('fixed');
    expect(contextRailMode({ width: 1024, formFactor: 'tablet' })).toBe('fixed');
  });

  it('refuses a rail on the narrowest tablet rather than crushing the scripture', () => {
    // 600 - 80 dp of nav rail leaves 520; a 280 dp rail would leave 240 dp of scripture.
    expect(contextRailMode({ width: breakpoint.tablet, formFactor: 'tablet' })).toBe('none');
  });

  it('gives every desktop width a resizable rail, including the narrowest', () => {
    expect(contextRailMode({ width: breakpoint.desktop, formFactor: 'desktop' })).toBe('resizable');
    expect(contextRailMode({ width: 1280, formFactor: 'desktop' })).toBe('resizable');
    expect(contextRailMode({ width: 1440, formFactor: 'desktop' })).toBe('resizable');
  });

  it('never reports a mode that leaves the reader less room than a phone column', () => {
    for (const width of [768, 1024, 1100, 1280, 1440, 2560]) {
      const formFactor = width >= breakpoint.desktop ? 'desktop' : 'tablet';
      if (contextRailMode({ width, formFactor }) === 'none') continue;
      const reader = contentWidthFor({ width, formFactor }) - layout.contextRail.minTablet;
      expect(reader).toBeGreaterThanOrEqual(layout.contextRail.minReaderTablet);
    }
  });
});

describe('contentWidthFor', () => {
  it('takes the nav chrome off every width but a phone', () => {
    expect(contentWidthFor({ width: 390, formFactor: 'phone' })).toBe(390);
    expect(contentWidthFor({ width: 768, formFactor: 'tablet' })).toBe(768 - layout.navRail.width);
    expect(contentWidthFor({ width: 1280, formFactor: 'desktop' })).toBe(
      1280 - layout.navSidebar.width,
    );
  });

  it('never reports a negative width', () => {
    expect(contentWidthFor({ width: 10, formFactor: 'desktop' })).toBe(0);
  });
});

describe('contextRailWidth', () => {
  it('reports nothing for a layout with no rail', () => {
    expect(contextRailWidth('none')).toBe(0);
  });

  it('reports the tablet minimum for the fixed regime, which is what is laid out', () => {
    expect(contextRailWidth('fixed')).toBe(layout.contextRail.minTablet);
  });

  it('reports the opening width for the resizable one', () => {
    // A dragged rail is only known to `ContextRailShell`. Reporting the opening width is
    // safe for the reading-density rule because that regime already guarantees the reader
    // pane at least `minReader`, so it can never fall into the phone-like band.
    expect(contextRailWidth('resizable')).toBe(layout.contextRail.initial);
  });
});
