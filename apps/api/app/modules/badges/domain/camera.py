"""Framing a set of pins. The one number in the badge layer that is computed.

Purpose
    Decision M-01 rules out a tile provider, so the map is drawn from GeoJSON
    ourselves -- but the sheet still has to open looking at the journey rather
    than at the middle of the Atlantic. This module computes that opening
    camera from the waypoints.

Why this is not a sourced value
    It is not a claim about the world. A camera is a rendering decision derived
    arithmetically from coordinates that ARE sourced, so it needs no citation
    of its own; the pins it frames carry theirs. That distinction is worth
    stating, because AI-05 would otherwise appear to be violated by a number
    with no source.

Determinism
    Results are rounded to six decimal places -- about 10 cm on the ground, far
    below any precision the gazetteer claims -- so the same waypoints produce a
    byte-identical camera on every machine and every call.

Dependencies
    Standard library only. Rule 5.1.2.
"""

from __future__ import annotations

import math

from .payloads import GeoCoordinates, MapCamera

#: Web-mercator convention: zoom 0 shows 360 degrees of longitude.
_WORLD_DEGREES = 360.0

#: Below this the camera would sit inside a single building; above it the whole
#: world is in frame and there is nothing left to zoom out to.
_MIN_ZOOM = 1.0
_MAX_ZOOM = 12.0

#: Padding around the bounding box, as a fraction, so pins are not on the edge.
_PADDING = 1.35

#: A single-pin route has no extent to fit; this is the zoom a city sits at.
_SINGLE_POINT_ZOOM = 9.0

_PLACES = 6


def frame(coordinates: tuple[GeoCoordinates, ...]) -> MapCamera | None:
    """Compute the camera that frames every coordinate given.

    @param coordinates: One or more `[longitude, latitude]` pairs.
    @returns The camera, or None when no coordinates were supplied -- a caller
        with nothing to frame has no route to show either. Side effects: none.
    """
    if not coordinates:
        return None
    longitudes = [point[0] for point in coordinates]
    latitudes = [point[1] for point in coordinates]
    center: GeoCoordinates = (
        round((min(longitudes) + max(longitudes)) / 2, _PLACES),
        round((min(latitudes) + max(latitudes)) / 2, _PLACES),
    )
    span = max(max(longitudes) - min(longitudes), max(latitudes) - min(latitudes))
    return MapCamera(center=center, zoom_level=_zoom_for(span))


def _zoom_for(span_degrees: float) -> float:
    """Zoom that fits `span_degrees` of extent, padded and clamped."""
    if span_degrees <= 0:
        return _SINGLE_POINT_ZOOM
    raw = math.log2(_WORLD_DEGREES / (span_degrees * _PADDING))
    return round(min(max(raw, _MIN_ZOOM), _MAX_ZOOM), 2)
