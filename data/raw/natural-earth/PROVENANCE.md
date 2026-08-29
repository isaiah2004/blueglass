# PROVENANCE — Natural Earth 1:50m physical vectors

**Badge:** Route, 3D City (the basemap both sheets draw on) · **Verdict:** USE

| | |
|---|---|
| Source repo | https://github.com/nvkelso/natural-earth-vector |
| Files retrieved from | `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/…` |
| Retrieval date | 2026-08-29 |
| Default branch | `master` |
| Licence | **Public domain** (`LICENSE.md`, retrieved verbatim beside the data) |
| Transformations | **None to these bytes.** The derived, cropped basemap is generated separately — see below. |

## Why this dataset exists in the repo

Decision `M-01`: *custom stylised map from GeoJSON, no tile provider, no Mapbox token.*
A sheet that draws its own map needs coastlines, and the repo had none — every geographic
file already here is point data (`openbible-geocoding`), not polygons.

`openbible-geocoding/PROVENANCE.md` records the reason we could not simply use OpenBible's
own polygons: its `geometry/*.geojson` slice is partly **ODbL** (share-alike) rather than
CC BY, and that carve-out was deliberately not taken. Natural Earth closes the same gap
with no licence encumbrance at all.

## Licence, verified

`LICENSE.md` was fetched from the repository and is stored verbatim beside the data.
Its first line reads:

> Everything here is public domain.

and, under *Credits*:

> No permission is needed to use Natural Earth. Crediting the authors is unnecessary.

Attribution is therefore **optional**. We print it anyway, because `AI-05` requires every
badge payload to name its source and the map is part of that payload.

**Attribution string the UI renders:** `Made with Natural Earth.` — the short form the
licence itself suggests.

Public domain also means `Q-007` (never redistribute the database) does not bite here:
there is no share-alike term to trigger, so the derived basemap may lawfully be **bundled
into the client**, which is what makes an offline, tile-free map possible at all.

## What is actually in these files

| File | Bytes | Features |
|---|---|---|
| `ne_50m_land.geojson` | 1,636,166 | Land polygons, whole world, 1:50m |
| `ne_50m_lakes.geojson` | 876,018 | Lake polygons, whole world, 1:50m |
| `LICENSE.md` | 4,636 | The licence, verbatim |

1:50m was chosen over 1:110m on evidence: at 1:110m the Aegean islands disappear, and
Samothrace is a *waypoint of Acts 16:11* — the exact route the mockup `image1.png` draws.
1:10m was rejected as ~30x larger for detail no sheet-sized viewport can resolve.

## The derived basemap

`tools/geo/build-basemap.mjs` crops these two files to the biblical world
(`-12..60 E`, `10..52 N`), simplifies with Douglas-Peucker at 0.02 deg (~2 km, under one
screen pixel at sheet size), drops rings under 0.0006 sq deg, and rounds to 3 dp.

Output: `apps/mobile/src/features/sheets/spatial/geo/basemap.data.json` —
**100 land rings, 27 lake rings, 3,327 points, 45,921 bytes.**

Regenerate with `node tools/geo/build-basemap.mjs`. The output is committed so the client
build never depends on this directory.
