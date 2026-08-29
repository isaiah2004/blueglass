# PROVENANCE — OpenBible.info Cross References

**Badge:** Cross-Ref · **Verdict:** USE — already loaded and serving

| | |
|---|---|
| Source URL | https://a.openbible.info/data/cross-references.zip |
| Retrieval date | 2026-08-28 |
| Upstream `Last-Modified` | Mon, 24 Aug 2026 09:17:52 GMT |
| Upstream `ETag` | `"0eacf2cc39afc63137146cb10ab7c374"` |
| Served by | Amazon S3 behind CloudFront |
| Licence | **CC BY 4.0**, asserted inside the data file itself |
| Transformations | **None.** The `.zip` is stored exactly as served. |

## Licence, verified

The licence is stated in the data file's own header row, which is the strongest possible
form of evidence — it travels with the bytes. Retrieved verbatim from
`cross_references.txt` inside the archive:

```
From Verse	To Verse	Votes	#www.openbible.info CC-BY 2026-08-24
```

**Attribution string the UI must render:** `Cross-references © OpenBible.info, CC BY 4.0`

## What is actually in the file

| Metric | Value |
|---|---|
| Archive member | `cross_references.txt` |
| Uncompressed size | 8,302,131 bytes |
| **Data rows** | **344,799** |
| Format | TSV, 3 columns + licence comment in the header |

Real rows, as retrieved:

```
Gen.1.1	Isa.37.16	63
Gen.1.1	Ps.124.8	71
```

`From Verse` and `To Verse` are OSIS ids; `To Verse` may be a **range**
(e.g. `1John.4.9-1John.4.10`) and must be expanded at ingest. `Votes` is the
community-confidence signal that `DECISIONS.md` #11 filters on (`votes > 0`).

## Verification against the running system

The row count **344,799** matches exactly the assertion already hard-coded in the previous
implementation (`load_xrefs.py:143`) and the figure recorded in `ROADMAP.md` §4 and
`PHASE1.md`. The dataset has been refreshed upstream since the earlier research run
(`bible-enrichment/VALIDATION.md` recorded a header date of `2026-08-10`; today's file
reads `2026-08-24`) **and the row count is unchanged**, so a re-ingest is not urgent.

## Coverage

All 66 books of the Protestant canon.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `cross-references.zip` | 1,981,803 | `2006d1af4af558dc39b4dca77023bc1dc77dabf67d8ad9c98e0af1f86fe05644` |

**Total:** 1 files, 1,981,803 bytes.
