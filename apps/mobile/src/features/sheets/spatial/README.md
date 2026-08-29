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

|                 | `[Route]`                                                         | `[3D City]`                                                                    |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Comes from      | `RoutePayloadOut`                                                 | `City3dPayloadOut`                                                             |
| Shows           | Every place the passage names, mapped, and the list beneath it    | The site, its modern identification, its precision, where the chapter names it |
| Derives         | The count, and the span between the two furthest-apart pins       | Nothing                                                                        |
| **Never draws** | **A line between the pins under a scheme that cannot attest one** | —                                                                              |
| **Never shows** | **Travel, duration, or a distance anybody covered**               | **A 3D reconstruction**                                                        |

**Travel, and the line that asserted it.** This is the sheet's hardest rule and it has now
been got wrong three times. Under
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

**The connector.** The wording was fixed twice and the _picture_ was left saying the old
thing. A cyan polyline joined the pins in mention order — later softened to a dashed
hairline at 42 % strength — and in the desktop rail it still ran from Derbe across the
Mediterranean to Jerusalem. A line between two pins asserts that somebody went from one to
the other, and no amount of thinning changes what it asserts; that is a pillar-3 false claim
drawn rather than written. So under `mentionOrder` **no line is drawn at all**: the places
are points, and `MapKey` prints `Places named, not a journey` on the drawing itself, because
a map cropped into a rail or screenshotted carries none of the sheet copy with it.
`RouteLine` still exists unchanged for a scheme that can establish an ordered journey — the
glowing progressive line of `design-language.md` §6, keyed as `Attested journey`. The two
maps are then unmistakably different pictures, which is the only way a reader can tell which
claim they are looking at. `TRAVEL_SCHEMES` in `model/route-view.ts` is the list that
switches them, and it is empty today.

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

## 3 · Framing, and why a map frame is measured

Two reports, one cause. An inland site (Lystra) opened on a frame that was **3 % water** — a
near-empty grid with a corner of Lake Tuz and a corner of the Gulf of Antalya intruding from
the edges, which reads as a rendering bug rather than as a map. And the route map, which fits
its camera to the pins, fits it to nothing when a chapter's places are all in one town:
**Mark 11** names Jerusalem, Bethphage, Bethany and the Mount of Olives, spanning **0.022
degrees**.

Two rules were tried before this one, and both shipped that picture:

| Rule                                   | Why it failed                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| "Is a coastline ring visible?"         | The single ring carrying Asia overlaps the viewport for every inland site in the gazetteer. Lystra had a visible coastline while showing none.  |
| "Are twelve of its vertices in frame?" | Twelve points of a lake in one corner and twelve of a gulf in the other **are** twelve points. This is the rule the reported screenshot passed. |

`geo/frame-geography.ts` measures the quantity a reader actually judges instead: the **share
of the frame that is water**, by sampling a 9 x 7 grid across the visible degrees and
ray-casting each sample against the same even-odd rings the basemap draws with. Measured at
**0.21 ms** per call against the whole basemap.

`geo/map-framing.ts` steps the camera out until that share is between 0.18 and 0.82 — both
elements present — stopping at a floor of zoom 3. Measured at the four container widths the
sheets are handed:

| Site       | Water at the preferred zoom | Outcome                                         |
| ---------- | --------------------------- | ----------------------------------------------- |
| Jerusalem  | 0.25 - 0.30                 | keeps its framing; the loop exits immediately   |
| Samothrace | 0.43 - 0.59                 | keeps its framing                               |
| Lystra     | 0.00 - 0.11                 | widens one to one-and-a-half zoom levels        |
| Babylon    | 0.00 - 0.03 at every zoom   | **landlocked**: opens at the floor, and says so |

`framedTransform` applies the same rule to a fitted route camera, about the fit's own centre,
and **only ever widens** — so every pin the fit included is still included, and a route
already wider than the floor (Acts 21 spans nine degrees) is returned untouched.

When no zoom can balance the frame the map does not pretend otherwise: it labels **every**
grid line instead of the usual two, because with no coast the graticule is the only geography
there is, and it prints `Inland — widest view` in the corner above the scale bar. If a
frame draws no coastline at all — which the gazetteer cannot produce inside the basemap's
crop, but a bad coordinate can — it says `No coastline in view` instead.

**Land and sea have to be tellable apart for any of that to matter.** At `LAND_ALPHA = 0.30`
land measured **1.31:1** against the sea in the dark palette and **1.35:1** in the light one,
which is why the reported coastline read as two unexplained black wedges rather than as a
coast. It is now 0.55 — **1.84:1** and **1.77:1** — and the coastline stroke is
`ink.secondary` at full strength, which measures **4.1:1** against land and **7.6:1** against
sea (3.9 and 6.9 in the light palette), both clear of WCAG 1.4.11's 3:1 bar for a graphic
that carries meaning. `theme/map-palette.test.ts` holds every one of those figures to a floor.

## 4 · The basemap

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

## 5 · Layout

```
geo/        projection · basemap · frame-geography · map-framing · distance
            route-path · scale-bar · graticule                                     (pure)
model/      payload types · route-view · city-view · attribution · reconstruction  (pure)
hooks/      draw-progress · use-draw-progress · use-map-viewport · use-route-geometry
theme/      map-palette — fourteen colours, every one derived from a `Theme` role
components/ MapSurface · RouteLine · MapMarker · MapScaleBar · MapGraticule · MapKey
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

## 6 · Motion

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

## 7 · Known gaps

- **Nothing here has run on Android.** Same position as `spike-inline-badges.md` §6: no AVD,
  no `android/` directory. The residual risks are `fillRule="evenodd"` on a path with 48
  sub-paths, and `<Text>` inside `<Svg>` for the place labels.
- **The map does not pan or zoom.** The camera is fitted once per layout. A gesture layer is
  a later milestone and belongs outside `MapSurface`, which is a pure function of its
  transform.
- **The route map draws no scale bar.** After framing, a tight cluster such as Mark 11's four
  places is one blob beside Jerusalem — true, and the list beneath still names all four, but
  a bar would say _how_ tight. `MapScaleBar` is ready; the corner it would sit in is now the
  key's, so placing both needs the stacking inset `CitySiteMap` already uses.
- **`packages/shared/src/geo.ts` is behind the wire.** `MappedLocation` there has no
  `featureType`, `placeId` or `verseKey`, all three of which the API sends and these sheets
  use. `model/spatial-payload.types.ts` extends it rather than replacing it; when the shared
  type catches up, `SpatialLocation` collapses to an alias.
