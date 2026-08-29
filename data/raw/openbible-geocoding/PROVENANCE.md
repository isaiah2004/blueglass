# PROVENANCE — OpenBible.info Bible Geocoding Data

**Badge:** Route (`spatial_data`) · **Verdict:** USE

| | |
|---|---|
| Source repo | https://github.com/openbibleinfo/Bible-Geocoding-Data |
| Files retrieved from | `https://raw.githubusercontent.com/openbibleinfo/Bible-Geocoding-Data/main/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `main` |
| Upstream last push | 2021-11-01T00:57:12Z (repo is static/dormant — see note) |
| Licence | **CC BY 4.0** |
| Transformations | **None.** Bytes are exactly as served. `geometry/*.geojson` and `all.kml` deliberately NOT retrieved (see below). |

## Licence, verified

`license.txt` was fetched from the repository and is stored verbatim beside the data
(`license.txt`, 18,658 bytes). Its first line reads:

> Attribution 4.0 International

It is the unmodified Creative Commons Attribution 4.0 International legal code. GitHub's
own repository metadata independently reports `"spdx_id": "CC-BY-4.0"`.

**Attribution string the UI must render:** `Place data © OpenBible.info, CC BY 4.0`

**Carve-out not taken:** the repo's `geometry/*.geojson` files carry a `geometry_credit`
field, and OpenStreetMap-derived geometries in that slice are **ODbL** (share-alike), not
CC BY. We did **not** retrieve any geometry file, so no ODbL-encumbered byte is in this
directory. If map polygons are wanted later, that slice must be licence-tagged separately.

## What is actually in these files

Verified by parsing the retrieved bytes, not by reading the upstream docs:

| Metric | Value |
|---|---|
| `ancient.jsonl` records (ancient places) | **1,342** |
| `modern.jsonl` records (modern identifications) | **1,596** |
| Ancient places carrying `verses[]` | **1,285** |
| Distinct verse OSIS ids referenced | **5,616** |
| Ancient places resolvable to ≥1 coordinate | **1,335** |
| Ancient places with **multiple** candidate sites | **777** |
| `modern.jsonl` records with `lonlat` | **1,596** (all) |

### Ingest-critical structural facts

1. **`ancient.jsonl` contains no coordinates at all.** `lonlat` exists only on
   `modern.jsonl`. The Route loader must perform a two-file join:
   `ancient.extra.associations[].modern_id` → `modern.id` → `modern.lonlat`.
   (`ancient.identifications[].id` carries the same ids with `id_source: "modern"`.)
2. **`lonlat` is a `"lon,lat"` string, not an array**, and it is **longitude-first**.
3. **`verses[].sort` is already `BBBCCCVVV`** — e.g. Acts 16:12 → `"44016012"`. This is
   exactly the project's `verse_key` scheme, available for free with no book-map lookup.
4. `extra` is a **JSON-encoded string**, not a nested object. It must be `JSON.parse`d
   a second time.
5. Candidate confidence lives in `extra.associations[].score` (integer, 1000 = certain);
   locational precision lives on the modern record as
   `precision: {description, meters, type}`.

### Real record, retrieved and parsed (Philippi — Acts 16)

```
ancient.jsonl  id=a49e1d0  friendly_id="Philippi"
  verses[0] = {"osis":"Acts.16.12","readable":"Acts 16:12","sort":"44016012",
               "usx":"ACT 16:12","instance_types":{"name":10},
               "translations":["csb","esv","kjv","leb","nasb","net","niv","nkjv","nlt","nrsv"]}
  extra.associations = [{"name":"Philippi","score":1000,"modern_id":"mec5201"}]

modern.jsonl   id=mec5201  friendly_id="Philippi"
  lonlat    = "24.284576,41.012072"
  type      = settlement
  precision = {"description":"point in visible remains","meters":5,"type":"visible"}
```

The 777 multi-candidate places are what satisfies `DECISIONS.md` #10 ("surface scholarly
uncertainty"): the data models disputed identifications natively rather than collapsing
them to a single pin.

## Coverage

Whole Protestant canon by verse reference; **5,616 of 31,102 verses (18.1%)** mention a
geocodable place. Sparse coverage is the expected shape, not a defect.

## Staleness note

The repository's last commit is **2021-11-01**, five years before retrieval. The data is a
static scholarly gazetteer rather than a live feed, so this is not in itself a defect — but
nobody should expect upstream corrections, and this directory is very likely the final
state of the dataset.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `ancient.jsonl` | 11,550,193 | `b8187aa4737e8517ccc090f765d2be11da4c548cd2a59d3cdcb62e952cb8c0f2` |
| `license.txt` | 18,658 | `f5b745ef98087f531e719ee8ca6a96809444573ecc7173c6fa68eaad39b3cc3f` |
| `modern.jsonl` | 3,224,520 | `da731f6e110bac4ea66a9f037a0a31cfb11c4f1efc1206aa9e109092b2c60087` |
| `README.md` | 53,774 | `dfd6e967ffdd139ea2cf3222ed2ca0f56d44da6653247a624aece279ad85e782` |

**Total:** 4 files, 14,847,145 bytes.
