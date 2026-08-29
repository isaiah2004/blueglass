# History & Structure ingest — what shipped, measured

**Written:** 2026-08-29 · **By:** History & Structure ingest engineer ·
**Method:** every number below is a row count from the real Docker Postgres after
`scripts.ingest_structure` and `scripts.ingest_history` ran. Nothing here is an estimate.

Two badges, two commands, no LLM, no network at load time, **$0 spent**.

```bash
docker compose exec api python -m scripts.ingest_structure   # passages + chiasms
docker compose exec api python -m scripts.ingest_history     # rulers + events + dating
```

---

## 1 · Measured result

| Table | Rows | Source | Licence |
|---|---:|---|---|
| `passages` (scheme `murai`) | **2,005** | Murai pericope list | CC BY 4.0 |
| `literary_structures` | **1,830** | Murai structure workbooks | CC BY 4.0 |
| `structure_nodes` | **10,085** | Murai structure workbooks | CC BY 4.0 |
| `rulers` | **43** | Wikidata SPARQL | CC0 1.0 |
| `historical_events` | **329** (203 events × books) | Theographic `Events.csv` | CC BY-SA 4.0 |
| `passage_dating` | **510** | derived join | CC BY-SA 4.0 |

**Acts, the MVP scope:** 49 pericopes · 49 structures · 344 nodes · 81 events ·
**51 of 51 passages dated.** The structure figures match Murai's own site exactly.

Backend suite after this work: **414 passed**, of which 72 are new (55 unit, 17 integration).

---

## 2 · The five things that would have cost the next agent an hour each

### 2.1 · Four Murai worksheets hold two books each

The workbooks have **62 sheets, not 66**. `Samuel`, `Kings`, `Chronicles` and
`Ezra-Nehemiah` each combine two canonical books, and the only thing that says whether
`4:1-22` is 1 Samuel or 2 Samuel is the abbreviation on the span (`1S4:1a`). Reading the
sheet name alone files **511 pericopes** under the wrong book, silently.

Two more sheet names do not resolve through the API's tolerant book lookup:
`Lamentation` (canonically *Lamentations*) and `SongofSolomon`.

`scripts/murai_books.py` holds the table and **raises** on anything unrecognised.

### 2.2 · The span grammar has eight shapes, not one

Measured across all 1,959 pericopes and 1,933 structured units:

```
1:1-11         1:1-2:6a        3:1-26 4:1-4      2:1-4a
Ac1:1-11       Act3:1-4:4      Gen 1:1-2:4a      1 Sam 4:1-22
```

A `split()`-based parser reads the first four and drops the rest. It also silently loses
the part-verse forms (`4a`, `21c`, `72b` — 26 of them) and the one range that crosses a
chapter inside a single hyphenated span. `scripts/murai_spans.py` uses `finditer` over the
whole cell with an optional book prefix per range, and **raises** on a cell that yields no
range at all — an unparsed span is a pericope missing from the canon.

The two workbooks write **the same range in different notation**: the pericope list has
`3:1-26 4:1-4` where the structure workbook has `Act3:1-4:4`. The only reliable join
between the two files is the resolved verse-key pair, so `passage_id` is derived from it:
`murai:044003001-044004004`.

### 2.3 · The copyright carve-out is wider than the provenance note says

`data/raw/murai-literary-structure/PROVENANCE.md` warns that the English column quotes the
NAB/NRSV/NJB and must be dropped, and gives the shape as a leading verse number:
`1:2 until the day he was taken up (1:2)`.

**Two additions, both verified in the files:**

1. **The Old Testament sheets quote in a different shape** —
   `"and a very loud trumpet blast" (19:16)` — no leading reference, quotation marks
   instead. A filter matching only the documented form leaks the Pentateuch.
2. **The Japanese column is contaminated exactly the same way.** Row after row in Exodus
   carries a Japanese translation of the verse, which is no more Murai's to license than
   the NAB is. The provenance note calls that column "the primary summary" and does not
   flag it. **This ingest never reads it.** The product is English-only, so nothing is
   lost — but a future translation-aware pass must not reach for it.

`scripts/murai_copyright.py` drops any cell containing a verse reference *or* a quotation
mark. Measured: **7,108 of 10,078 English cells dropped, 2,970 kept.** Deliberately
over-broad — a dropped gloss costs one line of summary, a kept quotation costs a licence
we do not hold. An integration test re-proves in SQL that nothing quoted survived.

**What survives is enough.** The per-unit legend — Murai's own prose, e.g.
*"A: Being taken up. B: Appearance, hiding. C: The Holy Spirit. D: Question of
disciples."* — survives for **1,793 of 1,830** structures and for **49 of 49** in Acts.
That legend, not the per-node gloss, is what the badge actually shows.

### 2.4 · Wikidata *does* hold the Herodians and the prefects

`dataset-validation.md` §7 lists this as unverified, because the earlier probe guessed
Q-ids. Resolving the people first, reading their `P39` statements to find the real office
items, then querying by office returns a **complete Judaean governor series with no gaps**:

- **7 prefects**, AD 6–41, including **Pontius Pilate AD 26–36**
- **8 procurators**, AD 44–70, including **Felix AD 52–60** and **Festus AD 60–62**
- **8 kings of Judaea**, including **Herod the Great**, **Agrippa I AD 41–44**, **Agrippa II from AD 48**
- **Herod Antipas**, **Philip the Tetrarch**, **Herod Archelaus**
- **Gallio, proconsul of Achaia, AD 51–52** — the man in Acts 18:12

Every ruler the New Testament names by title is present and dated. **The coverage is not
thin.** Full query, limits and checksums: `data/raw/wikidata-rulers/PROVENANCE.md`.

Four caveats, all recorded as data rather than smoothed over: Herod the Great and Herod
Antipas have **no start date** (stored `NULL`, not guessed); three tetrarchs have no dates
at all and are dropped; Gallio's office carries **no English label** and is mapped by
Q-id; and every Judaean row is year precision written as a 1 January date, which
`rulers.date_precision` records so the UI never renders a false day.

### 2.5 · Verse-key arithmetic is only valid inside one chapter

The first dating pass computed "how much of this passage does the event cover?" from
`end_key - start_key`. Acts 3:1–4:4 is 30 verses but **1,004 keys** apart, so the badge
would have told the reader an event covered *2%* of a passage it covers entirely.
Coverage is now counted as real verses against the loaded scripture.

---

## 3 · Two decisions made enforceable by the schema

Both were previously "the loader must remember". They are now constraints.

| Decision | How it is enforced |
|---|---|
| **`Q-016` — dating is NT-era only.** Ussher's 4004 BC must never ship as neutral fact. | `historical_events` and `passage_dating` both carry `CHECK (book_number BETWEEN 40 AND 66)` and a year band. An Old Testament date is not insertable by any future loader, however well meant. An integration test attempts the insert and asserts the `CheckViolation`. |
| **`Q-015` — Murai's structure is one scholar's reading.** | `literary_structures.attributed_to`, `.claim_label` (`Murai's reading`) and `.claim_type` are all NOT NULL, non-blank by CHECK, and `claim_type` is constrained to a vocabulary in which this ingest only ever writes `interpretive`. The UI cannot omit what the row will not let it. |
| **`AI-05` — every claim carries a source anchor.** | `source_id` is NOT NULL on `rulers`, `historical_events`, `passage_dating` and `literary_structures`. A row with no provenance cannot exist, so a badge cannot render one. |
| **`Q-007` — share-alike stays separable.** | Theographic is the one CC BY-SA source here; its `data_sources.share_alike` is `true` and its rows live in their own tables. `WHERE share_alike` is the whole enforcement mechanism. |

---

## 4 · Honest gaps

1. **Dating stops at the narrative books.** Theographic dates events, and the epistles
   narrate none. Measured coverage: Matthew 148/149 · Mark 81/82 · Luke 149/151 ·
   John 80/83 · **Acts 51/51** · Galatians 1/13 · **every other epistle and Revelation
   0.** The History badge will not light up on Romans. That is a dataset limit, not a bug,
   and no open source fills it.
2. **228 structure nodes (2.2%) are not ingested.** They sit under a header that is a bare
   span rather than `[n]` — sub-analyses of part of a pericope, concentrated in Genesis
   (39) and John (51). They have no pericope to attach to. **Acts has none.**
3. **103 pericopes have no structure at all** — Murai wrote a one-line description and no
   limbs (`"Genealogy of Adam"`). Counted, not lost.
4. **15 Old Testament node spans reach outside the unit header that owns them** — Exodus
   18's header reads 18:7-27 while its first limb starts at 18:1. Upstream
   inconsistencies, pinned by an exact-count assertion rather than repaired: inventing a
   boundary Murai did not write would be worse. **None is in the New Testament**, and a
   sixteenth fails the load.
5. **Only 2,970 of 10,085 nodes keep an English gloss** (99 of 344 in Acts) after the
   copyright filter. The legend carries the reading; the per-node summary is a bonus.
6. **BC years may be off by one.** Wikidata numbers years astronomically (year zero
   exists); Theographic documents negatives as plain BC. For the New Testament the only
   affected rows are Herod's death and the nativity. Recorded rather than "fixed" by
   arithmetic no source supports.
7. **Theographic's day precision is not used.** `startDate` sometimes reads `0030-05-01`,
   but that precision is Ussher-derived and not defensible at day resolution, so the badge
   shows the year.
8. **Murai's Psalms versification differs from the KJV** (superscriptions counted as
   verse 1). Not a problem for the New Testament; it will need TVTMS mapping before the
   Old Testament structure badge ships.

---

## 5 · Files

| Path | What it is |
|---|---|
| `apps/api/scripts/raw_datasets.py` | Where `data/raw/` is, and the licence facts per dataset |
| `apps/api/scripts/data_source_registry.py` | Upserts the `data_sources` row every enrichment row points at |
| `apps/api/scripts/murai_{spans,books,copyright,patterns,records,parser}.py` | The structure parse |
| `apps/api/scripts/ingest_structure.py` · `structure_assertions.py` | Loader + post-load proof |
| `apps/api/scripts/{wikidata_rulers,theographic_events}.py` | The history parses |
| `apps/api/scripts/ingest_history.py` · `history_assertions.py` | Loader + post-load proof |
| `apps/api/db/versions/0004_20260829_history_temporal.py` | `rulers`, `historical_events`, `passage_dating` |
| `apps/api/db/versions/0005_20260829_literary_structure.py` | `literary_structures`, `structure_nodes` |
