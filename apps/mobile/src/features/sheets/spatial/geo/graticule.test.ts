/**
 * Tests for the coordinate grid.
 *
 * A graticule is a measurement claim: a line labelled `33 E` says the projection puts 33 E
 * exactly there. So the assertions check the line positions against `project` rather than
 * against the grid's own arithmetic, and check that the labels stay round.
 */

import { describe, expect, it } from 'vitest';

import { graticule } from './graticule';
import { project, transformForZoom, type Viewport } from './projection';

const SHEET: Viewport = { width: 360, height: 240 };

describe('graticule', () => {
  it('places a meridian exactly where the projection puts that longitude', () => {
    const transform = transformForZoom([32.34, 37.6], 8, SHEET);
    const grid = graticule(transform, SHEET);
    const meridian = grid.meridians[0];
    expect(meridian).toBeDefined();
    const degrees = Number(meridian!.label.replace(' E', ''));
    expect(meridian!.position).toBeCloseTo(project(transform, [degrees, 37.6]).x, 6);
  });

  it('places a parallel exactly where the projection puts that latitude', () => {
    const transform = transformForZoom([32.34, 37.6], 8, SHEET);
    const grid = graticule(transform, SHEET);
    const parallel = grid.parallels[0];
    expect(parallel).toBeDefined();
    const degrees = Number(parallel!.label.replace(' N', ''));
    expect(parallel!.position).toBeCloseTo(project(transform, [32.34, degrees]).y, 6);
  });

  it('keeps the grid legible rather than hatching the map', () => {
    for (const zoom of [3, 5, 7, 9, 11]) {
      const grid = graticule(transformForZoom([32.34, 37.6], zoom, SHEET), SHEET);
      expect(grid.meridians.length).toBeLessThanOrEqual(9);
      expect(grid.parallels.length).toBeLessThanOrEqual(9);
    }
  });

  it('draws at least one line in each axis at every zoom a sheet uses', () => {
    for (const zoom of [4, 6, 8, 10]) {
      const grid = graticule(transformForZoom([32.34, 37.6], zoom, SHEET), SHEET);
      expect(grid.meridians.length).toBeGreaterThan(0);
      expect(grid.parallels.length).toBeGreaterThan(0);
    }
  });

  it('densifies as the reader zooms in', () => {
    const wide = graticule(transformForZoom([32.34, 37.6], 4, SHEET), SHEET);
    const close = graticule(transformForZoom([32.34, 37.6], 10, SHEET), SHEET);
    expect(close.stepDegrees).toBeLessThan(wide.stepDegrees);
  });

  it('labels round degrees, never float noise', () => {
    for (const zoom of [4, 6, 8, 10, 12]) {
      const grid = graticule(transformForZoom([32.34, 37.6], zoom, SHEET), SHEET);
      for (const line of [...grid.meridians, ...grid.parallels]) {
        expect(line.label).toMatch(/^\d+(\.\d{1,2})? [NSEW]$/);
      }
    }
  });

  it('marks the hemispheres', () => {
    const grid = graticule(transformForZoom([-8, -12], 6, SHEET), SHEET);
    expect(grid.meridians.every((line) => line.label.endsWith('W'))).toBe(true);
    expect(grid.parallels.every((line) => line.label.endsWith('S'))).toBe(true);
  });

  it('draws nothing for a degenerate transform rather than throwing', () => {
    const grid = graticule({ scale: 0, offsetX: 0, offsetY: 0 }, SHEET);
    expect(grid.meridians).toEqual([]);
    expect(grid.parallels).toEqual([]);
  });

  it('keeps every line inside the viewport it was asked for', () => {
    const transform = transformForZoom([32.34, 37.6], 8, SHEET);
    const grid = graticule(transform, SHEET);
    for (const line of grid.meridians) {
      expect(line.position).toBeGreaterThanOrEqual(-1);
      expect(line.position).toBeLessThanOrEqual(SHEET.width + 1);
    }
    for (const line of grid.parallels) {
      expect(line.position).toBeGreaterThanOrEqual(-1);
      expect(line.position).toBeLessThanOrEqual(SHEET.height + 1);
    }
  });
});
