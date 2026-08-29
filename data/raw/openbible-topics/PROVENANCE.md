# PROVENANCE — OpenBible.info Topical Bible (topic scores)

**Badge:** Cross-Ref / topical browsing · **Verdict:** USE

| | |
|---|---|
| Source URL | https://a.openbible.info/data/topic-scores.zip |
| Retrieval date | 2026-08-28 |
| Upstream `Last-Modified` | Mon, 24 Aug 2026 03:26:27 GMT |
| Upstream `ETag` | `"a932195d3655175c2d024962c8c4cec1"` |
| Licence | **CC BY 4.0**, asserted inside the data file itself |
| Transformations | **None.** |

## Licence, verified

From the data file's own header row, retrieved verbatim:

```
Topic	OSIS	Quality Score (based on percentage of votes for the passage)	# Generated 2026-08-24. CC-BY License: www.openbible.info/topics
```

**Attribution string the UI must render:** `Topical data © OpenBible.info, CC BY 4.0`

## What is actually in the file

| Metric | Value |
|---|---|
| Archive member | `topic-scores.txt` |
| Uncompressed size | 2,017,258 bytes |
| **Data rows** | **71,264** |
| Format | TSV, 3 columns |

Real rows, as retrieved:

```
10 commandments	Exod.20.1-Exod.20.26	7
10 commandments	Gal.5.14	4
```

The `OSIS` column may be a **range** and must be expanded at ingest, exactly as with
cross-references.

## Discrepancy against the prior research

`bible-enrichment/PROPOSAL.md` §3(d) records **71,234** rows. The file retrieved today
contains **71,264** — 30 more. The dataset is live and regenerated (header says
"Generated 2026-08-24"), so small drift is expected. Any loader asserting an exact
expected count must use the count recorded here, or assert a range.

## Coverage

**6,712 distinct topics** across the canon (counted from the retrieved file; the prior research recorded 6,751).

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `topic-scores.zip` | 418,292 | `fee5234ebbc4db49cda493e55222d2e95665d17216c2f47fb38f8c0bbcd316d5` |

**Total:** 1 files, 418,292 bytes.
