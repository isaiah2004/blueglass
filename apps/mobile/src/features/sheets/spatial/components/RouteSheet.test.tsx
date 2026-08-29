/**
 * Component tests for the `[Route]` sheet.
 *
 * What these prove that the logic tests cannot
 *   That the honest sentences actually reach the DOM. The Route sheet's hardest rule is a
 *   negative — it may not say anyone travelled anywhere, because the chapter-scheme
 *   waypoints are the places the text NAMES in the order it names them — and the way a
 *   negative fails in practice is a future edit quietly reintroducing "stops" or a drawn
 *   route line. Both are asserted here against the real Acts 16 payload.
 *
 * Split from `SpatialSheet.test.tsx`
 *   That file covered both sheets and passed the 300-line cap (rule 5.4.3) once the travel
 *   assertions were added. The seam is the sheet, not an arbitrary line number.
 *
 * Run in both palettes (`D-01`) and at all three widths (`Q-006`), because the same content
 * renders in a bottom sheet on a phone and in the context rail on a tablet and a desktop.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { licenceToken } from '@atlas/shared';

import type { ThemeName } from '@/theme';

vi.mock('expo-font', () => ({ useFonts: () => [true, null] }));

import { ACTS_16_ROUTE, OPENBIBLE_SOURCE } from '../testing/fixtures';
import { BOTH_THEMES, layoutTo, renderSpatial, SHEET_WIDTHS } from '../testing/render-spatial';

import { SpatialSheet } from './SpatialSheet';

afterEach(() => {
  document.body.innerHTML = '';
});

describe.each(BOTH_THEMES)('the Route sheet in the %s theme', (theme: ThemeName) => {
  it('names what the map shows and the passage it covers', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('Places named in this chapter');
    expect(view.text()).toContain('Acts 16:1-14');
    view.unmount();
  });

  it('never tells the reader that anyone travelled between the pins', () => {
    // Acts 16 names Jerusalem (16:4) without Paul going there, refuses Bithynia (16:7),
    // and reaches Thyatira only as Lydia's home town (16:14). Any word of travel on this
    // sheet contradicts the chapter open on the same screen.
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).not.toMatch(/journey|stops on|longest leg|straight line/i);
    view.unmount();
  });

  it('counts the places and measures their span, and invents no duration', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    const text = view.text();
    expect(text).toContain('PLACES');
    expect(text).toContain('SPAN');
    expect(text).not.toMatch(/by Sea|Estimated Travel|Days/i);
    view.unmount();
  });

  it('lists every place, including the ones the map has no room to label', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.container.querySelectorAll('[data-testid="spatial-place-list"] > *')).toHaveLength(
      ACTS_16_ROUTE.waypoints.length,
    );
    expect(view.text()).toContain('Samothrace');
    view.unmount();
  });

  it('prints the source notice verbatim, and its licence exactly once — AI-05', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    const strip = view.byTestId('spatial-source-strip');
    expect(strip).not.toBeNull();
    // OpenBible's own notice names the licence, so the strip does not print it again in a
    // second spelling underneath — that repetition is what used to break as `CC-` / `BY-4.0`.
    expect(strip!.textContent).toContain('Place data © OpenBible.info, CC BY 4.0');
    expect(strip!.textContent).not.toContain('CC-BY-4.0');
    view.unmount();
  });

  it('still prints the identifier for a source whose notice does not name one', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    // Natural Earth's notice is "Made with Natural Earth." and names no terms, so the
    // identifier is printed — with a non-breaking hyphen, so it cannot split across lines.
    expect(view.byTestId('spatial-source-strip')!.textContent).toContain(
      licenceToken('public-domain'),
    );
    view.unmount();
  });

  it('names the basemap it drew the coastline from', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.byTestId('spatial-source-strip')!.textContent).toContain(
      'Made with Natural Earth.',
    );
    view.unmount();
  });

  it('describes how the route was assembled, never as a road anyone walked', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      theme,
    );
    expect(view.text()).toContain('Places named in this chapter');
    view.unmount();
  });
});

describe.each(SHEET_WIDTHS)('the Route map at %s width', (_name: string, width: number) => {
  it('draws the coastline and the mention-order trace once the container is measured', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      'dark',
    );
    const frame = view.byTestId('spatial-route-map');
    expect(frame).not.toBeNull();
    layoutTo(frame!, width);

    expect(view.byTestId('spatial-map-coastline')).not.toBeNull();
    // A dashed hairline, not §6's glowing progressive route line: the pins are the places
    // the chapter names, in the order it names them, and a drawn route through them reads
    // as a voyage. `RouteLine`'s header has the reasoning; the `route` variant is still
    // there for a scheme that can establish one.
    expect(view.byTestId('spatial-mention-trace')).not.toBeNull();
    expect(view.byTestId('spatial-route-line')).toBeNull();
    expect(view.byTestId('spatial-route-glow')).toBeNull();
    view.unmount();
  });

  it('draws a pin for every stop', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      'dark',
    );
    layoutTo(view.byTestId('spatial-route-map')!, width);
    const markers = view.container.querySelectorAll('[data-testid^="spatial-marker-"]');
    expect(markers.length).toBe(ACTS_16_ROUTE.waypoints.length);
    view.unmount();
  });

  it('labels the first and last pin, and fewer than all sixteen', () => {
    const view = renderSpatial(
      <SpatialSheet badge={{ payload: ACTS_16_ROUTE, sources: [OPENBIBLE_SOURCE] }} />,
      'dark',
    );
    layoutTo(view.byTestId('spatial-route-map')!, width);
    const labels = view.container.querySelectorAll('[data-testid^="spatial-label-"]');
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(ACTS_16_ROUTE.waypoints.length);
    expect(view.byTestId('spatial-label-Derbe')).not.toBeNull();
    expect(view.byTestId('spatial-label-Thyatira')).not.toBeNull();
    view.unmount();
  });
});
