/**
 * Tests for the `[3D City]` view model, and for the seam a real 3D model would drop into.
 *
 * The assertions that matter most are the negative ones: no reconstruction is claimed, no
 * era is invented, and a disputed identification says so. `Q-008` records that no openly
 * licensed 3D reconstruction of a biblical city exists, and the failure this file guards
 * against is a future edit quietly filling that hole with prose.
 */

import { describe, expect, it } from 'vitest';

import { JERUSALEM_CITY, LYSTRA_CITY, OPENBIBLE_SOURCE } from '../testing/fixtures';

import { formatCoordinates, precisionNote, toCityView } from './city-view';
import {
  NO_RECONSTRUCTIONS,
  isRenderableReconstruction,
  resolveReconstruction,
  type CityReconstruction,
} from './reconstruction';

const lystra = toCityView(LYSTRA_CITY);
const jerusalem = toCityView(JERUSALEM_CITY);

describe('toCityView', () => {
  it('titles the sheet with the ancient name', () => {
    expect(lystra.title).toBe('Lystra');
  });

  it('names the modern site when one is identified', () => {
    expect(lystra.modernLabel).toBe('Today Tel Lystra');
  });

  it('says nothing rather than guessing when no modern site is identified', () => {
    const unidentified = toCityView({ ...LYSTRA_CITY, modernName: undefined });
    expect(unidentified.modernLabel).toBeNull();
  });

  it('prints the coordinates in atlas order, latitude first', () => {
    expect(lystra.coordinateLabel).toBe('37.6017 N, 32.3384 E');
  });

  it('renders the chapter mentions as references, not as OSIS ids', () => {
    expect(lystra.mentions).toEqual(['Acts 16:1', 'Acts 16:2']);
  });

  it('drops an OSIS id it cannot resolve instead of printing it raw', () => {
    const odd = toCityView({ ...LYSTRA_CITY, mentionedAt: ['Acts.16.1', 'Nowhere.1.1', 'bad'] });
    expect(odd.mentions).toEqual(['Acts 16:1']);
  });

  it('reports how many verses of the canon SPELL the place, not how many refer to it', () => {
    // 766, not 955: the gazetteer records 189 further Jerusalem mentions that the English
    // does not spell, and the caption is a claim about words on the page.
    expect(lystra.stats).toContainEqual({ value: '6', caption: 'VERSES NAMING IT' });
    expect(jerusalem.stats).toContainEqual({ value: '766', caption: 'VERSES NAMING IT' });
  });

  it('counts the chapter mentions from the mentions it could actually render', () => {
    expect(lystra.stats).toContainEqual({ value: '2', caption: 'IN THIS CHAPTER' });
    expect(jerusalem.stats).toContainEqual({ value: '1', caption: 'IN THIS CHAPTER' });
  });

  it('publishes how many modern sites are proposed, rather than hiding a dispute', () => {
    expect(lystra.stats).toContainEqual({ value: '1', caption: 'MODERN SITES' });
  });

  it('capitalises the feature type for display', () => {
    expect(lystra.featureLabel).toBe('Settlement');
  });

  it('never invents an era, a summary, or a landmark list', () => {
    const asText = JSON.stringify(lystra);
    expect(asText).not.toMatch(/eraLabel|summary|landmark/i);
  });
});

describe('formatCoordinates', () => {
  it('reads longitude second, which is the axis-order trap', () => {
    // Philippi is 41.01 N, 24.28 E.
    expect(formatCoordinates([24.284576, 41.012072])).toBe('41.0121 N, 24.2846 E');
  });

  it('marks the southern and western hemispheres', () => {
    expect(formatCoordinates([-8.5, -12.25])).toBe('12.2500 S, 8.5000 W');
  });
});

describe('precisionNote', () => {
  it('restates each of the gazetteer classes rather than ranking them', () => {
    expect(precisionNote('tel', 1)).toBe('Pinned to a point on an excavated tel.');
    expect(precisionNote('visible', 1)).toBe('Pinned to visible remains on the ground.');
    expect(precisionNote('region', 1)).toBe(
      'A region, not a point. The pin marks somewhere inside it.',
    );
  });

  it('never prints a metre figure the API did not send', () => {
    for (const type of ['tel', 'visible', 'settlement', 'distance', 'water', 'terrain']) {
      expect(precisionNote(type, 1)).not.toMatch(/\d/);
    }
  });

  it('always says something — an unqualified pin reads as certain', () => {
    expect(precisionNote(undefined, 1).length).toBeGreaterThan(0);
    expect(precisionNote('a-class-that-does-not-exist', 1)).toBe(
      'The gazetteer records no precision class for this pin.',
    );
  });

  it('adds the dispute note when more than one modern site is proposed', () => {
    expect(precisionNote('tel', 3)).toContain('more than one modern site');
    expect(precisionNote('tel', 1)).not.toContain('more than one modern site');
  });
});

describe('the reconstruction seam', () => {
  const model: CityReconstruction = {
    id: 'philippi-forum',
    eraLabel: 'Roman colony, c. AD 50',
    attribution: OPENBIBLE_SOURCE,
    render: () => null,
  };

  it('ships empty, which is the truth M2 has to tell', () => {
    expect(NO_RECONSTRUCTIONS.lookup('a49e1d0')).toBeNull();
  });

  it('shows nothing when the server says there is nothing', () => {
    const registry = { lookup: () => model };
    expect(resolveReconstruction(registry, 'a49e1d0', false)).toBeNull();
  });

  it('shows a model only when the server and the registry agree', () => {
    const registry = { lookup: () => model };
    expect(resolveReconstruction(registry, 'a49e1d0', true)).toBe(model);
  });

  it('refuses a model with no provenance, because geometry is a claim too', () => {
    const anonymous: CityReconstruction = {
      ...model,
      attribution: { ...OPENBIBLE_SOURCE, attribution: '   ' },
    };
    expect(isRenderableReconstruction(anonymous)).toBe(false);
    expect(resolveReconstruction({ lookup: () => anonymous }, 'a49e1d0', true)).toBeNull();
  });

  it('refuses a model with no era, which would be shown undated', () => {
    expect(isRenderableReconstruction({ ...model, eraLabel: '' })).toBe(false);
  });
});
