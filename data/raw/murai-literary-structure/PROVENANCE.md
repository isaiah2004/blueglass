# PROVENANCE — Literary Structure of the Bible (Hajime Murai)

**Badges:** **Chiasm / Structure** (`structural_data`), plus a canon-wide **pericope table**
**Verdict:** USE — with the verse-quotation carve-out below strictly observed

| | |
|---|---|
| Source site | http://bible.literarystructure.info/bible/bible_e.html |
| Files retrieved from | `http://bible.literarystructure.info/bible/<filename>` |
| Retrieval date | 2026-08-28 |
| Author | Hajime Murai |
| Version | No version string is published. Per-book "Updated" dates on the index page range 2015-03-28 → 2024-01-05; the spreadsheets are marked "Updated 2022/02/24". |
| Licence | **CC BY 4.0** (see carve-out) |
| Transformations | **None.** Bytes exactly as served. |

## Licence, verified

The index page states, in its own words:

> Literary Structure of the Bible by Hajime Murai is licensed under a Creative Commons
> Attribution 4.0 International License.

immediately followed by a caution that **materially constrains what we may ship**:

> Caution: The copyright of the cited Bible verses belongs to each translator and publisher.

The page also cites: "Citations of the Bible are from New American Bible, New Revised
Standard Version and New Jerusalem Bible."

### What this means for ingest — a hard rule

Murai's **own** work — the pericope boundaries, the pericope titles, the A/B/C/D/C′/B′/A′
node labels and spans, the structural summaries, and the parallel-passage links — is
**CC BY 4.0** and may be ingested and shipped with attribution.

The **English verse-quotation column** in the structure spreadsheets contains NAB / NRSV /
NJB text, which is **copyrighted by those publishers and is not Murai's to license**.
That column must be **dropped at ingest** and must never reach the database or the client.
Substitute the project's own PD KJV text for the same verse span.

**Attribution string the UI must render:**
`Literary structure analysis by Hajime Murai, CC BY 4.0 — bible.literarystructure.info`

**HTTPS note.** The site's certificate does not match the hostname (it presents a
`*.sakura.ne.jp` wildcard). Retrieval was over plain **HTTP**. Any re-fetch script must
account for this; it also means integrity depends on the checksums below rather than TLS.

## What is actually in these files

Verified by parsing the retrieved workbooks with `openpyxl`.

| File | Sheets | Content |
|---|---:|---|
| `LiteraryStructureoftheBible_PericopeList_OT.xlsx` | 35 | **1,152** pericopes |
| `LiteraryStructureoftheBible_PericopeList_NT.xlsx` | 27 | **807** pericopes |
| `LiteraryStructureoftheBible_PericopeStructure_OT.xlsx` | 35 | 1,148 structured units, **6,248** chiastic nodes |
| `LiteraryStructureoftheBible_PericopeStructure_NT.xlsx` | 27 | 785 structured units, **4,056** chiastic nodes |

**Canon totals: 1,959 pericopes · 1,933 structured units · 10,304 chiastic nodes.**
**Acts alone: 49 structured pericopes, 344 chiastic nodes.**

One sheet per book, named in English (`Matthew`, `Acts`, …).

### Pericope list — real rows (sheet `Acts`)

```
1   1:1-11        The Ascension of Jesus
2   1:12-26       Mathias chosen to replace Judas
3   2:1-13        The coming of the Holy Spirit
4   2:14-39       Peter addresses the crowd
5   2:40-47       Life among the believers
6   3:1-26 4:1-4  Peter heals a crippled beggar
7   4:5-22        Peter and John before the council
```

Three columns: ordinal, verse span, English title. Note row 6 — spans **can cross chapter
boundaries** and are space-separated, so the parser must handle multi-range spans.

This directly answers the `passage_id` / pericope-boundary problem recorded as **Q-009**
in `data-inventory.md` §6 ("No verified open pericope dataset").

### Chiastic structure — real rows (sheet `Acts`, pericope 1)

Columns are: node label + span · Japanese summary · English summary (may contain a
copyrighted verse quotation) · Greek catchword.

```
[1]        Ac1:1-11
A(1:1-2)   天に上げられた日(1:2)          1:2 until the day he was taken up (1:2)      a)nelh/mfqh
B(1:3)     四十日にわたって彼らに現れ(1:3)  1:3 appearing to them during forty days (1:3)
C(1:4-5)   聖霊による洗礼を授けられる(1:5)                                              pneu/mati
D(1:6)     弟子の疑問                     Question of disciples
C'(1:7-8)  なたがたの上に聖霊が降る(1:8)                                                pneu/matos
B'(1:9)    雲に覆われて彼らの目から見えなくなった(1:9)  1:9 … a cloud took him from their sight. (1:9)
A'(1:10-11) 天に行かれるのをあなたがたが見た(1:11)  1:11 This Jesus who has been taken up … (1:11)
           A:上る B:現れる・見えなくなる C:聖霊 D:弟子の疑問
           A: Being taken up. B: Appearance, hiding. C: The Holy Spirit. D: Question of disciples.
```

This is **exactly** the shape the product spec's `structural_data.key_chiastic_nodes[]`
asks for: an ordered set of labelled nodes, each with a verse span and a summary, plus a
centre (`D`) and a legend explaining what each level pairs.

Structure rows also carry parallel-passage links in a `<book_number>_<Book>@<pericope>`
form — e.g. Matthew 1:1-17 is linked to `42_Luke@13`, and Matthew 2:1-12 to `33_Micah@7`.

### Ingest-critical facts

1. **Column 3 (English) is contaminated with NAB/NRSV/NJB verse text and must be dropped.**
   The safe English text is the *summary* line at the end of each unit, which is Murai's
   own prose ("A: Being taken up. B: Appearance, hiding.").
2. **Column 2 is Japanese**, and is the primary summary. Column 3's non-quotation entries
   ("Question of disciples") are Murai's English glosses and are safe.
3. Greek catchwords (column 4) are in **Beta Code**, same as Dodson.
4. Node labels use ASCII apostrophe for the prime mark: `C'`, `A'`.
5. Unit boundaries are rows whose first cell matches `^\[\d+\]`.

## Editorial caveat, stated plainly

This is **one scholar's structural analysis**, not a consensus apparatus. Chiastic
structure is interpretive by nature, and a reader-facing badge must attribute it as
Murai's reading rather than presenting it as an established fact about the text. That is a
presentation decision, not a data-availability problem — and the data availability
question, which `ROADMAP.md` §4 answers "❌ No dataset", is now answered **yes**.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `LiteraryStructureoftheBible_PericopeList_NT.xlsx` | 56,021 | `de8ff7bf656efe9bbb23e3d7903e46b01495970d6c166c94f66d692fa3d6276e` |
| `LiteraryStructureoftheBible_PericopeList_OT.xlsx` | 78,469 | `0e7ef46da8d25fab61622e540f914fce07338b59db77795eeef8549809a9ff7b` |
| `LiteraryStructureoftheBible_PericopeStructure_NT.xlsx` | 619,637 | `ea0659a0d316684786d2470583a80965f0f9483d8b0d25ff5843e3bf84de446b` |
| `LiteraryStructureoftheBible_PericopeStructure_OT.xlsx` | 799,900 | `5313bc88194f7e5610f320e01a8753bfad0cd438f34a286cc59fc302cc421a62` |

**Total:** 4 files, 1,554,027 bytes.
