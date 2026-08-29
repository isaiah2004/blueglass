/**
 * Tests for label decluttering, driven by the real Acts 16 geometry.
 *
 * Two properties are asserted, and the second is the one a naive implementation gets wrong:
 * no two printed labels may overlap, AND the departure and destination must always be
 * among the printed ones. A greedy pass in travel order satisfies the first and quietly
 * drops Thyatira, which is half the title of the sheet.
 */

import { describe, expect, it } from 'vitest';

import { boundsOf, fitTransform, project, type Viewport } from '../geo/projection';
import { ACTS_16_ROUTE } from '../testing/fixtures';

import { selectLabels, type LabelCandidate } from './label-declutter';
import { placeLabel } from './map-label-geometry';

const SHEET: Viewport = { width: 360, height: 220 };
const FONT = 12;

/** The Acts 16 route, projected into a phone-sized map. */
function acts16Candidates(viewport: Viewport = SHEET): readonly LabelCandidate[] {
  const coordinates = ACTS_16_ROUTE.waypoints.map((waypoint) => waypoint.coordinates);
  const transform = fitTransform(boundsOf(coordinates)!, viewport, {
    padding: 28,
    fallbackZoom: 9,
  });
  const last = ACTS_16_ROUTE.waypoints.length - 1;
  return ACTS_16_ROUTE.waypoints.map((waypoint, index) => ({
    key: `${waypoint.placeId}:${String(index)}`,
    name: waypoint.name,
    point: project(transform, waypoint.coordinates),
    emphasised: index === 0 || index === last,
  }));
}

describe('selectLabels', () => {
  it('keeps every label when nothing collides', () => {
    const spread: readonly LabelCandidate[] = [
      { key: 'a', name: 'Troas', point: { x: 20, y: 20 }, emphasised: true },
      { key: 'b', name: 'Philippi', point: { x: 20, y: 120 }, emphasised: false },
    ];
    expect(selectLabels(spread, FONT, SHEET).size).toBe(2);
  });

  it('drops the second of two labels on top of each other', () => {
    const stacked: readonly LabelCandidate[] = [
      { key: 'a', name: 'Mysia', point: { x: 100, y: 100 }, emphasised: false },
      { key: 'b', name: 'Troas', point: { x: 102, y: 101 }, emphasised: false },
    ];
    const kept = selectLabels(stacked, FONT, SHEET);
    expect(kept.size).toBe(1);
    expect(kept.has('a')).toBe(true);
  });

  it('prints fewer than all twenty of the Acts 16 stops', () => {
    const candidates = acts16Candidates();
    const kept = selectLabels(candidates, FONT, SHEET);
    expect(kept.size).toBeLessThan(candidates.length);
    expect(kept.size).toBeGreaterThan(2);
  });

  it('always prints the departure and the destination', () => {
    const candidates = acts16Candidates();
    const kept = selectLabels(candidates, FONT, SHEET);
    const emphasised = candidates.filter((candidate) => candidate.emphasised);
    expect(emphasised).toHaveLength(2);
    for (const candidate of emphasised) {
      expect(`${candidate.name}:${String(kept.has(candidate.key))}`).toBe(`${candidate.name}:true`);
    }
  });

  it('leaves no two printed labels overlapping', () => {
    const candidates = acts16Candidates();
    const kept = selectLabels(candidates, FONT, SHEET);
    const placements = candidates
      .filter((candidate) => kept.has(candidate.key))
      .map((candidate) => placeLabel(candidate.point, candidate.name, FONT, SHEET));

    for (let i = 0; i < placements.length; i += 1) {
      for (let j = i + 1; j < placements.length; j += 1) {
        const a = placements[i]!;
        const b = placements[j]!;
        const overlaps =
          a.x < b.x + b.width &&
          b.x < a.x + a.width &&
          a.y < b.y + b.height &&
          b.y < a.y + a.height;
        expect(overlaps).toBe(false);
      }
    }
  });

  it('prints more labels on a desktop rail than on a phone sheet', () => {
    const phone = selectLabels(acts16Candidates(SHEET), FONT, SHEET);
    const wide: Viewport = { width: 720, height: 440 };
    const desktop = selectLabels(acts16Candidates(wide), FONT, wide);
    expect(desktop.size).toBeGreaterThanOrEqual(phone.size);
  });

  it('handles an empty route', () => {
    expect(selectLabels([], FONT, SHEET).size).toBe(0);
  });

  it('never prints the same key twice', () => {
    const duplicated: readonly LabelCandidate[] = [
      { key: 'a', name: 'Mysia', point: { x: 40, y: 40 }, emphasised: false },
      { key: 'a', name: 'Mysia', point: { x: 240, y: 180 }, emphasised: false },
    ];
    expect(selectLabels(duplicated, FONT, SHEET).size).toBe(1);
  });
});
