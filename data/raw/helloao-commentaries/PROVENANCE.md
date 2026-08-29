# PROVENANCE — HelloAO Free Use Bible API (commentaries)

**Badge:** Cultural / chapter context · **Verdict:** USE (the 6 PD commentaries);
**Tyndale OSN is CC BY-SA — keep separable**

| | |
|---|---|
| Source API | https://bible.helloao.org/api/ |
| API code repo | https://github.com/HelloAOLab/bible-api (MIT) |
| Retrieval date | 2026-08-28 |
| Licence | Per commentary — see table |
| Transformations | **None.** JSON responses stored exactly as served. |

## What was retrieved

This is a **live REST API with no bulk dump**. Only the catalogue and two chapter samples
were retrieved, as evidence. Full acquisition is a polite crawl — see
`docs/architecture/dataset-validation.md`.

## Licence, verified — from the API's own catalogue

`available_commentaries.json` was fetched and is stored here. Every entry carries a
machine-readable `licenseUrl`. Verified contents:

| `id` | Name | `licenseUrl` |
|---|---|---|
| `adam-clarke` | Adam Clarke Bible Commentary | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `jamieson-fausset-brown` | Jamieson-Fausset-Brown Bible Commentary | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `john-calvin` | John Calvin's Commentaries | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `john-gill` | John Gill Bible Commentary | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `keil-delitzsch` | Keil and Delitzsch Old Testament Commentary | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `matthew-henry` | Matthew Henry Bible Commentary | `https://creativecommons.org/publicdomain/mark/1.0/` |
| `tyndale` | Tyndale Open Study Notes | **`https://creativecommons.org/licenses/by-sa/4.0/`** |

**6 × Public Domain Mark 1.0 + 1 × CC BY-SA 4.0.** This matches the prior research exactly
and is the cleanest licensing signal of any source reviewed — it is served as structured
data, per record, so the loader can set `data_sources.share_alike` automatically instead
of by hand.

The six PD commentaries carry **no attribution obligation and no share-alike exposure**.
Tyndale OSN must be tagged `share_alike = true`.

## Useful API affordances, verified

Each commentary record in the catalogue carries a **`sha256`** field — e.g. Matthew Henry
is `ad2850450a1e5c0546c275f4bd09b9325ae47424d83311120ca7ced5724c4bc8`. That is a
first-class provenance and change-detection handle: a crawl can be revalidated without
re-fetching the corpus.

Each also reports its own coverage, which quantifies the sparsity the roadmap warns about:

```
matthew-henry: numberOfBooks=65  totalNumberOfChapters=1167  totalNumberOfVerses=4124
```

Matthew Henry's 4,124 verses against 31,102 in the canon is **13% coverage** — the
"no enrichment for this verse is normal" rule is real and measurable.

## Real record, as retrieved

`sample_matthew-henry_ACT_16.json` (95,915 bytes) and
`sample_adam-clarke_ACT_16.json` (55,514 bytes), both `GET /api/c/{id}/{BOOK}/{ch}.json`.

Top-level keys: `commentary, book, chapter, thisChapterLink, thisChapterReference,
nextChapterApiLink, nextChapterReference, previousChapterApiLink, previousChapterReference,
numberOfVerses, simpleChapterApiLink`.

The `book` object carries an `introduction` field (book-level prose) and the `chapter`
object carries the verse-level commentary content. Join key is
`{commentaryId}/{bookId}/{chapter}` — e.g. `matthew-henry/ACT/16`.

## Operational note

No documented rate limit and no bulk download. A full crawl is roughly **8,300 requests**
per commentary-set pass and must be run once, politely, and cached. Treat the `sha256`
values as the cache key.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `available_commentaries.json` | 5,248 | `48bdfc8aeca0275c6c4a45531a242250f260f2258fafae4a1ca362d3dcc43956` |
| `sample_adam-clarke_ACT_16.json` | 55,514 | `78a808673f64d3ca5488b61c20ad3affda00ce48fd204ca814d6c213afac3361` |
| `sample_matthew-henry_ACT_16.json` | 95,915 | `1061d2c441dc8b2932a471226436011fe66e0ee143e7296b5dc9544196f7864b` |

**Total:** 3 files, 156,677 bytes.
