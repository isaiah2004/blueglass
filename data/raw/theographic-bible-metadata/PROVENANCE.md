# PROVENANCE — Theographic Bible Metadata

**Badges:** Lineage (`People.csv`), History `year_approx` (`Events.csv`), Route secondary (`Places.csv`)
**Verdict:** USE — but **CC BY-SA**, must stay in share-alike-tagged tables, and see the data-quality warnings

| | |
|---|---|
| Source repo | https://github.com/robertrouse/theographic-bible-metadata |
| Files retrieved from | `https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/master/CSV/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `master` |
| Upstream last push | 2026-04-21T16:36:08Z |
| Licence | **CC BY-SA 4.0** — share-alike |
| Transformations | **None.** Bytes exactly as served. |

## Licence, verified

`LICENSE` was fetched from the repository and is stored verbatim beside the data
(`LICENSE`, 20,131 bytes). Its first line reads:

> Attribution-ShareAlike 4.0 International

It is the unmodified CC BY-SA 4.0 legal code. GitHub repository metadata independently
reports `"spdx_id": "CC-BY-SA-4.0"`.

The share-alike obligation, quoted from §3(b) of the retrieved licence file:

> **b. ShareAlike.**
>
> In addition to the conditions in Section 3(a), if You Share Adapted Material You produce,
> the following conditions also apply.
>
>   1. The Adapter's License You apply must be a Creative Commons license with the same
>      License Elements, this version or later, or a BY-SA Compatible License.
>
>   2. You must include the text of, or the URI or hyperlink to, the Adapter's License You
>      apply. …
>
>   3. You may not offer or impose any additional or different terms or conditions on, or
>      apply any Effective Technological Measures to, Adapted Material that restrict
>      exercise of the rights granted under the Adapter's License You apply.

Note that the trigger is **Sharing Adapted Material** — see the licence analysis in
`docs/architecture/dataset-validation.md` §3.

**Attribution string the UI must render:**
`Theographic Bible Metadata by Robert Rouse, CC BY-SA 4.0`

## What is actually in these files

Verified by parsing the retrieved bytes.

| File | Rows | Columns |
|---|---:|---:|
| `People.csv` | **3,069** | 36 |
| `Places.csv` | **1,274** | 37 |
| `Events.csv` | **450** | 16 |

### People.csv — the Lineage graph

Columns: `personLookup, status, personID, displayTitle, name, surname, alsoCalled,
isProperName, ambiguous, Disambiguation (temp), gender, occupations, birthYear, minYear,
deathYear, maxYear, birthPlace, deathPlace, memberOf, eastons, dictText, events,
eventGroups, verseCount, verses, mother, father, partners, children, siblings,
halfSiblingsSameMother, halfSiblingsSameFather, chaptersWritten, alphaGroup, slug, modified`

Field population, counted from the retrieved file:

| Field | Populated | % |
|---|---:|---:|
| `verses` | 3,067 | 99.9% |
| `gender` | 3,069 | 100.0% |
| `eastons` | 1,817 | 59.2% |
| `father` | 1,584 | 51.6% |
| `children` | 963 | 31.4% |
| `siblings` | 944 | 30.8% |
| `mother` | 200 | 6.5% |
| `partners` | 173 | 5.6% |
| `birthPlace` | 77 | 2.5% |
| `birthYear` | 75 | 2.4% |
| `deathYear` | 64 | 2.1% |
| `occupations` | **0** | **0.0%** |

Real record, as retrieved:

```
name=David  personID=994  gender=Male  verseCount=896
  father    = jesse_903
  mother    = (empty)
  children  = eliphalet_1143,elpalet_1148,elishua_1163,ithream_655,nathan_2152,tamar_2822,
              shobab_2715,eliada_1078,absalom_59,solomon_2762,shephatiah_2657,adonijah_9…
  siblings  = abinadab_44,eliab_1075,elihu_1129,nethaneel_2189,ozem_2260,raddai_2387,shammah_2700
  partners  = abigail_26,abital_54,ahinoam_153,bathsheba_416,eglah_1036,haggith_1353,maacah_1839,michal_2073
  verses    = Ruth.4.17,Ruth.4.22,1Sam.16.13,1Sam.16.19,1Sam.16.20,…
```

Edges are `slug_id` strings joining back to `personLookup`. `verses` is a comma-joined
OSIS list — directly explodable into a `person_verse` table.

#### Two data-quality warnings that must reach the ingest owner

1. **Only 286 of 3,069 rows (9.3%) have `status = publish`. 2,783 are `wip`.** The author's
   own status column marks the overwhelming majority of this file as work in progress. No
   loader should treat all 3,069 rows as publication-ready without a product decision.
2. **1,613 rows (52.5%) carry a non-empty `ambiguous` flag.** Homonym conflation is real
   and reaches the MVP scope. Verified example — `lydia_1837`, whose `dictText` correctly
   describes the Acts 16 seller of purple, carries
   `verses = Gen.36.22,1Chr.1.39,Acts.16.14,Acts.16.40`, pulling two OT Horite-genealogy
   verses into the record for the central character of Acts 16.
   Its `ambiguous` flag is **empty**, so the flag cannot be relied on to catch this class
   of error. STEPBible TIPNR (CC BY 4.0) disambiguates the same name correctly and is the
   recommended cross-check.

### Places.csv — Route secondary only

Columns include `openBibleLat`, `openBibleLong`, `recogitoLat`, `recogitoLon`,
`latitude`, `longitude`, `kjvName`, `esvName`, `featureType`, `precision`, `verses`.

The column names `openBibleLat`/`openBibleLong` are direct evidence that this file
**derives from OpenBible.info**. It is therefore **not independent corroboration** of the
OpenBible geocoding data — it is the same data re-keyed, with a share-alike licence
attached. Prefer `openbible-geocoding/` (CC BY 4.0) as the Route source and treat this as
a secondary lookup only.

### Events.csv — the History `year_approx` candidate

Columns: `title, eventID, startDate, duration, predecessor, lag, lagType, partOf, verses,
participants, locations, groups, notes, verseSort, modified, sortKey`

| Metric | Value |
|---|---|
| Events | **450** |
| Events with `startDate` | **450 (100%)** |
| Events dated AD (startDate > 0) | **137** |

Real rows, as retrieved:

```
title="Creation of all things"        startDate=-4003  duration=7D
title="The church grows"              startDate=0030   verses=Acts.2.42,…,Acts.2.47
title="Peter and John's Trial"        startDate=0030   verses=Acts.4.1,…
title="Stephen is stoned"             startDate=0031   verses=Acts.7.54,…
title="Saul is converted"             startDate=0032   verses=Acts.9.1,…
title="Peter meets Cornelius"         startDate=0038   verses=Acts.10.1,…
```

**Chronology warning.** `startDate=-4003` for "Creation of all things" is Ussher's
4004 BC. This file follows a **biblical-literalist chronology**, and the independent
MetaV dataset states the same lineage explicitly for its own year field ("Source: Annals
of the World, James Ussher"). For **NT-era passages this is broadly uncontroversial** and
usable; for OT passages it encodes a theological position, not a scholarly consensus, and
should not be surfaced as neutral fact. See `dataset-validation.md` §4.

Granularity is coarse — the whole of Acts 2–7 is dated `0030`.

## Discrepancy against the prior research

`bible-enrichment/PROPOSAL.md` §3(e) and `data-inventory.md` §6 both state **1,911
places** for `Places.csv`. The file retrieved today contains **1,274 rows**. Either the
dataset shrank or the earlier figure was wrong; the current number is the one above.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `Events.csv` | 245,371 | `3325439a8d56d9a9f40895d26b119bfd82e5c21ceb07b93fd2e69eec30850a98` |
| `LICENSE` | 20,131 | `7abe19ec9bb73b36141b999b861d24ad855e808bafe0f81e84cce28556f6c297` |
| `People.csv` | 1,618,983 | `44aa63e656077ed02a05747f581c56b5c9242a2d8cf7281344bc734085e0b130` |
| `Places.csv` | 973,162 | `1b27e1a9a2bb93de9442de26b0c1cd11ca721348e06decd9b20acc0502759611` |

**Total:** 4 files, 2,857,647 bytes.
