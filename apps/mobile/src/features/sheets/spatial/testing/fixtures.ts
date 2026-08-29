/**
 * Real badge payloads, captured from the running API.
 *
 * Purpose
 *   Every fixture here was taken verbatim from
 *   `GET /badges/chapters/BSB/Acts/16` on 2026-08-29 and camel-cased, which is the one
 *   transformation the client's decoder applies. Hand-written fixtures are how a component
 *   ends up passing its tests and failing on the real wire: Acts 16 names fifteen distinct
 *   places, mixes settlements with regions and one island, includes Jerusalem — which the
 *   chapter names without anyone going there — and ends its list at Thyatira, which is
 *   Lydia's home town. None of that is what anyone inventing a fixture would write.
 *
 *   Sixteen until the route badge started checking its own claim. The sixteenth was
 *   Greece, which Acts 16 never names — the gazetteer records it at 16:9 because "a man
 *   of Macedonia" implies it. A fixture is a copy of the wire, so it lost the place when
 *   the wire did.
 *
 * Regenerate
 *   `curl -s http://localhost:8010/badges/chapters/BSB/Acts/16`, then camel-case the keys.
 *
 * Dependencies
 *   The spatial payload types. No React, so both Vitest projects can import it.
 */

import type { SourceAttribution } from '@atlas/shared';

import type { CitySheetPayload, RouteSheetPayload } from '../model/spatial-payload.types';

/** The OpenBible gazetteer, as the API attributes it. */
export const OPENBIBLE_SOURCE: SourceAttribution = {
  key: 'openbible_geocoding',
  name: 'OpenBible.info Bible Geocoding Data',
  license: 'CC-BY-4.0',
  attribution: 'Place data © OpenBible.info, CC BY 4.0',
  shareAlike: false,
  url: 'https://github.com/openbibleinfo/Bible-Geocoding-Data',
  version: '2021-11-01',
  retrievedAt: '2026-08-28',
};

/** `route~44016001~chapter:Acts.16` — every place Acts 16 names, fifteen of them. */
export const ACTS_16_ROUTE: RouteSheetPayload = {
  kind: 'route',
  title: 'Places named in this chapter',
  camera: { center: [28.887083, 36.688333], zoomLevel: 4.39 },
  passage: { startKey: 44016001, endKey: 44016014 },
  scheme: 'chapter',
  waypoints: [
    {
      name: 'Derbe',
      coordinates: [33.361453, 37.348569],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'aa401a9',
      verseKey: 44016001,
      sharedNameCount: 1,
      // Three, as the loaded gazetteer records: Derbe is one of the 777 ancient places
      // with rival modern sites, and it is what keeps the DECISIONS #10 caveat exercised
      // by a fixture rather than only by a unit test. No place Acts 16 names shares a
      // name with another, so `sharedNameCount` is honestly 1 throughout this chapter.
      candidateCount: 3,
    },
    {
      name: 'Lystra',
      coordinates: [32.3384, 37.6017],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'af0719d',
      verseKey: 44016001,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Iconium',
      coordinates: [32.492331, 37.872202],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'ae425aa',
      verseKey: 44016002,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Jerusalem',
      coordinates: [35.234167, 31.776667],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'a15257a',
      verseKey: 44016004,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Asia',
      coordinates: [28.3, 38.4],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'a197f19',
      verseKey: 44016006,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Phrygia',
      coordinates: [31, 39],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'ab8ae56',
      verseKey: 44016006,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Galatia',
      coordinates: [32.983333, 39.266667],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'a0f440a',
      verseKey: 44016006,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Mysia',
      coordinates: [28.5, 40],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'a2d9bc8',
      verseKey: 44016007,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Bithynia',
      coordinates: [31, 40.5],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'a5c0cb0',
      verseKey: 44016007,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Troas',
      coordinates: [26.158611, 39.751944],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'a91c509',
      verseKey: 44016008,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Macedonia',
      coordinates: [22.54, 41.6],
      role: 'waypoint',
      featureType: 'region',
      placeId: 'a69e1b8',
      verseKey: 44016009,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Samothrace',
      coordinates: [25.583333, 40.45],
      role: 'island',
      featureType: 'island',
      placeId: 'a68750d',
      verseKey: 44016011,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Neapolis',
      coordinates: [24.415, 40.935],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'a6a7150',
      verseKey: 44016011,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Philippi',
      coordinates: [24.284576, 41.012072],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'a49e1d0',
      verseKey: 44016012,
      sharedNameCount: 1,
      candidateCount: 1,
    },
    {
      name: 'Thyatira',
      coordinates: [27.83655, 38.92021],
      role: 'waypoint',
      featureType: 'settlement',
      placeId: 'a94b661',
      verseKey: 44016014,
      sharedNameCount: 1,
      candidateCount: 1,
    },
  ],
};

/** `3d-city~44016001~af0719d` — a small site with exactly one modern identification. */
export const LYSTRA_CITY: CitySheetPayload = {
  kind: '3d-city',
  location: {
    name: 'Lystra',
    coordinates: [32.3384, 37.6017],
    role: 'waypoint',
    featureType: 'settlement',
    placeId: 'af0719d',
    verseKey: 44016001,
    sharedNameCount: 1,
    candidateCount: 1,
  },
  modernName: 'Tel Lystra',
  identificationCount: 1,
  precisionType: 'tel',
  namedVerseCount: 6,
  mentionedAt: ['Acts.16.1', 'Acts.16.2'],
  hasReconstruction: false,
};

/** `3d-city~44016004~a15257a` — the other extreme: 766 verses of the canon name it. */
export const JERUSALEM_CITY: CitySheetPayload = {
  kind: '3d-city',
  location: {
    name: 'Jerusalem',
    coordinates: [35.234167, 31.776667],
    role: 'waypoint',
    featureType: 'settlement',
    placeId: 'a15257a',
    verseKey: 44016004,
    sharedNameCount: 1,
    candidateCount: 1,
  },
  modernName: 'Jerusalem',
  identificationCount: 1,
  precisionType: 'settlement',
  namedVerseCount: 766,
  mentionedAt: ['Acts.16.4'],
  hasReconstruction: false,
};
