/**
 * Tests for what a map frame contains.
 *
 * Why this module exists at all is the interesting assertion
 *   The rule it replaced counted coastline vertices, and the reported Lystra screenshot
 *   passed it — twelve points of a lake in one corner, twelve of a gulf in the other. The
 *   regression test below is exactly that frame: a healthy vertex count and a water share
 *   far under the bar. If someone reinstates a count-only rule, that test fails.
 *
 * Why the fixtures are named places and not numbers
 *   A wrong figure here is invisible in every screenshot — the map still draws — so the
 *   assertions are anchored to geography a reader can check: open Mediterranean is water,
 *   the Anatolian plateau is land, the Dead Sea is subtracted from the land it sits in.
 */

import { describe, expect, it } from 'vitest';

import { basemap } from './basemap';
import { frameGeography } from './frame-geography';
import { transformForZoom, type GeoPoint, type Viewport } from './projection';

const RINGS = [...basemap.land, ...basemap.lakes];
const SHEET: Viewport = { width: 360, height: 267 };

/** Open Mediterranean, well south of Crete and well north of Libya. */
const OPEN_SEA: GeoPoint = [22, 34];

/** The Anatolian plateau at Lystra — the site the defect was reported on. */
const LYSTRA: GeoPoint = [32.3384, 37.6017];

/** Jerusalem, which has always framed correctly. */
const JERUSALEM: GeoPoint = [35.234167, 31.776667];

/** The Dead Sea, which the even-odd rule must subtract from the land around it. */
const DEAD_SEA: GeoPoint = [35.47, 31.5];

/** Measure one frame. */
function at(
  point: GeoPoint,
  zoom: number,
  viewport: Viewport = SHEET,
): ReturnType<typeof frameGeography> {
  return frameGeography(RINGS, transformForZoom(point, zoom, viewport), viewport);
}

describe('frameGeography', () => {
  it('calls open sea water', () => {
    expect(at(OPEN_SEA, 6).waterFraction).toBeGreaterThan(0.95);
  });

  it('calls the Anatolian plateau land', () => {
    expect(at(LYSTRA, 6.2).waterFraction).toBeLessThan(0.1);
  });

  it('puts a coastal site between the two', () => {
    const jerusalem = at(JERUSALEM, 6.2).waterFraction;
    expect(jerusalem).toBeGreaterThan(0.15);
    expect(jerusalem).toBeLessThan(0.85);
  });

  it('subtracts a lake from the land it sits in, as the even-odd fill does', () => {
    // The Dead Sea sits inside the Asia land ring. Measured with the land alone it is dry
    // ground; measured with the lakes too it is water, which is the whole reason the caller
    // passes both lists. Getting this wrong would report a landlocked frame as coastal.
    const transform = transformForZoom(DEAD_SEA, 9, SHEET);
    const landOnly = frameGeography(basemap.land, transform, SHEET).waterFraction;
    const withLakes = frameGeography(RINGS, transform, SHEET).waterFraction;

    expect(landOnly).toBe(0);
    expect(withLakes).toBeGreaterThan(0.2);
  });

  it('is the regression: a healthy vertex count over a frame that is nearly all land', () => {
    // The reported picture. A rule that asked only "are twelve vertices in frame?" said yes
    // here, and the reader saw two black wedges in the corners of an empty grid.
    const rail: Viewport = { width: 232, height: 172 };
    const frame = at(LYSTRA, 5.2, rail);

    expect(frame.coastPoints).toBeGreaterThanOrEqual(12);
    expect(frame.waterFraction).toBeLessThan(0.18);
  });

  it('counts coastline vertices inside the visible degrees and none outside', () => {
    const close = at(JERUSALEM, 6.2).coastPoints;
    const wide = at(JERUSALEM, 4).coastPoints;
    expect(close).toBeGreaterThan(0);
    expect(wide).toBeGreaterThan(close);
  });

  it('reports open water with no coastline for a frame outside the basemap crop', () => {
    // Mid-Pacific. Nothing is culled in, so there is nothing to draw and nothing to stand on.
    expect(at([-150, 0], 6)).toEqual({ waterFraction: 1, coastPoints: 0 });
  });

  it('claims nothing for a degenerate transform rather than throwing', () => {
    expect(frameGeography(RINGS, { scale: 0, offsetX: 0, offsetY: 0 }, SHEET)).toEqual({
      waterFraction: 0,
      coastPoints: 0,
    });
  });
});
