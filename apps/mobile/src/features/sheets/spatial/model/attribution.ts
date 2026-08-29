/**
 * Decision `AI-05` at the render boundary: no provenance, no badge.
 *
 * Purpose
 *   The server already refuses to put a badge on the wire without complete provenance
 *   (`badges/domain/provenance.py`). This module applies the same rule again on the
 *   client, for two reasons that are not redundancy. First, the sheet is the surface the
 *   rule is *about* — "the UI displays attribution" is the half a server test cannot
 *   prove. Second, the client draws something the server knows nothing about: the
 *   coastline. A map is a claim about where places are, and it needs its own line.
 *
 * Key responsibilities
 *   - Decide whether a set of sources is complete enough to render at all.
 *   - Fold the vendored basemap's own attribution in beside the payload's sources, so the
 *     strip under every spatial sheet names everything the reader is looking at.
 *
 * Dependencies
 *   `@atlas/shared` for `SourceAttribution`, and `../geo/basemap` for the map's own line.
 *   No React.
 */

import { licenceChip, type SourceAttribution } from '@atlas/shared';

import { basemap } from '../geo/basemap';

/** One line of the attribution strip. */
export interface AttributionLine {
  /** Stable key, used as the React key. */
  readonly key: string;
  /** The text the licence obliges us to print, verbatim. */
  readonly label: string;
  /** SPDX-style identifier, or `public-domain`. Always present, for tests and callers. */
  readonly license: string;
  /**
   * What the strip should print as the licence chip, with unbreakable hyphens — or `null`
   * when {@link AttributionLine.label} already names the licence in its own words, in which
   * case printing it again is noise rather than diligence (`licenceChip`, `@atlas/shared`).
   */
  readonly licenseChip: string | null;
  /** True when the licence is copyleft. Drives the `Q-007` note in the strip. */
  readonly shareAlike: boolean;
  /** Where the dataset lives, when it has a public home. */
  readonly url?: string | undefined;
}

/**
 * The basemap's own provenance, as a source.
 *
 * Natural Earth explicitly says crediting is unnecessary. We print it anyway: `AI-05`
 * requires a source anchor for what is on screen, and the coastline under the pins is on
 * screen. See `data/raw/natural-earth/PROVENANCE.md`.
 */
export const BASEMAP_SOURCE: SourceAttribution = {
  key: 'natural_earth_50m',
  name: basemap.source,
  license: basemap.license,
  attribution: basemap.attribution,
  shareAlike: false,
  url: 'https://www.naturalearthdata.com/',
};

/**
 * Whether one source is complete enough to appear under a badge.
 *
 * Mirrors `SourceAttribution.is_renderable` on the server, field for field: the key so the
 * row can be traced, the name and licence so the reader is told what they are looking at
 * and on what terms, and the attribution line, which several of our licences require
 * verbatim. A source missing any of them is not a weak citation but an unusable one.
 *
 * @param source - A source from the badge envelope.
 * @returns True when all four fields carry non-blank text. Side effects: none.
 */
export function isRenderableSource(source: SourceAttribution): boolean {
  return (
    source.key.trim().length > 0 &&
    source.name.trim().length > 0 &&
    source.license.trim().length > 0 &&
    source.attribution.trim().length > 0
  );
}

/**
 * Whether a badge may be rendered at all.
 *
 * The empty case is `false` on purpose, exactly as the server's `all_renderable` has it: a
 * badge with no sources is the thing `AI-05` forbids, and `every` on an empty array would
 * quietly wave it through.
 *
 * @param sources - The badge's sources.
 * @returns True when there is at least one source and every one of them is complete.
 *   Side effects: none.
 */
export function canRenderBadge(sources: readonly SourceAttribution[]): boolean {
  return sources.length > 0 && sources.every(isRenderableSource);
}

/**
 * The lines the attribution strip prints, de-duplicated and basemap included.
 *
 * @param sources - The badge's sources. Incomplete ones are dropped rather than printed
 *   half-blank; `canRenderBadge` is what stops the sheet rendering in that case.
 * @returns One line per distinct source key, the basemap last because it is the ground the
 *   claim is drawn on rather than the claim itself. Side effects: none.
 */
export function attributionLines(
  sources: readonly SourceAttribution[],
): readonly AttributionLine[] {
  const lines = new Map<string, AttributionLine>();
  for (const source of [...sources, BASEMAP_SOURCE]) {
    if (!isRenderableSource(source) || lines.has(source.key)) continue;
    lines.set(source.key, {
      key: source.key,
      label: source.attribution,
      license: source.license,
      licenseChip: licenceChip(source.attribution, source.license),
      shareAlike: source.shareAlike,
      url: source.url,
    });
  }
  return [...lines.values()];
}
