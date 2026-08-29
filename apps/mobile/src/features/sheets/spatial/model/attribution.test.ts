/**
 * Tests for the `AI-05` gate.
 *
 * "Every badge payload names its source and licence, and the UI displays attribution. A
 * badge with no provenance must not render." These tests are that sentence, executable.
 */

import { describe, expect, it } from 'vitest';
import type { SourceAttribution } from '@atlas/shared';

import { OPENBIBLE_SOURCE } from '../testing/fixtures';

import {
  BASEMAP_SOURCE,
  attributionLines,
  canRenderBadge,
  isRenderableSource,
} from './attribution';

describe('isRenderableSource', () => {
  it('accepts a complete source', () => {
    expect(isRenderableSource(OPENBIBLE_SOURCE)).toBe(true);
  });

  it.each<[string, Partial<SourceAttribution>]>([
    ['no key', { key: '' }],
    ['no name', { name: '' }],
    ['no licence', { license: '' }],
    ['no attribution line', { attribution: '' }],
    ['a whitespace-only attribution line', { attribution: '   ' }],
  ])('refuses a source with %s', (_label, missing) => {
    expect(isRenderableSource({ ...OPENBIBLE_SOURCE, ...missing })).toBe(false);
  });

  it('does not require a url — gazetteer entries frequently have none', () => {
    const withoutUrl: SourceAttribution = {
      key: OPENBIBLE_SOURCE.key,
      name: OPENBIBLE_SOURCE.name,
      license: OPENBIBLE_SOURCE.license,
      attribution: OPENBIBLE_SOURCE.attribution,
      shareAlike: OPENBIBLE_SOURCE.shareAlike,
    };
    expect(isRenderableSource(withoutUrl)).toBe(true);
  });
});

describe('canRenderBadge', () => {
  it('refuses a badge with no sources at all', () => {
    expect(canRenderBadge([])).toBe(false);
  });

  it('refuses a badge if any one of its sources is incomplete', () => {
    expect(canRenderBadge([OPENBIBLE_SOURCE, { ...OPENBIBLE_SOURCE, license: '' }])).toBe(false);
  });

  it('accepts a badge whose every source is complete', () => {
    expect(canRenderBadge([OPENBIBLE_SOURCE])).toBe(true);
  });
});

describe('attributionLines', () => {
  it('prints the payload source and the basemap under it', () => {
    const lines = attributionLines([OPENBIBLE_SOURCE]);
    expect(lines.map((line) => line.key)).toEqual(['openbible_geocoding', 'natural_earth_50m']);
  });

  it('prints each attribution line verbatim, because that is what the licence asks', () => {
    const [gazetteer] = attributionLines([OPENBIBLE_SOURCE]);
    expect(gazetteer!.label).toBe('Place data © OpenBible.info, CC BY 4.0');
  });

  it('names the basemap even though Natural Earth asks for no credit', () => {
    expect(BASEMAP_SOURCE.license).toBe('public-domain');
    const lines = attributionLines([]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.label).toBe('Made with Natural Earth.');
  });

  it('carries the share-alike flag through, so `Q-007` can be seen and not inferred', () => {
    const copyleft = { ...OPENBIBLE_SOURCE, key: 'theographic', shareAlike: true };
    const lines = attributionLines([copyleft]);
    expect(lines[0]!.shareAlike).toBe(true);
    expect(lines[1]!.shareAlike).toBe(false);
  });

  it('de-duplicates a source the payload names twice', () => {
    expect(attributionLines([OPENBIBLE_SOURCE, OPENBIBLE_SOURCE])).toHaveLength(2);
  });

  it('drops an incomplete source rather than printing a half-blank line', () => {
    const lines = attributionLines([{ ...OPENBIBLE_SOURCE, attribution: '' }]);
    expect(lines.map((line) => line.key)).toEqual(['natural_earth_50m']);
  });
});
