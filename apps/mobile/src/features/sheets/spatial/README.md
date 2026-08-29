# Spatial sheets — `[Route]` and `[3D City]`

The two badge sheets that put a passage on a map. Owned by this directory; nothing outside
it may import from a subfolder — go through `index.ts`.

```tsx
import { SpatialSheet } from '@/features/sheets/spatial';

<SpatialSheet badge={{ payload: badge.payload, sources: badge.sources }} />;
```

The host supplies the container: a bottom sheet below 600 dp, the context rail at and above
it (`design-language.md` §4, `Q-006`). This feature renders no `Modal`, so both paths get
the identical tree. Look at it at `/spike/spatial-sheets`.

**Inside the reader**, register into `features/reader/badges/badge-sheet-slot.tsx` — one
edit, in the reader's own lane, wherever `BadgeSheetProvider` is mounted. `chrome="body"`
drops this feature's heading and source strip, because `BadgeDetail` already draws the
pill, the reference, the teaser, the evidence chips and the `AI-05` attribution:

```tsx
<BadgeSheetProvider
  renderers={{
    route: (badge) => <RouteSheet payload={badge.payload} sources={badge.sources} chrome="body" />,
    city3d: (badge) => (
      <CitySiteSheet payload={badge.payload} sources={badge.sources} chrome="body" />
    ),
  }}
>
```

The reader's `RouteSheetPayload`, `CitySheetPayload`, `SpatialLocation` and `PassageKeys`
(`features/reader/badges/badge-payloads.ts`) are structurally identical to this feature's,
so they pass straight through with no adapter. Note the theme's badge-kind key is `city3d`,
while the wire discriminant is `3d-city`.

---

## 1 · What the sheets show, and what they refuse to

|                 | `[Route]`                                                      | `[3D City]`                                                                    |
| --------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Comes from      | `RoutePayloadOut`                                              | `City3dPayloadOut`                                                             |
| Shows           | Every place the passage names, mapped, and the list beneath it | The site, its modern identification, its precision, where the chapter names it |
| Derives         | The count, and the span between the two furthest-apart pins    | Nothing                                                                        |
| **Never shows** | **Travel, duration, or a distance anybody covered**            | **A 3D reconstruction**                                                        |

**Travel.** This is the sheet's hardest rule and it was got wrong once. Under
`routes.scheme = 'chapter'` the waypoints are derived by reading the place names out of the
chapter in the order the text prints them — a derivation that cannot tell a place travelled
through from a place merely mentioned. Acts 16 contains three of the second kind: Jerusalem,
where the apostles' decisions were made and where Paul does not go (16:4); Bithynia, which
"the Spirit of Jesus would not permit them" to enter (16:7); and Thyatira, which is named
only as Lydia's home town (16:14). The sheet nevertheless titled itself
_"Derbe to Thyatira — 20 stops on this journey"_ and printed a numbered leg list with
distances. Nothing in `data/raw/` supports any of it, so under `AI-05` none of it is said:
the title, the teaser, the stat captions, the list and the pin roles all speak of places
**named**, and the method line sits directly under the heading, above the map.

**Duration.** `image1.png` prints "2 Days / Estimated Travel". No dataset in `data/raw/`
records a sailing time, so the stat does not exist rather than being estimated.

**Distance.** `SPAN` is how far apart the two furthest-apart pins are — a fact about a set
of places, not about a journey, and unchanged by reordering them. The summed-legs figure
that used to sit here was captioned `STRAIGHT LINE`, which sounded careful and still
measured a path nobody walked; `geo/distance.ts` no longer offers one. The mockup's
"125 Miles by Sea" was never reproducible from any coordinate we hold.

**The reconstruction.** `Q-008` and `dataset-validation.md` §4.3 are a confirmed negative:
no openly-licensed 3D reconstruction of a biblical city exists, and the nearest candidate is
CC BY-NC-ND, which fails on NonCommercial and again on NoDerivatives. The sheet says so, in
a sentence, rather than leaving it implied by an absence. `model/reconstruction.ts` is the
interface a commissioned model drops into — and it demands the model's own
`SourceAttribution`, because geometry is a claim too.

**`AI-05`, twice.** The server drops a badge with incomplete provenance before the wire;
`model/attribution.ts` refuses it again at the render boundary, and the refusal is a
rendered explanation, never a blank sheet. Every sheet prints its sources verbatim, the
basemap's included.

---

## 2 · `react-native-svg`, not Skia — what was measured

`M-01`: no tile provider, no Mapbox token, and **web is a first-class target** (`T-01`). The
decision was taken on these numbers, not on preference.

|                               | `react-native-svg` 15.15.4                            | `@shopify/react-native-skia`                                            |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- |
| Already a dependency          | **Yes** — `Card`, `AppBackground`, `InlineBadgeSvg`   | No                                                                      |
| Web runtime                   | Real `<svg>` DOM, no extra payload                    | **CanvasKit WASM**, ~2.9 MB, fetched and initialised before first paint |
| Async gate before first paint | None                                                  | Yes — a sheet must open inside `motion.duration.sheet` (320 ms)         |
| Component tests               | Stubbed already (`testing/react-native-svg-stub.tsx`) | Would need a second harness                                             |
| What it is good at            | Static vector art, a few hundred nodes                | Per-frame raster: shaders, blurs, thousands of nodes                    |

Then the workload, measured in Chrome on the Acts 16 chapter route at a 660 px desktop rail:

- **96 SVG nodes total.** 3 `<path>` (coastline, route glow, route line), 40 `<circle>`
  (20 pins × halo + core), 21 `<g>`, 11 `<text>`, 10 `<rect>`, 7 `<line>`, 4 gradient nodes.
  The 127 coastline rings are **one** path drawn with `fill-rule: evenodd`, so lakes and
  polygon holes subtract themselves and the basemap costs two nodes at any zoom.
- **0.92 ms median / 2.02 ms p95** to project and stringify the whole visible coastline
  (`geo/basemap.ts`), measured over 50 runs after warm-up. The site map is 0.69 ms.
- **7.6 ms median / 8.6 ms p95 frames** through the 460 ms draw, with the coastline path
  rewritten **exactly once** per camera change — the frame loop lives in `RouteLine` alone,
  so 60 frames a second re-render two paths and never the 3,327-point coastline
  (`DECISIONS.md` A-3).

Skia's advantage is per-frame raster work. There is none here: one line animates one
attribute over 460 ms, and the projection that would dominate a redraw already costs under a
millisecond. Its cost — a 2.9 MB WASM binary and an async init on the web target — is paid
on every sheet open. **SVG wins on evidence, and the second-cheapest thing it buys is that
the component tests already have a stub for it.**

One thing SVG cannot do, and how it is worked around: `react-native-svg` does not implement
`feGaussianBlur` on Android, so the route's "soft glow" (`design-language.md` §6) is a wide
translucent stroke under the line rather than a filter. That is also the cheaper choice —
re-blurring under an animating stroke is the per-frame cost `flutter-port-map.md` §7.6
records.

An optimisation that came out of the measurement: `ringsToPath` now culls each ring against
the visible **degrees** before projecting it. Projecting first and discarding after put a
40–67 ms task inside the 320 ms the sheet takes to slide up.

---

## 3 · The basemap

`geo/basemap.data.json` — Natural Earth 1:50m land and lakes, **public domain**, cropped to
`-12..60 E / 10..52 N`, Douglas–Peucker simplified at 0.02° (~2 km), 3 dp.
**100 land rings, 27 lake rings, 3,327 points, 45,921 bytes.**

Regenerate with `node tools/geo/build-basemap.mjs`. Provenance and the licence text are in
`data/raw/natural-earth/PROVENANCE.md`.

Public domain is why it may be bundled at all: `Q-007` forbids redistributing the enrichment
database because of share-alike licences, and Natural Earth carries none. So the map works
with the network off. 1:50m was chosen over 1:110m because Samothrace — an Acts 16:11
waypoint — does not survive at 1:110m; `geo/basemap.test.ts` asserts it survives here, along
with seven cities on land, three seas in the water, and the Sea of Galilee and Dead Sea
subtracting correctly.

---

## 4 · Layout

```
geo/        projection · basemap · distance · route-path · scale-bar · graticule   (pure)
model/      payload types · route-view · city-view · attribution · reconstruction  (pure)
hooks/      draw-progress · use-draw-progress · use-map-viewport
theme/      map-palette — twelve colours, every one derived from a `Theme` role
components/ MapSurface · RouteLine · MapMarker · MapScaleBar · MapGraticule
            RouteMap · CitySiteMap · RouteSheet · CitySiteSheet · SpatialSheet
gallery/    SpatialSheetGallery — the /spike/spatial-sheets diagnostic
```

Everything under `geo/` and `model/` is pure and runs in the `logic` Vitest project. The
components are covered by `components/SpatialSheet.test.tsx` in both palettes and at all
three widths.

**A trap for whoever writes the next component test here.** The component project aliases
`react-native-svg` to a stub that renders every element as a `View` and forwards only
`testID` and the ARIA props. `element.getAttribute('stroke-dashoffset')` therefore returns
`null`, and `Number(null)` is `0` — which is exactly the value a passing reduced-motion
assertion would expect. Such a test passes whether or not the component works. Assert SVG
geometry through the pure functions instead (`hooks/draw-progress.test.ts` has the worked
example) and leave the pixels to the browser.

---

## 5 · Motion

The route line draws progressively over `motion.duration.slow`, linearly — `theme/motion.ts`
reserves its `linear` curve for "progress indicators and route-line draws only", and an
eased draw would read as the ship accelerating.

Under `prefers-reduced-motion` the duration collapses to zero, the line is fully drawn at
first paint, and **no animation frame is ever scheduled**. Verified in Chrome with the media
query forced: 112 dash mutations over 420 ms normally, **0** under reduced motion.

Reanimated is deliberately not used for this. Animating an SVG attribute with it needs
`createAnimatedComponent(Path)` plus `useAnimatedProps`, which on the web goes through
`react-native-worklets` — the package whose module layout Vitest cannot resolve, which is
why `features/reader/testing/reanimated-stub.tsx` exists at all. For one number driving one
attribute, a `requestAnimationFrame` loop is fewer moving parts, identical on both targets,
and testable as two pure functions. Reanimated remains right for gestures and for the
sheet's own spring.

---

## 6 · Known gaps

- **Nothing here has run on Android.** Same position as `spike-inline-badges.md` §6: no AVD,
  no `android/` directory. The residual risks are `fillRule="evenodd"` on a path with 48
  sub-paths, and `<Text>` inside `<Svg>` for the place labels.
- **The map does not pan or zoom.** The camera is fitted once per layout. A gesture layer is
  a later milestone and belongs outside `MapSurface`, which is a pure function of its
  transform.
- **`packages/shared/src/geo.ts` is behind the wire.** `MappedLocation` there has no
  `featureType`, `placeId` or `verseKey`, all three of which the API sends and these sheets
  use. `model/spatial-payload.types.ts` extends it rather than replacing it; when the shared
  type catches up, `SpatialLocation` collapses to an alias.
