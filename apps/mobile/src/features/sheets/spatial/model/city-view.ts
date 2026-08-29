/**
 * The `[3D City]` payload, turned into what the honest site sheet shows.
 *
 * Purpose
 *   `Q-008` is a confirmed negative — no openly-licensed 3D reconstruction of a biblical
 *   city exists — so this badge ships the **site**, not a reconstruction: where the place
 *   is, what modern place it is identified with, how confident that identification is, and
 *   where scripture names it. Every one of those is a column of the OpenBible gazetteer.
 *   This module is where they become sentences.
 *
 * The line it will not cross
 *   Nothing here writes prose about a city. There is no `summary`, no "leading city of
 *   Macedonia", no era description — the server does not send them because inventing them
 *   would be the pillar-3 violation the product exists to avoid. What the sheet says about
 *   significance is arithmetic on `named_verse_count` and `identification_count`, phrased
 *   so the arithmetic is visible.
 *
 * The identification count is the interesting field
 *   777 of the gazetteer's 1,342 ancient places have more than one proposed modern site.
 *   `DECISIONS.md` forbids hiding that behind a single confident pin, so a disputed site
 *   says so in the sheet's own words rather than in a footnote.
 *
 * Dependencies
 *   `./passage-label`, `./spatial-payload.types`. No React.
 */

import { sharedNameNote } from './identification';
import { formatOsis } from './passage-label';
import type { CitySheetPayload, SpatialLocation } from './spatial-payload.types';

/** One cell of the site sheet's stat strip. */
export interface CityStat {
  readonly value: string;
  readonly caption: string;
}

/** Everything the `[3D City]` sheet renders. */
export interface CityView {
  /** The ancient name, as scripture gives it. */
  readonly title: string;
  /** `Today Tel Lystra`, or `null` when no modern site is identified. */
  readonly modernLabel: string | null;
  /** The pin, for the map. */
  readonly location: SpatialLocation;
  /** `37.6017 N, 32.3384 E`. */
  readonly coordinateLabel: string;
  /** How sure the pin is, in a sentence. Never omitted — an unqualified pin over-claims. */
  readonly precisionNote: string;
  /**
   * `One of 9 places of this name`, or `null` when the name belongs to one place.
   *
   * A different caveat from `precisionNote`, which is about where THIS place is. This one
   * is about whether the sheet is even looking at the place the reader means: three
   * ancient towns are called Bethel, and a sheet headed "Bethel" that says nothing has
   * picked one of them for the reader (`DECISIONS.md` #10).
   */
  readonly sharedNameNote: string | null;
  /** What kind of place it is, capitalised for display. */
  readonly featureLabel: string;
  /** `Acts 16:1`, `Acts 16:2` — where this chapter names it. */
  readonly mentions: readonly string[];
  /** The stat strip. */
  readonly stats: readonly CityStat[];
}

/** Caption for how much of the canon names this place. */
const CANON_CAPTION = 'VERSES NAMING IT';

/** Caption for how many verses of the chapter being read name it. */
const CHAPTER_CAPTION = 'IN THIS CHAPTER';

/** Caption for how many modern sites scholarship proposes. */
const IDENTIFICATION_CAPTION = 'MODERN SITES';

/** Decimal places printed for a coordinate. 4 dp is ~11 m — the gazetteer's own precision. */
const COORDINATE_PRECISION = 4;

/**
 * What each `precision_type` means, in a reader's words.
 *
 * These are the gazetteer's own eight classes, counted out of `modern.jsonl`: distance
 * 395, settlement 378, tel 272, visible 193, water 137, region 128, terrain 88, path 5.
 * Each phrase restates OpenBible's own `precision.description` for that class and adds
 * nothing. The metre figures the dataset also carries are deliberately not printed — the
 * API does not send `precision_meters`, and quoting one from the class alone would be the
 * sheet inventing a number.
 */
const PRECISION_NOTES: Readonly<Record<string, string>> = {
  visible: 'Pinned to visible remains on the ground.',
  tel: 'Pinned to a point on an excavated tel.',
  settlement: 'Pinned inside the modern settlement that occupies the site.',
  distance: 'Pinned to a surveyed point, with a margin the gazetteer states.',
  water: 'Pinned to a point along a watercourse, which runs further than the pin.',
  terrain: 'Pinned to a point on a landform, which is larger than the pin.',
  region: 'A region, not a point. The pin marks somewhere inside it.',
  path: 'Pinned to a point along a route, which runs further than the pin.',
};

/** Used when the gazetteer records no precision class at all. */
const UNKNOWN_PRECISION = 'The gazetteer records no precision class for this pin.';

/** Added when more than one modern site is proposed for the same ancient place. */
const DISPUTED_NOTE = 'Scholarship proposes more than one modern site for this place.';

/**
 * Print a coordinate pair the way an atlas does.
 *
 * @param coordinates - `[longitude, latitude]` — GeoJSON order, latitude second.
 * @returns e.g. `37.6017 N, 32.3384 E`. Side effects: none.
 */
export function formatCoordinates(coordinates: readonly [number, number]): string {
  const [longitude, latitude] = coordinates;
  const northing = `${Math.abs(latitude).toFixed(COORDINATE_PRECISION)} ${latitude < 0 ? 'S' : 'N'}`;
  const easting = `${Math.abs(longitude).toFixed(COORDINATE_PRECISION)} ${longitude < 0 ? 'W' : 'E'}`;
  return `${northing}, ${easting}`;
}

/**
 * Say how sure the pin is.
 *
 * @param precisionType - The gazetteer's own value, or undefined.
 * @param identificationCount - How many modern sites are proposed.
 * @returns One or two sentences. Never empty: a pin with nothing said about it reads as
 *   certain. Side effects: none.
 */
export function precisionNote(
  precisionType: string | undefined,
  identificationCount: number,
): string {
  const base = precisionType === undefined ? UNKNOWN_PRECISION : PRECISION_NOTES[precisionType];
  const resolved = base ?? UNKNOWN_PRECISION;
  return identificationCount > 1 ? `${resolved} ${DISPUTED_NOTE}` : resolved;
}

/** Sentence-case a wire enum such as `settlement` for display. */
function titleCase(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

/**
 * Turn a `[3D City]` payload into the sheet's view model.
 *
 * @param payload - Straight from the badge envelope.
 * @returns Everything the site sheet renders. Side effects: none.
 */
export function toCityView(payload: CitySheetPayload): CityView {
  const mentions = payload.mentionedAt
    .map(formatOsis)
    .filter((label): label is string => label !== null);

  return {
    title: payload.location.name,
    modernLabel: payload.modernName === undefined ? null : `Today ${payload.modernName}`,
    location: payload.location,
    coordinateLabel: formatCoordinates(payload.location.coordinates),
    precisionNote: precisionNote(payload.precisionType, payload.identificationCount),
    sharedNameNote: sharedNameNote(payload.location.sharedNameCount),
    featureLabel: titleCase(payload.location.featureType),
    mentions,
    stats: [
      { value: String(payload.namedVerseCount), caption: CANON_CAPTION },
      { value: String(mentions.length), caption: CHAPTER_CAPTION },
      { value: String(payload.identificationCount), caption: IDENTIFICATION_CAPTION },
    ],
  };
}
