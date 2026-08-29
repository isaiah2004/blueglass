/**
 * Component tests for the `[3D City]` (Site) sheet, the `chrome` prop and the `AI-05` gate.
 *
 * The `[Route]` sheet's own tests are `RouteSheet.test.tsx` — split out when this file
 * passed the 300-line cap (rule 5.4.3).
 *
 * What these prove that the logic tests cannot
 *   That the honest sentences actually reach the DOM. The `[3D City]` sheet's whole
 *   justification is a confirmed negative (`Q-008`), and the way that fails in practice is
 *   not a wrong number — it is a future edit deleting the sentence that explains why there
 *   is no model, leaving a badge called "3D City" that shows a flat map for no stated
 *   reason. Likewise `AI-05`: the refusal path has to render something a reader can read.
 *
 * Run in both palettes (`D-01`) and at all three widths (`Q-006`), because the same content
 * renders in a bottom sheet on a phone and in the context rail on a tablet and a desktop.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import { ACTS_16_ROUTE, JERUSALEM_CITY, LYSTRA_CITY, OPENBIBLE_SOURCE } from '../testing/fixtures';
import { BOTH_THEMES, layoutTo, renderSpatial } from '../testing/render-spatial';

import { SpatialSheet } from './SpatialSheet';

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('the site sheet in the %s theme', (theme: ThemeName) => {
  it('names the site and its modern identification', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('Lystra');
    expect(view.text()).toContain('Today Tel Lystra');
    view.unmount();
  });

  it('says out loud why there is no 3D model — Q-008', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('No openly licensed 3D reconstruction');
    view.unmount();
  });

  it('prints the coordinates and how precise the pin is', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('37.6017 N, 32.3384 E');
    expect(view.text()).toContain('excavated tel');
    view.unmount();
  });

  it('lists where this chapter names the place', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('Acts 16:1');
    expect(view.text()).toContain('Acts 16:2');
    view.unmount();
  });

  it('reports how much of the canon names it', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: JERUSALEM_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('766');
    expect(view.text()).toContain('VERSES NAMING IT');
    view.unmount();
  });

  it('draws a site map with a scale bar once measured', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    layoutTo(view.byTestId('spatial-city-map')!, 358);
    expect(view.byTestId('spatial-map-coastline')).not.toBeNull();
    expect(view.byTestId('spatial-marker-Lystra')).not.toBeNull();
    expect(view.byTestId('spatial-scale-bar')).not.toBeNull();
    view.unmount();
  });

  it('opens a balanced frame on a coastal site, and says nothing about it', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    layoutTo(view.byTestId('spatial-city-map')!, 358);
    // Lystra widens until land and water share the frame, so there is nothing to explain.
    expect(view.byTestId('spatial-city-inland-note')).toBeNull();
    view.unmount();
  });

  it('explains a landlocked frame instead of leaving it looking broken', () => {
    // Babylon, from the gazetteer: no zoom down to the floor puts a fifth of the frame
    // under water. An unexplained field of one colour is what the Lystra report called a
    // rendering bug, so the map says why it looks like that.
    const babylon = {
      ...LYSTRA_CITY,
      location: { ...LYSTRA_CITY.location, name: 'Babylon', coordinates: [44.422222, 32.543333] },
    } as typeof LYSTRA_CITY;
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: babylon, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    layoutTo(view.byTestId('spatial-city-map')!, 358);

    expect(view.byTestId('spatial-city-inland-note')).not.toBeNull();
    expect(view.text()).toContain('Inland');
    view.unmount();
  });

  it('draws no line between pins at all — a site is one place', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    layoutTo(view.byTestId('spatial-city-map')!, 358);
    expect(view.byTestId('spatial-route-line')).toBeNull();
    expect(view.container.querySelector('[data-testid="spatial-mention-trace"]')).toBeNull();
    view.unmount();
  });
});

describe('chrome body, for the reader badge slot', () => {
  it('drops the heading and the source strip the host already draws', () => {
    const view = renderSpatial(
      <SpatialSheet
        badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }}
        chrome="body"
      />,
      'dark',
    );
    expect(view.byTestId('spatial-sheet-heading')).toBeNull();
    expect(view.byTestId('spatial-source-strip')).toBeNull();
    view.unmount();
  });

  it('keeps the map, the stats and the place list — only the chrome goes', () => {
    const view = renderSpatial(
      <SpatialSheet
        badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }}
        chrome="body"
      />,
      'dark',
    );
    expect(view.byTestId('spatial-route-map')).not.toBeNull();
    expect(view.text()).toContain('SPAN');
    expect(view.text()).toContain('Samothrace');
    view.unmount();
  });

  it('keeps the Q-008 disclosure on the site sheet, which is content and not chrome', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: LYSTRA_CITY, sources: [OPENBIBLE_SOURCE] }} chrome="body" />,
      'dark',
    );
    expect(view.text()).toContain('No openly licensed 3D reconstruction');
    expect(view.text()).toContain('37.6017 N, 32.3384 E');
    view.unmount();
  });

  it('still refuses a badge with no provenance — the gate is not chrome', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [] }} chrome="body" />,
      'dark',
    );
    expect(view.byTestId('spatial-sheet-no-provenance')).not.toBeNull();
    view.unmount();
  });
});

describe('the AI-05 gate', () => {
  it('refuses a badge with no sources, and says why', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [] }} />,
      'dark',
    );
    expect(view.byTestId('spatial-sheet-no-provenance')).not.toBeNull();
    expect(view.byTestId('spatial-route-sheet')).toBeNull();
    expect(view.text()).toContain('without a complete source record');
    view.unmount();
  });

  it('refuses a badge whose source is missing its attribution line', () => {
    const view = renderSpatial(
      <SpatialSheet
        badge={{ payload: LYSTRA_CITY, sources: [{ ...OPENBIBLE_SOURCE, attribution: '' }] }}
      />,
      'dark',
    );
    expect(view.byTestId('spatial-sheet-no-provenance')).not.toBeNull();
    expect(view.byTestId('spatial-city-sheet')).toBeNull();
    view.unmount();
  });

  it('renders something rather than nothing, so the sheet never opens onto a blank', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [] }} />,
      'dark',
    );
    expect(view.text().length).toBeGreaterThan(40);
    view.unmount();
  });
});
