# OpenBible ingest — cross-references, places, routes

**Written:** 2026-08-29 · **By:** places & cross-references ingest engineer
**Every number here is measured** from the acquired bytes and re-checked against the live
database, never quoted from upstream documentation.

Two loaders, one licence (**CC BY 4.0**, no share-alike), zero model calls, zero spend.
Read `dataset-validation.md` §1 and §6.1 first — it records the traps; this records the
shapes they produced.

---

## 1 · What is in the database now

| Table | Rows (measured) | Serves |
|---|---:|---|
| `cross_references` | **344,799** | Cross-Ref badge |
| `places` | **1,342** (1,335 located) | Route, 3D City |
| `place_names` | **4,346** | the gazetteer |
| `place_mentions` | **8,742** across **5,616** verses | "which places are in this verse?" |
| `routes` | **682** | Route badge |
| `route_stops` | **7,070** | Route badge |

Both loaders are idempotent: upsert the source, delete that source's rows, `COPY`, assert,
commit. Re-running changes nothing but `data_sources.loaded_at`.

```bash
docker compose run --rm migrate upgrade head
docker compose exec api python -m scripts.ingest_crossrefs
docker compose exec api python -m scripts.ingest_places     # needs BSB loaded
```

---

## 2 · The queries a badge actually runs

```sql
-- Cross-Ref badge. votes DESC is in the index, so there is no sort.
SELECT to_start_key, to_end_key, votes
FROM cross_references
WHERE from_key = $1 AND votes > 0
ORDER BY votes DESC LIMIT $2;

-- "Which places are named in this verse?"
SELECT p.* FROM place_mentions m
JOIN places p ON p.place_id = m.place_id
WHERE m.verse_key = $1;

-- The route covering a verse, in order.
SELECT p.name, p.lat, p.lng, s.position, s.verse_key
FROM routes r
JOIN route_stops s ON s.route_id = r.route_id
JOIN places p      ON p.place_id  = s.place_id
WHERE int4range(r.start_key, r.end_key, '[]') @> $1
ORDER BY s.position;

-- The attribution AI-05 requires. Never hardcode it in a component.
SELECT s.attribution, s.license, s.retrieved_at
FROM data_sources s WHERE s.key IN ('openbible_xref', 'openbible_geocoding');
```

---

## 3 · Decisions worth knowing before you build on this

**A cross-reference target keeps both endpoints.** 88,150 of the 344,799 rows point at a
range; 637 cross a chapter and 18 cross a book. Expanding them would need a versification
table the source does not carry, and would lose the fact that the reference is to a
passage. Render `to_start_key = to_end_key` as one verse and anything else as a span.

**Negative votes are loaded.** 3,506 rows sit at or below zero. `DECISIONS #11` filters
`votes > 0` at read time, so the threshold stays tunable.

**Coordinates come from the *other* file.** `ancient.jsonl` has none. The join is
`ancient.modern_associations[].modern_id → modern.id → modern.lonlat`, and `lonlat` is a
**longitude-first string**. `place_assertions.py` checks Philippi's exact coordinate and
refuses any row outside lat 5–55 / lng −15–75, because a swapped pair passes every count.

**777 places have rival candidate sites — the majority case.** `places.candidates` is the
full ranked list with each score; `places.lat/lng` is only the best one, for the default
pin. `candidate_count` is a GENERATED column, so it cannot drift. A UI that shows one pin
without saying the identification is disputed is violating `DECISIONS #10`.

**Confidence is clamped, the score is not.** OpenBible's scale runs −407 to 1169 in the
acquired file. `places.confidence` is the score folded into 0..1; the raw integer survives
in `candidates`.

**Route order is read out of scripture.** Verse number orders a chapter. Within one verse,
each place is ranked by where its name appears in the **BSB** text (word-boundary match,
accent- and case-insensitive; 92.3% of located mentions matched). Sorting by name instead
renders Acts 16:11 as "Neapolis, Samothrace, Troas" — the voyage backwards. The loader
asserts the leg reads **Troas → Samothrace → Neapolis → Philippi** before it commits, and
refuses to run at all if no BSB verses are loaded.

**Routes are chapter-scoped for now.** `routes.scheme = 'chapter'`. Hub question `Q-024`
asks whether they should have waited for Murai's pericope boundaries; the column means
passage-level routes can land beside these instead of replacing them.

**An unlocated place is never a route stop.** Seven places have no coordinate at all.
Drawing a leg through where one might have been is the fabrication the 41 km
coordinate-error finding rules out.

---

## 4 · The gazetteer

`apps/api/scripts/place_gazetteer.py` is the component that lets *"never let a model emit
coordinates"* hold: a model emits a place **name**, and this returns the coordinate.

- `normalise_place_name` folds case, accents, punctuation and a leading article. The same
  rule fills `place_names.normalised`, so a lookup done in Python and one done in SQL
  cannot disagree — asserted by an integration test.
- `resolve(name)` returns `None` for an unknown name. **There is no fuzzy fallback**: a
  near-miss on a transliterated name is how Ramah becomes Ramoth, 60 km away. An
  unresolved name is a review item, never a pin.
- An ambiguous name returns every candidate. There really are two Antiochs.
- Only located places are indexed, so a hit always has a coordinate.

Ranking is `weight DESC`: a place's own published name carries 1,000,000, a translation
variant carries its occurrence count (Jerusalem's is 7,819 — which is why the primary
weight is not 1,000), and a modern site name carries 0.

---

## 5 · Files

| Path | What it is |
|---|---|
| `apps/api/scripts/openbible_sources.py` | Where the bytes are, their SHA-256, their licence |
| `apps/api/scripts/osis_refs.py` | OSIS → verse key, including ranges |
| `apps/api/scripts/crossref_rows.py` · `ingest_crossrefs.py` · `crossref_assertions.py` | Cross-Ref |
| `apps/api/scripts/place_rows.py` · `place_parser.py` · `place_writer.py` · `ingest_places.py` | Places |
| `apps/api/scripts/place_gazetteer.py` · `place_text_order.py` · `place_routes.py` | Gazetteer + routes |
| `apps/api/scripts/place_assertions.py` | Post-load checks, run inside the transaction |
| `apps/api/db/versions/0004_…_cross_references.py` · `0005_…_places_and_routes.py` | Schema |
| `apps/api/db/versions/0007_merge_…_parallel_ingest.py` | Rejoins two agent branches; no schema change |

---

## 6 · One repository-wide note

Migrations are being authored by several agents at once. On 2026-08-29 two branches from
`0003` left Alembic with two heads and `alembic upgrade head` — which the compose stack
runs before the API may start — failed for everyone. `0007_merge` fixed it, and
`tests/integration/test_schema.py` now **computes** the head from the migration files and
fails when more than one exists. Before authoring a revision, check
`docker compose run --rm migrate heads`.
