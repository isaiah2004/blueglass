/**
 * Tests for the `[Route]` view model.
 *
 * Driven by the real Acts 16 payload, because the interesting cases are all in the real
 * data and none of them are in an invented fixture: sixteen places, a mixture of
 * settlements and regions, one island, a passage that ends at verse 14 rather than at the
 * chapter's end, and Jerusalem — which the chapter names in 16:4 without Paul going there.
 *
 * What changed, and why the old assertions were wrong
 *   This file used to assert a title of `Derbe to Thyatira`, twenty stops including two
 *   Mysias, a `STRAIGHT LINE` total and a `LONGEST LEG`. Every one of those describes a
 *   journey, and the chapter-scheme waypoints are the places the text NAMES in the order it
 *   names them — a derivation that cannot tell travel from mention. The assertions were
 *   pinning a claim the data does not support, so they were changed rather than worked
 *   around. See `apps/api/tests/unit/test_route_badge_claims.py`.
 */

import { describe, expect, it } from 'vitest';

import { ACTS_16_ROUTE } from '../testing/fixtures';

import { schemeLabel, toRouteView } from './route-view';
import type { RouteSheetPayload } from './spatial-payload.types';

const view = toRouteView(ACTS_16_ROUTE);

/** A two-place payload, for the degenerate cases the real one cannot exercise. */
function shortRoute(overrides: Partial<RouteSheetPayload> = {}): RouteSheetPayload {
  return {
    ...ACTS_16_ROUTE,
    waypoints: ACTS_16_ROUTE.waypoints.slice(9, 11),
    passage: { startKey: 44016011, endKey: 44016011 },
    ...overrides,
  };
}

describe('toRouteView', () => {
  it('keeps the server-authored title rather than composing its own', () => {
    expect(view.title).toBe('Places named in this chapter');
  });

  it('never renders a title that runs from one place to another', () => {
    expect(view.title).not.toContain(' to ');
  });

  it('formats the passage from the packed keys', () => {
    expect(view.passageLabel).toBe('Acts 16:1-14');
  });

  it('prints a single-verse passage without a range', () => {
    expect(toRouteView(shortRoute()).passageLabel).toBe('Acts 16:11');
  });

  it('prints no passage rather than a raw integer when a key does not resolve', () => {
    const broken = shortRoute({ passage: { startKey: 99999999, endKey: 99999999 } });
    expect(toRouteView(broken).passageLabel).toBeNull();
  });

  it('lists every place the chapter names, each exactly once', () => {
    expect(view.places).toHaveLength(15);
    const names = view.places.map((place) => place.location.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every place a distinct React key', () => {
    const keys = view.places.map((place) => place.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('numbers the places from one, in the order the text names them', () => {
    expect(view.places[0]?.position).toBe(1);
    expect(view.places[0]?.location.name).toBe('Derbe');
    expect(view.places[14]?.position).toBe(15);
  });

  it('labels each place with the verse that names it', () => {
    expect(view.places[0]?.verseLabel).toBe('Acts 16:1');
    expect(view.places[14]?.verseLabel).toBe('Acts 16:14');
  });

  it('keeps Jerusalem, which the chapter names without anyone travelling there', () => {
    // Acts 16:4 names Jerusalem as where the decisions were made. It belongs on a map of
    // the places the chapter names; it must never be presented as somewhere Paul went.
    const jerusalem = view.places.find((place) => place.location.name === 'Jerusalem');
    expect(jerusalem?.verseLabel).toBe('Acts 16:4');
  });
});

describe('the stat strip', () => {
  it('counts the places and measures how far apart they are, and nothing else', () => {
    expect(view.stats.map((stat) => stat.caption)).toEqual(['PLACES', 'SPAN']);
  });

  it('has no vocabulary of travel left in it', () => {
    const captions = view.stats.map((stat) => stat.caption).join(' ');
    expect(captions).not.toMatch(/STOP|LEG|JOURNEY|ROUTE|TRAVEL/i);
  });

  it('never claims a sailed distance', () => {
    const captions = view.stats.map((stat) => stat.caption).join(' ');
    expect(captions).not.toMatch(/SEA|SAILED|BY SEA/i);
  });

  it('never invents a duration, which no dataset we hold records', () => {
    const captions = view.stats.map((stat) => stat.caption).join(' ');
    expect(captions).not.toMatch(/DAY|DURATION|TRAVEL TIME/i);
  });

  it('counts all fifteen places', () => {
    expect(view.stats.find((stat) => stat.caption === 'PLACES')?.value).toBe('15');
  });

  it('reports the span in miles, grouped, with the unit joined to the figure', () => {
    expect(view.stats[1]?.value).toMatch(/^[\d,]+\u00a0mi$/);
  });

  it('drops the span cell entirely when there is nothing to span', () => {
    const single: RouteSheetPayload = {
      ...ACTS_16_ROUTE,
      waypoints: [ACTS_16_ROUTE.waypoints[0]!],
    };
    expect(toRouteView(single).stats.map((stat) => stat.caption)).toEqual(['PLACES']);
  });

  it('survives a payload with no waypoints at all', () => {
    const empty: RouteSheetPayload = { ...ACTS_16_ROUTE, waypoints: [] };
    const emptyView = toRouteView(empty);
    expect(emptyView.places).toEqual([]);
    expect(emptyView.coordinates).toEqual([]);
    expect(emptyView.stats).toEqual([{ value: '0', caption: 'PLACES' }]);
  });
});

describe('schemeLabel', () => {
  it('describes the ordering as a method, never as a road anyone walked', () => {
    expect(schemeLabel('chapter')).toBe('Listed in the order this chapter names them');
  });

  it('never uses the vocabulary of travel', () => {
    expect(schemeLabel('chapter')).not.toMatch(/journey|route|travel|stop/i);
  });

  it('falls back rather than printing a wire enum at the reader', () => {
    expect(schemeLabel('pericope')).not.toContain('pericope');
    expect(schemeLabel('pericope').length).toBeGreaterThan(0);
  });
});

describe('coordinates handed to the projection', () => {
  it('are in payload order and in GeoJSON axis order', () => {
    expect(view.coordinates).toHaveLength(15);
    expect(view.coordinates[0]).toEqual([33.361453, 37.348569]);
    // Longitude first. Jerusalem is 31.78 N, 35.23 E — the one place on this map where
    // the two numbers cannot be confused, because its longitude exceeds its latitude.
    const jerusalem = view.coordinates[3]!;
    expect(jerusalem).toEqual([35.234167, 31.776667]);
    expect(jerusalem[0]).toBeGreaterThan(jerusalem[1]);
  });
});

describe('two gazetteer rows pinned at one point', () => {
  /** 1 Samuel 1: Ramathaim-zophim and Ramah share 35.23161, 31.85434 exactly. */
  const oneSite: RouteSheetPayload = {
    ...ACTS_16_ROUTE,
    waypoints: [
      {
        ...ACTS_16_ROUTE.waypoints[0]!,
        name: 'Ramathaim-zophim',
        placeId: 'ramathaim',
        coordinates: [35.23161, 31.85434],
      },
      {
        ...ACTS_16_ROUTE.waypoints[1]!,
        name: 'Ramah',
        placeId: 'ramah',
        coordinates: [35.23161, 31.85434],
      },
      {
        ...ACTS_16_ROUTE.waypoints[2]!,
        name: 'Shiloh',
        placeId: 'shiloh',
        coordinates: [35.29, 32.05],
      },
    ],
  };

  it('still lists all three places, because the chapter names all three', () => {
    expect(toRouteView(oneSite).places).toHaveLength(3);
  });

  it('draws one mark per point, not one per place', () => {
    // The badge teased "3 places named" over a map a reader could count two marks on.
    expect(toRouteView(oneSite).mapPins).toHaveLength(2);
  });

  it('names both places on the mark they share, rather than painting one over the other', () => {
    const shared = toRouteView(oneSite).mapPins[0]!;

    expect(shared.name).toBe('Ramathaim-zophim · Ramah');
  });

  it('tells each row which other names share its site', () => {
    const [first, second, third] = toRouteView(oneSite).places;

    expect(first!.coLocatedWith).toEqual(['Ramah']);
    expect(second!.coLocatedWith).toEqual(['Ramathaim-zophim']);
    expect(third!.coLocatedWith).toEqual([]);
  });

  it('leaves a chapter whose places are all distinct with one mark each', () => {
    expect(view.mapPins).toHaveLength(view.places.length);
  });
});
