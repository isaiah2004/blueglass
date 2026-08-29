# Atlas Bible — Dataset Validation

**Verified:** 2026-08-28 · **By:** dataset-acquisition engineer · **Method:** every row below
comes from a live fetch performed this run. Licence text is quoted from the repository's own
`LICENSE`/`README`/file header, never from `bible-enrichment/`. Record counts are from parsing
the retrieved bytes, not from upstream documentation.

**Scope.** The six badges believed to have open sources — Route, Word Root, Cross-Ref,
Lineage, Manuscript, Cultural — plus the History ruler table, plus a genuine search for the
four badges recorded as having no dataset at all.

---

## 0 · The four things worth knowing before reading further

1. **Manuscript is not a dataset-less badge.** STEPBible **TAGNT** (CC BY 4.0, acquired)
   tags every word of the Greek NT with the manuscript families attesting it and counts
   ~3,202 translation-altering variants. `ROADMAP.md` §4's "❌ No dataset" is wrong.
   Queued as **`Q-014`**.
2. **Chiasm/Structure is not a dataset-less badge either.** Hajime Murai's *Literary
   Structure of the Bible* (CC BY 4.0, acquired) covers the whole canon: 1,959 pericopes
   and 10,304 labelled chiastic nodes. It also answers **`Q-009`** (pericope boundaries)
   for free. Queued as **`Q-015`**.
3. **Cultural is weaker than the plan assumes.** unfoldingWord `en_tn` is a *translation-
   helps* corpus, not a cultural-context corpus. Only **18.7%** of its Acts notes carry
   cultural content, and those are written in the voice of instructions to a translator.
   Part of Cultural moves from deterministic ingest to generate-and-review.
4. **The share-alike trap is avoidable at near-zero cost.** Every CC BY-SA source in the
   plan has a verified permissive substitute. See §3.

---

## 1 · Verification table

Licence column = **verified from the source itself**. "Alive?" = HTTP status observed today.

### Route — place geocoding

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **OpenBible Bible-Geocoding-Data** `data/ancient.jsonl` + `modern.jsonl` | ✅ 200 | **CC BY 4.0** — `license.txt` fetched, opens `Attribution 4.0 International`; GitHub reports `CC-BY-4.0` | 11.0 MB + 3.1 MB | JSONL | 1,342 ancient places · 5,616 distinct verses | place name, verse OSIS, `verses[].sort` = `BBBCCCVVV`, modern `lonlat`, `precision{meters,type}`, candidate `score` | **USE** |
| OpenBible `geometry/*.geojson` | ✅ 200 | **ODbL** for the OSM-derived slice (share-alike) — per-file `geometry_credit` | ~90 MB | GeoJSON | polygons | geometry only | **REJECT for v1** — share-alike, and not needed for pins |
| **Theographic `Places.csv`** | ✅ 200 | **CC BY-SA 4.0** — `LICENSE` fetched, opens `Attribution-ShareAlike 4.0 International` | 0.95 MB | CSV | **1,274 rows** | `openBibleLat/Long`, `kjvName`, `featureType`, `verses` | **SECONDARY only** — derives from OpenBible (see column names), so not independent corroboration, and adds share-alike for nothing |
| Pleiades gazetteer | ✅ 200 (`pleiades-places-latest.csv.gz`, `Last-Modified: 2026-08-28`) | CC BY 3.0 (per downloads page; **not re-read in full this run**) | ~35 MB gz | CSV/JSON/GeoJSON | ~34k ancient places | no verse key | **DEFER** — name-reconciliation project, no verse join |
| STEPBible **TIPNR** | ✅ 200 | CC BY 4.0 + a redistribution request (§3) | 8.6 MB | pseudo-TSV | proper nouns, canon-wide | names, Strong's, verse refs — **no lat/lng** | **SECONDARY** — use for disambiguation, not coordinates |

**Verdict: Route is fully sourced.** One caveat the plan does not record — see §6.1.

### Word Root — lemma, Strong's, morphology

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **STEPBible TAGNT** (Greek NT) | ✅ 200 | **CC BY 4.0** — header: `Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)` | 30.1 MB (2 files) | TSV | whole Greek NT | OSIS+word index, **Unicode** Greek, translit, gloss, **Strong's**, morph, lemma, **manuscript attestation** | **USE — primary** |
| **STEPBible TAHOT** (Hebrew OT) | ✅ 200 | CC BY 4.0, same header | 67.0 MB (4 files) | TSV | whole Hebrew OT | same shape | **USE** — not acquired (§2) |
| unfoldingWord **UHB** | ✅ 200 (updated 2026-08-27) | **CC BY-SA 4.0** — `LICENSE.md`: *"You must also make your derivative work available under the same license (CC BY-SA)"* + trademark-removal clause | ~24 MB | USFM 3.0 | Hebrew OT | `\w …\|lemma= strong= x-morph=` | **REJECT in favour of TAHOT** — share-alike for no added capability |
| unfoldingWord **UGNT** | ✅ 200 (updated 2026-08-27) | **CC BY-SA 4.0** — identical licence text | ~21 MB | USFM 3.0 | Greek NT | same | **REJECT in favour of TAGNT** |
| **OpenScriptures HebrewLexicon** | ✅ 200 | **CC BY 4.0** — no `LICENSE` file; `readme.md`: *"These files are released under the Creative Commons Attribution 4.0 International license… credit the Open Scriptures Hebrew Bible Project"* | 7.4 MB | XML | Hebrew | **8,674** Strong's entries + **11,845** BDB entries; Unicode Hebrew, translit, POS, definition, usage | **USE** |
| **Dodson Greek Lexicon** | ✅ 200 | **CC0 1.0** — `LICENSE` is the full CC0 legal code; GitHub reports `CC0-1.0`; README: *"This lexicon, in all of its forms, is in the public domain."* | 0.54 MB | TSV (`.csv` ext) | Greek NT | **5,408** entries: Strong's, GK, Beta-Code Greek, brief + long gloss | **USE** |
| **STEPBible TBESG** | ✅ 200 | CC BY 4.0 | 4.7 MB | TSV | Greek NT/LXX | **11,035** entries, Unicode Greek, POS, gloss, embedded verse refs | **USE** |
| STEPBible **TBESH** (Hebrew) | ✅ 200 | CC BY 4.0 banner, but file header: *"Permission should be gained from Online Bible before these definitions are applied in any project."* | 3.1 MB | TSV | Hebrew | — | **REJECT** — third-party permission gate; HebrewLexicon covers it |
| **STEPBible TVTMS** (versification) | ✅ 200 | CC BY 4.0 | 5.5 MB | TSV | all traditions | **29,896** mapping lines | **USE — required** |
| openscriptures/morphhb | ✅ 200 | **CC BY 4.0** — `LICENSE.md`: *"Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb"*; WLC text PD | 81 MB repo | OSIS XML | Hebrew OT | lemma, morph, Strong's | **ALTERNATIVE** — this is UHB's permissive upstream |
| openscriptures/strongs (Greek JSON) | ✅ 200 | **NO LICENCE.** No `LICENSE` file in repo root; `package.json` has **no `license` field** — both re-confirmed today | 7.6 MB repo | JS/JSON/XML | Greek | Strong's | **REJECT** — unlicensed; Dodson (CC0) + TBESG (CC BY) cover it |
| MorphGNT / SBLGNT | ✅ 200 | README: *"The SBLGNT text itself is subject to the SBLGNT EULA and the morphological parsing and lemmatization is made available under a CC-BY-SA License."* No `LICENSE` file | — | text | Greek NT | no Strong's | **REJECT** — EULA on the text, share-alike on the parsing, no Strong's |
| Clear-Bible/macula-greek | ✅ 200 | **CC BY 4.0** — `LICENSE.md`: *"MACULA Greek Linguistic Datasets © 2022-2024 by Biblica, Inc is licensed under CC BY 4.0"* | 969 MB repo | XML/TSV (Git LFS) | Greek NT | syntax trees, semantic frames, word senses | **DEFER** — permissive and rich, but far beyond badge needs |

### Cross-Ref — already loaded

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **OpenBible cross-references** | ✅ 200, `Last-Modified: 2026-08-24` | **CC BY 4.0 — asserted in the data itself**: header row reads `From Verse⇥To Verse⇥Votes⇥#www.openbible.info CC-BY 2026-08-24` | 1.98 MB zip → 8.3 MB | TSV | 66 books | **344,799 rows** — matches `load_xrefs.py:143` exactly | **USE — done** |
| **OpenBible topic-scores** | ✅ 200, `Last-Modified: 2026-08-24` | CC BY 4.0, asserted in header row | 0.42 MB zip → 2.0 MB | TSV | canon | **71,264 rows / 6,712 topics** | **USE** |

### Lineage — people and relationships

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **Theographic `People.csv`** | ✅ 200 | **CC BY-SA 4.0** — `LICENSE` fetched and read | 1.6 MB | CSV | **3,069 people** | `father` 51.6%, `children` 31.4%, `siblings` 30.8%, `mother` 6.5%, `partners` 5.6%, `verses` 99.9%, `gender` 100% | **USE — but see two warnings** |
| STEPBible **TIPNR** | ✅ 200 | CC BY 4.0 + redistribution request | 8.6 MB | pseudo-TSV | canon proper nouns | per-individual disambiguation, Strong's, all references | **USE as the disambiguation cross-check** |

**Two verified data-quality warnings on `People.csv` that no existing doc records:**

- **Only 286 of 3,069 rows (9.3%) have `status = publish`. 2,783 are `wip`.** The author's
  own column marks the overwhelming majority as work in progress.
- **1,613 rows (52.5%) carry a non-empty `ambiguous` flag — and the flag misses cases.**
  Verified: `lydia_1837`, whose `dictText` correctly describes the Acts 16 seller of purple,
  has `verses = Gen.36.22,1Chr.1.39,Acts.16.14,Acts.16.40` — two OT Horite-genealogy verses
  wrongly attached to the central character of the Acts MVP scope. Its `ambiguous` flag is
  **empty**.

`occupations` is present as a column and **populated in 0 of 3,069 rows**.

### Manuscript — textual variants

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **STEPBible TAGNT** (variant layer) | ✅ 200 | CC BY 4.0 | 30.1 MB | TSV | **whole Greek NT** | per-word manuscript-family code (`N`/`K`/`O`) + attesting editions (`NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz`) | **USE — this is the finding of the run** |
| SBLGNT apparatus | — | EULA-encumbered (above) | — | — | — | — | **REJECT** (unchanged) |
| openscriptures/morphhb | ✅ 200 | CC BY 4.0 | 81 MB | OSIS XML | Hebrew OT | WLC base text; Ketiv/Qere only | **PARTIAL** — no Hebrew variant apparatus found |

TAGNT's own legend, quoted verbatim:

> N / "Ancient" = Greek in Nesté-Aland, translated by most Bibles.
> K / "Traditional" = Greek of the KJV or "Textus Receptus" based on Scrivener 1894.
> O / "Others" = any different Greek in major editions or used by translations.

and its own counts: **4,164** words in Traditional-but-not-Ancient manuscripts (2,347 alter
the translation), **896** Ancient-but-not-Traditional (274 alter), **3,084** differing in
Traditional (470 alter), **284** in Other manuscripts (111 alter) — **≈3,202
translation-altering variant words across the NT.**

Spot-checked against two textbook cases, both encoded correctly:

```
Acts 8:37  — every word tagged =K, edition column "TR" only   (the classic TR-only verse)
1 John 5:7 — words #01–#05 =NKO (all editions);
             words #06+  =K, "TR" only                        (the Comma Johanneum)
```

**Honest limit:** this is **edition-level attestation, not a critical apparatus.** There are
no per-manuscript sigla — no P46, ℵ, or B individually. It supports *"this wording differs
between the manuscript traditions, and here is which printed editions carry it."* It does
**not** support the prototype's three hand-written witness cards. Hence `Q-014` recommends
TAGNT canon-wide **plus** hand-curated sigla for a famous handful.

### Cultural — customs, notes, dictionaries

| Source | URL alive? | Licence (verified) | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **HelloAO — 6 PD commentaries** | ✅ 200 | **Public Domain Mark 1.0** — served per record as `licenseUrl` in `available_commentaries.json` | live API | JSON | Henry 4,124 verses; Gill, JFB, Clarke, Calvin, Keil-Delitzsch vary | book intro + chapter/verse commentary; each carries an upstream `sha256` | **USE — best licence signal of any source** |
| HelloAO — **Tyndale OSN** | ✅ 200 | **CC BY-SA 4.0** — `licenseUrl: https://creativecommons.org/licenses/by-sa/4.0/` | live API | JSON | 69 books | same | **KEEP SEPARABLE** or drop (§3) |
| **NEUU Bible Dictionary** (Easton + Smith) | ✅ 200 | **CC BY 4.0** — `LICENSE`: *"Creative Commons Attribution 4.0 International (CC BY 4.0) … Source dictionaries are public domain"* | 11 MB | JSON | Easton **3,962** entries / **29,594** verse refs; Smith **4,561** entries | `name`, `slug`, `definitions`, `scripture_refs` | **USE** |
| unfoldingWord **en_tn** | ✅ 200 (updated 2026-08-28) | **CC BY-SA 4.0** + trademark-removal clause | 133 MB repo | TSV per book | whole canon; Acts = **3,516** notes | `Reference`, `ID`, `Tags`, `SupportReference`, `Quote`, `Occurrence`, `Note` | **NEEDS-DECISION** — share-alike *and* wrong content shape |
| unfoldingWord **en_tw** | ✅ 200 | CC BY-SA 4.0 | 30 MB | Markdown | ~1,000 terms | key terms | **REJECT** — share-alike, superseded by Easton/Smith |

**The `en_tn` finding.** `bible-enrichment/PROPOSAL.md` §3f calls en_tn the "**Best**
purpose-built culture/history/idiom notes". Reading the actual notes does not support that.
`SupportReference` distribution over the 3,516 Acts notes:

| Category | Notes | | Category | Notes |
|---|---:|---|---|---:|
| `figs-explicit` | 368 | | `figs-synecdoche` | 96 |
| `figs-activepassive` | 365 | | `figs-nominaladj` | 82 |
| `figs-metonymy` | 295 | | `figs-hyperbole` | 73 |
| `figs-metaphor` | 276 | | `figs-exclusive` | 61 |
| `figs-idiom` | 254 | | `figs-quotesinquotes` | 61 |
| `writing-pronouns` | 202 | | `translate-unknown` | 60 |
| *(none)* | 163 | | `translate-symaction` | 52 |
| `translate-names` | 159 | | `figs-rquestion` | 47 |
| `figs-abstractnouns` | 125 | | `figs-ellipsis` | 45 |

Culturally-informative categories total **656 / 3,516 = 18.7%** (25.4% if `figs-idiom` is
counted generously). The rest is translation mechanics. And even the usable notes read like
this real row:

> Luke is using the phrase **a certain woman** to introduce **Lydia** as a new participant
> in the story. If your language has its own way of introducing new participants, you could
> use it here in your translation. Alternate translation: [there was a woman named Lydia …]

Correct, useful to a translator, meaningless to a reader tapping a Cultural badge.
The `Tags` column is **empty in all 3,516 Acts rows**, so it cannot be used for filtering.

### History — ruler table

| Source | URL alive? | Licence | Size | Format | Coverage | Fields present | Verdict |
|---|---|---|---|---|---|---|---|
| **Wikidata SPARQL** (`P39` = `wd:Q842606`) | ✅ 200 | **CC0 1.0** — Wikidata's site-wide policy (*not separately fetched this run*) | 52 KB / 12 KB | SPARQL JSON | 108 emperors total; **15 dated, spanning the whole NT era** | ruler label, `P580` start, `P582` end, day precision | **USE** |

Augustus → Antoninus Pius, all 15 with day-precision reign dates. **This is one query, not
a hand table** — a direct correction to `ROADMAP.md` §4 (see §6.4).

**Not verified:** Herodian rulers and Judaean prefects/procurators (Pilate, Felix, Festus,
Gallio). An attempted query using guessed Q-ids returned unrelated entities, proving only
that the ids were wrong. Wikidata very likely holds them; **coverage is unconfirmed** and
must not be planned on until someone runs an entity-resolved query.

---

## 2 · Acquired — what is now in `data/raw/`

**92 MB across 12 sources.** Every directory carries a `PROVENANCE.md` recording source URL,
retrieval date, exact licence text, upstream version/ETag/push-date, per-file SHA-256,
record counts, and any transformation applied.

| Directory | Licence | Size | Records verified |
|---|---|---:|---|
| `openbible-geocoding/` | CC BY 4.0 | 15 MB | 1,342 ancient places · 1,596 modern · 5,616 verses · 1,335 resolvable · **777 multi-candidate** |
| `stepbible/` | CC BY 4.0 | 48 MB | TAGNT whole NT · TBESG 11,035 · TVTMS 29,896 lines · TIPNR |
| `neuu-bible-dictionary/` | CC BY 4.0 | 11 MB | Easton 3,962 entries / 29,594 refs · Smith 4,561 |
| `openscriptures-hebrew-lexicon/` | CC BY 4.0 | 7.4 MB | Strong's 8,674 · BDB 11,845 |
| `unfoldingword-en-tn/` | **CC BY-SA 4.0** | 5.0 MB | Acts 3,516 · Gen 5,760 · Luke 4,434 · John 2,645 (4-book sample) |
| `theographic-bible-metadata/` | **CC BY-SA 4.0** | 2.8 MB | People 3,069 · Places 1,274 · Events 450 |
| `openbible-cross-references/` | CC BY 4.0 | 1.9 MB | **344,799** |
| `murai-literary-structure/` | CC BY 4.0 | 1.6 MB | **1,959 pericopes · 10,304 chiastic nodes** |
| `dodson-greek-lexicon/` | **CC0 1.0** | 541 KB | 5,408 |
| `openbible-topics/` | CC BY 4.0 | 420 KB | 71,264 rows / 6,712 topics |
| `helloao-commentaries/` | PD Mark ×6, CC BY-SA ×1 | 168 KB | catalogue + 2 chapter samples |
| `wikidata-rulers/` | CC0 1.0 | 72 KB | 108 emperors / 15 NT-era dated |

**Payloads are gitignored, `PROVENANCE.md` files are not.** `data/.gitignore` is scoped to
this directory so the shared root `.gitignore` is untouched. Verified with `git add -An
data/`: exactly 13 paths would be staged — the 12 provenance files plus the ignore file,
and **zero payload bytes**.

### Not acquired — recorded with acquisition commands instead

| Source | Size | Why not | Command |
|---|---:|---|---|
| STEPBible **TAHOT** (Hebrew OT) | 67 MB | Not needed for the Acts MVP; acquire when OT ships | see below |
| STEPBible TFLSJ | 31 MB | Full LSJ, far beyond badge needs | — |
| unfoldingWord `en_tn` (remaining 62 books) | ~128 MB | Share-alike, pending `Q-007`; 4-book sample sufficed to evaluate | `git clone --depth 1 https://git.door43.org/unfoldingWord/en_tn` |
| OpenBible `geometry/*.geojson` | ~90 MB | ODbL share-alike; not needed for pins | — |
| Clear-Bible/macula-greek | 969 MB | Git LFS; beyond badge needs | `git clone --depth 1 https://github.com/Clear-Bible/macula-greek` |
| openscriptures/morphhb | 81 MB | Permissive UHB alternative, held in reserve | `git clone --depth 1 https://github.com/openscriptures/morphhb` |
| HelloAO commentary corpus | ~8,300 requests | Live API, no bulk dump | crawl `GET /api/c/{id}/{BOOK}/{ch}.json`, cache on the catalogue's `sha256` |

```bash
# STEPBible TAHOT — Hebrew OT word layer, CC BY 4.0, 67 MB
B=https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/Translators%20Amalgamated%20OT%2BNT
for R in Gen-Deu Jos-Est Job-Sng Isa-Mal; do
  curl -sSL -o "data/raw/stepbible/TAHOT_$R.txt" \
    "$B/TAHOT%20$R%20-%20Translators%20Amalgamated%20Hebrew%20OT%20-%20STEPBible.org%20CC%20BY.txt"
done
```

---

## 3 · The licence trap (`Q-007`), analysed

**I am not a lawyer and this is not legal advice.** What follows is a precise statement of
what the licence files say, what the product design does, and where those two meet.

### 3.1 Which sources are actually share-alike

Verified by reading each licence this run:

| Source | Licence | Where verified |
|---|---|---|
| unfoldingWord **UHB** | CC BY-SA 4.0 | `LICENSE.md` fetched |
| unfoldingWord **UGNT** | CC BY-SA 4.0 | `LICENSE.md` fetched |
| unfoldingWord **en_tn** | CC BY-SA 4.0 | `LICENSE.md` fetched |
| unfoldingWord **en_tw** | CC BY-SA 4.0 | project page |
| **Theographic** (People/Places/Events) | CC BY-SA 4.0 | `LICENSE` fetched, GitHub `CC-BY-SA-4.0` |
| HelloAO **Tyndale OSN** | CC BY-SA 4.0 | `licenseUrl` in the API catalogue |
| MorphGNT parsing layer | CC BY-SA 3.0 | README |
| OpenBible **OSM geometry slice** | ODbL (share-alike) | per-file `geometry_credit` |

Everything else in the recommended stack is **CC BY 4.0, CC0, or Public Domain Mark** — no
copyleft.

### 3.2 What the obligation actually is

From the CC BY-SA 4.0 legal code retrieved with the Theographic data, §3(b):

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

and §1(a):

> **Adapted Material** means material subject to Copyright and Similar Rights that is derived
> from or based upon the Licensed Material and in which the Licensed Material is translated,
> altered, arranged, transformed, or otherwise modified in a manner requiring permission
> under the Copyright and Similar Rights held by the Licensor.

The unfoldingWord licences say the same thing in plainer words, and add a second obligation:

> If you modify a copy or translate this work, thereby creating a derivative work, you must
> remove the unfoldingWord® trademark.
>
> On the derivative work, you must indicate what changes you have made and attribute the
> work as follows: "The original work by unfoldingWord is available from
> unfoldingword.org/utn". **You must also make your derivative work available under the same
> license (CC BY-SA).**

**Three things follow.**

1. **The trigger is *Sharing* Adapted Material, not producing it.** §3(b) opens *"if You
   Share Adapted Material You produce"*. A share-alike obligation on a derivative you never
   distribute does not bite. `DECISIONS.md` #1 — "pull on-demand to enrich reading,
   server-side only" — was written precisely to sit inside this. **But Atlas Bible's design
   has moved.** `ROADMAP.md` §5 stage 7 (`B-05`) ships **a bundled JSON seed to the device**
   for the Acts MVP. A bundled seed containing en_tn-derived or Theographic-derived content
   *is* Sharing Adapted Material, and it takes the whole seed with it.
2. **`passage_enrichment` is a blending machine.** `ROADMAP.md` §5 stage 5 builds one
   materialised record with `spatial_data`, `temporal_data`, `structural_data` and
   `badges text[]`. If Theographic `People.csv` supplies the lineage inside that object and
   OpenBible supplies the coordinates, the object is a derivative of both. Distributing it
   without CC BY-SA on the whole object is the trap `Q-007` names.
3. **Attribution is not the problem; relicensing is.** We would happily attribute
   (`DECISIONS.md` #4). The obligation that conflicts with a commercial future
   (`DECISIONS.md` #3) is having to license the *combined derived record* under CC BY-SA,
   which lets a competitor take the enrichment corpus.

### 3.3 The architectural options

| Option | What it means | Does it work? |
|---|---|---|
| **A. Never blend — table-scoped** (`DECISIONS.md` #2, current provisional) | Share-alike data lives in its own tables; the builder refuses to merge it. `ROADMAP.md` §5 already specifies the failing assertion. | **Works, and is already designed** — but it *deletes* those badges from the pre-computed record rather than solving them. Lineage becomes an on-demand server call that can never be bundled. |
| **B. Separately-attributed field** — one CC BY-SA sub-object inside the blended record | The whole enclosing JSON is still a single work distributed as a unit. A ShareAlike-licensed component inside a distributed compilation is exactly the "mere aggregation vs. derivative" line that copyleft disputes turn on. | **Do not rely on it.** It is the option most likely to be wrong, and being wrong means relicensing the corpus. |
| **C. Server-only, never bundled** | Honour `DECISIONS.md` #1 strictly: no seed file, no offline pack. | Works, but **contradicts `B-05`** and breaks the offline Acts MVP. |
| **D. Substitute permissive sources** | Replace every CC BY-SA input with a verified CC BY / CC0 / PD equivalent. | **Works, and costs almost nothing** — see the table below. |

### 3.4 Permissive alternative for every share-alike source

This is the finding that makes the decision easy. **Every one of them has a substitute.**

| Share-alike source | Used for | Permissive alternative | Licence | Gap in capability |
|---|---|---|---|---|
| unfoldingWord **UGNT** | Word Root (Greek) | **STEPBible TAGNT** | CC BY 4.0 | **None — TAGNT is strictly better.** Adds gloss, transliteration and the manuscript layer UGNT lacks |
| unfoldingWord **UHB** | Word Root (Hebrew) | **STEPBible TAHOT**, or **openscriptures/morphhb** (UHB's own upstream) | CC BY 4.0 | **None.** UHB's `LICENSE.md` itself states it is *"based on the Open Scriptures Hebrew Bible… made available under the Creative Commons Attribution 4.0 International License"* — we can take the CC BY parent instead of the CC BY-SA child |
| unfoldingWord **en_tn** | Cultural | **HelloAO's 6 PD commentaries** + **Easton/Smith** (CC BY 4.0) | PD Mark / CC BY | Some. en_tn is verse-level and canon-wide; commentaries are denser but uneven. **But §1 showed en_tn is only 18.7% cultural anyway**, so the real gap is far smaller than it looks |
| unfoldingWord **en_tw** | key terms | **Easton/Smith** (8,523 entries, 29,594 refs) | CC BY 4.0 | None material |
| HelloAO **Tyndale OSN** | Cultural | the other 6 in the same API | PD Mark | Modern prose voice is lost; content is covered |
| **Theographic `People.csv`** | **Lineage** | **STEPBible TIPNR** | CC BY 4.0 | **This is the one real gap.** TIPNR disambiguates individuals and lists every reference, but does **not** publish parent/child/sibling edges as a graph. Theographic is still the only open genealogy *graph*. |
| **Theographic `Places.csv`** | Route | **OpenBible geocoding** | CC BY 4.0 | None — Theographic derives from it |
| **Theographic `Events.csv`** | History dating | none found | — | See §4.2 — and it is Ussher-derived anyway (`Q-016`) |
| OpenBible **OSM geometry** | map polygons | **Natural Earth** (PD) | PD | Ancient site polygons lost; pins unaffected |
| MorphGNT parsing | Greek morph | **TAGNT** | CC BY 4.0 | None |

### 3.5 Recommendation

> **Adopt Option D — substitute permissive sources — and keep Option A's table-scoping as
> the enforcement mechanism for the one source that cannot be substituted.**

Concretely:

1. **Drop the whole unfoldingWord family from the ingest plan.** Use **STEPBible TAGNT +
   TAHOT** for Word Root and **HelloAO PD commentaries + Easton/Smith** for Cultural. This
   removes four of the eight share-alike sources at **zero capability cost** — TAGNT is
   strictly more capable than UGNT, and morphhb is UHB's own CC BY upstream. This also
   disposes of the trademark-removal clause entirely.
2. **Use OpenBible, not Theographic, for Route.** Removes a fifth, again at no cost, since
   Theographic's `openBibleLat`/`openBibleLong` columns show it is the same data.
3. **Drop Tyndale OSN**; keep the six PD commentaries. Sixth removed.
4. **Theographic `People.csv` is the only genuine share-alike dependency**, because no open
   permissive genealogy *graph* exists. Keep it **table-scoped and never blended into
   `passage_enrichment`**: serve Lineage from its own endpoint, exclude it from the bundled
   seed, and let `ROADMAP.md` §5 stage 5's builder assertion fail loudly if anyone tries.
   Cross-check its entries against TIPNR (CC BY) to fix the `wip`/ambiguity problems in §1.
5. **Keep the `data_sources.share_alike` column and the builder assertion regardless.** It
   costs nothing and it is what makes this enforceable with a `WHERE` clause instead of a
   code review.

**Net effect:** the pre-computed, bundle-able record contains **only CC BY / CC0 / PD**
content. Lineage is the single badge that stays server-only until someone either accepts
CC BY-SA for it or builds a genealogy graph from TIPNR. `Q-007` can be answered
"keep table-scoped" with the scope reduced from *five badges* to *one*.

**Residual item for a human, not a blocker.** Every STEPBible data file header says:

> * Refer others to github.com/STEPBible as the source of the data. Please do not
>   redistribute it yourself.

while the same repository's `README.md` says:

> You are welcome to make a mirror, so long as it is kept up-to-date and has a link back here.

Both sit on top of a CC BY 4.0 grant that permits redistribution as a matter of licence, so
this reads as etiquette rather than a condition. Since the recommendation above makes
STEPBible the backbone of the whole stack, it is worth a courtesy email to
`STEPBible@gmail.com` describing the project. **Important correction:** `ROADMAP.md` §4
attaches this caveat to TIPNR alone. Verified today, the identical line is in the
**TAGNT, TAHOT, TBESG, TVTMS and TIPNR** headers alike.

---

## 4 · Gaps — the four badges recorded as having no dataset

Two of the four turned out to have datasets. Two genuinely do not.

### 4.1 Chiasm / Structure — **GAP CLOSED**

**Searched:** GitHub (`chiasm`, `chiastic`, `literary structure` + dataset/JSON/CSV),
ACL Anthology and arXiv for computational chiasmus detection, and general web search.

**Found and verified:** **Literary Structure of the Bible**, Hajime Murai —
`http://bible.literarystructure.info/bible/bible_e.html`.

- **Licence, from the site's own words:** *"Literary Structure of the Bible by Hajime Murai
  is licensed under a Creative Commons Attribution 4.0 International License."*
- **Four `.xlsx` downloads, all retrieved** (1.6 MB total, now in
  `data/raw/murai-literary-structure/`).
- **Coverage, counted from the files:** 1,959 pericopes · 1,933 structured units ·
  **10,304 chiastic nodes**, one sheet per book, whole canon. **Acts: 49 pericopes,
  344 nodes.**
- **Shape** — a real retrieved record (Acts 1:1-11):

```
[1]         Ac1:1-11
A(1:1-2)    ... until the day he was taken up            a)nelh/mfqh
B(1:3)      ... appearing to them during forty days
C(1:4-5)    ... baptism with the Holy Spirit             pneu/mati
D(1:6)      Question of disciples
C'(1:7-8)   ... the Holy Spirit will come upon you       pneu/matos
B'(1:9)     ... a cloud took him from their sight
A'(1:10-11) ... This Jesus who has been taken up
            A: Being taken up. B: Appearance, hiding. C: The Holy Spirit. D: Question of disciples.
```

That is precisely `structural_data.key_chiastic_nodes[]` — ordered labelled nodes, verse
spans, a marked centre, and a legend for what each level pairs.

**Bonus: this also answers `Q-009`.** The Pericope List files give passage boundaries and
titles for the whole canon (`1:1-17 → "The genealogy of Jesus the messiah"`), which
`data-inventory.md` §6 records as having no verified open source.

**Two caveats, both real:**
- **Copyright carve-out.** The site adds: *"Caution: The copyright of the cited Bible verses
  belongs to each translator and publisher"* — the English column quotes NAB/NRSV/NJB.
  **That column must be dropped at ingest.** Murai's own labels, spans and summaries are
  the CC BY 4.0 part.
- **It is one scholar's analysis**, and chiasm is interpretive. This is a presentation
  decision (attribute it as Murai's reading), not a data-availability problem. Queued as
  **`Q-015`**.

*Also checked and rejected:* `Dironiil/ChiasmusDatasets` — general-literature chiasmus for
NLP training, **no licence file**, not Bible-keyed. Recent computational work (arXiv
2501.10739) reports 1,896 half-verse and 879 verse-level Hebrew chiasms but publishes no
usable licensed dataset.

### 4.2 History `year_approx` — **PARTIALLY CLOSED, with a serious caveat**

**Searched:** GitHub for biblical chronology/timeline datasets, Wikidata, and the
Theographic and MetaV knowledge graphs.

**Found and verified:** **Theographic `Events.csv`** (acquired) — **450 events, 100% dated,
137 in the AD era**, each with an explicit OSIS verse list. For Acts, every pericope-scale
event carries a year:

```
"The church grows"        0030   Acts.2.42–Acts.2.47
"Stephen is stoned"       0031   Acts.7.54–…
"Saul is converted"       0032   Acts.9.1–…
"Peter meets Cornelius"   0038   Acts.10.1–…
```

Combined with the Wikidata emperor table (§1), `temporal_data.year_approx` **and**
`roman_emperor` become a deterministic date-range join.

**The caveat that must not be lost.** The first row of `Events.csv` is
`"Creation of all things", startDate = -4003` — Ussher's 4004 BC. The independent MetaV
dataset states the same lineage explicitly in its own readme, quoted verbatim:

> YearNum - The approximate year of the event described or the time a prophecy was given.
> Negative numbers are BC, positive numners are A.D. **Source: Annals of the World, James
> Ussher** and R.A. Torrey, Treasury of Scripture Knowledge. Public Domain.

This is a **biblical-literalist chronology**. For NT-era passages it is broadly
uncontroversial and usable; for OT passages it encodes a theological position mainstream
scholarship rejects, and surfacing it as neutral fact would be a credibility problem.
Granularity is also coarse — all of Acts 2–7 is dated `0030`. Queued as **`Q-016`**;
recommendation is NT-era only, which leaves the Acts MVP fully covered.

*Also checked:* `theonize/KJV-bible-database-with-metadata-MetaV-` — word-level `YearNum`
across the whole KJV, which is finer-grained than Theographic. **Rejected:** no licence file
of any kind for the compilation (repo root is `.DS_Store`, `CSV/`, `readme.md`), last push
**2016**, and its readme miscites `openscriptures/strongs` as "CC BY-SA 3.0" when that repo
has no licence at all. *Also checked:* Theographic `Periods.csv` — **does not exist** (404).

### 4.3 3D City — **GENUINELY EMPTY. The roadmap's verdict stands.**

**Searched:** open-licence 3D/photogrammetry reconstructions of Ephesus, Corinth, Philippi
and Jerusalem; CyArk / Google Arts & Culture; Sketchfab; glTF cultural-heritage repositories;
academic virtual-reconstruction literature.

**Nothing usable exists.** The specific candidates and why each fails:

| Candidate | Why rejected |
|---|---|
| **FreeBibleimages — "Ephesus 3D reconstruction (Acts 19-20)"** — the closest match by content | Models by Ádám Németh / virtualreconstruction.com, licensed **CC BY-NC-ND 4.0**. **NonCommercial** fails `DECISIONS.md` #3; **NoDerivatives** forbids the re-rendering an app would require. Double disqualification |
| CyArk / Google Arts & Culture — Ancient Corinth | Viewer-only. No open bulk download of the source geometry; terms are not an open licence |
| Sketchfab "Ancient Corinth" | Third-party upload derived from CyArk data; provenance and rights unclear |
| Austrian Archaeological Institute — Byzantine Ephesus | Research visualisation, not a released dataset |

**Confirmed negative. Do not search again.** `ROADMAP.md` §4's route — cut the "3D" claim
for v1 and ship a stylised 2.5D site sheet — is correct. The one useful refinement: the
basemap layer is available and permissive (**Natural Earth**, public domain, no attribution
required), so the fallback is buildable; it is the *buildings* that do not exist openly.

### 4.4 Meditate — **GENUINELY EMPTY, as expected.**

**Searched:** open-licensed / public-domain lectio divina and reflection-prompt corpora keyed
to Bible passages; GitHub, Zenodo, OSF; Catholic and Protestant devotional publishers.

**Nothing.** Everything found is either narrative prose about *how* to practise lectio divina
(Soul Shepherding, InterVarsity, Busted Halo), or per-passage devotional content that is
**published under ordinary commercial copyright** (USCCB, Carmelite Media). No structured,
openly-licensed, passage-keyed prompt dataset exists.

**Confirmed negative.** This is a content-authoring problem exactly as `ROADMAP.md` §4 says.
The roadmap's reasoning is also sound on its own terms: a reflection prompt asserts no
historical fact, so the review bar is tone rather than truth, which makes it the *safest* of
the generated badges rather than the riskiest.

**Adjacent material that exists but is not a substitute:** the six PD commentaries already
acquired contain devotional-register prose (Matthew Henry especially) that could seed
generation with a PD grounding source rather than generating from nothing.

---

## 5 · Ready-to-ingest ranking

Ordered by badge coverage per unit of effort. Everything in tiers 1–3 is CC BY / CC0 / PD —
**no share-alike, no `Q-007` dependency, nothing blocking.**

| # | Source | Badges unblocked | Effort | Why here |
|---|---|---|---|---|
| **1** | **OpenBible geocoding** (acquired) | **Route** | **S** | 2 files, 1,342 places, verse key is a plain field. The 777 multi-candidate places satisfy `DECISIONS.md` #10 natively. Only trap is the two-file coordinate join (§6.1) |
| **2** | **HelloAO 6 PD commentaries** + **Easton/Smith** (acquired) | **Cultural** | **S–M** | Zero licence risk (PD Mark / CC BY 4.0 served per record). Easton alone is 3,962 entries / 29,594 verse refs, ready to load. Only the HelloAO crawl costs time |
| **3** | **Murai literary structure** (acquired) | **Structure** + `passage_id` (`Q-009`) | **S** | 1.6 MB of xlsx, already downloaded. Unblocks a badge the plan wrote off *and* the pericope table the whole passage schema depends on. Highest surprise-per-hour in this list |
| **4** | **STEPBible TAGNT + TBESG + TVTMS** (acquired) | **Word Root (NT)** + **Manuscript** | **M** | One parser yields two badges. TVTMS matters much less for the Greek NT than for Hebrew, so NT-first is genuinely cheaper. Largest row count in the plan |
| **5** | **Wikidata emperors** (acquired) + **Theographic `Events.csv`** | **History** | **S** | Emperors are one SPARQL query. Blocked only on the `Q-016` chronology call — and NT-only, which is the recommendation, needs no new work |
| **6** | STEPBible **TAHOT** (not acquired, 67 MB) | Word Root (OT) | **M** | Same parser as TAGNT, but TVTMS versification mapping becomes mandatory here. Defer past the Acts MVP |
| **7** | **Theographic `People.csv`** (acquired) | **Lineage** | **M** | Last because it is the only irreducible share-alike dependency **and** the lowest-quality file reviewed: 90.7% `wip`, 52.5% flagged ambiguous, with verified homonym conflation inside the MVP scope. Needs `Q-007` *and* a TIPNR cross-check |

**Cross-Ref is already shipping** — 344,799 rows, re-verified today, count unchanged.

**Recommended first sprint: items 1, 2 and 3.** All acquired, all permissive, no open
question blocks any of them, and together they take the badge count from **1 shipping to 4**
without touching the licence question at all.

**Highest-leverage single item: #3.** It is the smallest download in the set and it closes
two gaps the plan currently budgets **L** effort for.

---

## 6 · Discrepancies with the research doc

Specific, with evidence. `bible-enrichment/` is referenced as **[R]**, `data-inventory.md`
as **[DI]**, `ROADMAP.md` as **[RM]**.

### Things that were wrong or have changed

| # | Claim | Reality (verified today) |
|---|---|---|
| **6.1** | **[R]§3e, [DI]§6:** OpenBible geocoding gives "place↔verse↔coords" / "1,341 places … lat-lng" | **`ancient.jsonl` contains no coordinates at all.** `lonlat` exists only in `modern.jsonl`; the loader must join `ancient.extra.associations[].modern_id` → `modern.id`. Also: **1,342** places not 1,341; `extra` is a **JSON-encoded string** needing a second parse; `lonlat` is a `"lon,lat"` **string**, longitude-first. **Upside missed by both docs:** `verses[].sort` is already `BBBCCCVVV` (Acts 16:12 → `"44016012"`), so no book-map lookup is needed |
| **6.2** | **[RM]§4, [DI]§6:** Manuscript — "❌ **No dataset.** No open variant apparatus verified" | **False.** STEPBible TAGNT (CC BY 4.0) carries a canon-wide NT variant layer — ~3,202 translation-altering variants, verified correct on Acts 8:37 and the Comma Johanneum. It is edition-level, not per-manuscript sigla — but "no dataset" is wrong. **`Q-014`** |
| **6.3** | **[RM]§4, [DI]§6:** Structure — "❌ **No dataset.** Zero occurrences of 'chiasm' anywhere" · and **`Q-009`** "No verified open pericope dataset" | **Both false.** Murai's CC BY 4.0 corpus: 1,959 pericopes, 10,304 chiastic nodes, whole canon. The "zero occurrences in the old repo" observation was correct but was read as evidence about the *world* rather than about the repo. **`Q-015`** |
| **6.4** | **[RM]§4, [DI]§6:** `roman_emperor` is "a ~200-row **hand table** (Wikidata-derivable)" | Not a hand table. **One SPARQL query returns 15 emperors with day-precision reign dates** covering the entire NT era. Effort is an afternoon, not days. (Herodian rulers and Judaean prefects remain **unverified** — my probe used wrong Q-ids) |
| **6.5** | **[RM]§4, [DI]§6:** `year_approx` — "**No dataset** provides this joined to verses", **L** effort | Theographic `Events.csv` provides exactly that: 450 events, all dated, verse-linked. **But it is Ussher chronology** — a caveat neither doc anticipated, and more important than the availability. **`Q-016`** |
| **6.6** | **[R]§3f, [DI]§6:** en_tn is the "**Best** purpose-built culture/history/idiom notes" | **Overstated.** It is a translation-helps corpus: **18.7%** of Acts notes are culturally informative; the rest is grammatical mechanics, addressed to a translator ("Alternate translation: […]"). Cultural is not pure deterministic ingest |
| **6.7** | **[RM]§4:** the STEPBible "please don't re-host" request attaches to **TIPNR** | The identical line is in the **TAGNT, TAHOT, TBESG, TVTMS and TIPNR** headers alike. Meanwhile the repo `README.md` says the opposite — *"You are welcome to make a mirror"* — so the two STEPBible statements conflict, and both sit atop a CC BY 4.0 grant |
| **6.8** | **[R]§3e, [DI]§6:** Theographic `Places.csv` = **1,911 places** | **1,274 rows** today |
| **6.9** | **[R]§3f, [DI]§6:** neuu dictionary = **5,998 entries / 35,089 refs** | Repo has grown ~3.5×: now **five** dictionaries totalling **20,900** entries. Easton (3,962) + Smith (4,561) alone = 8,523. Easton's verse refs: **29,594**. There is **no `data/03_final`** directory |
| **6.10** | **[R]§3d:** OpenBible topics = **71,234 rows / 6,751 topics** | **71,264 rows / 6,712 topics** (regenerated 2026-08-24). Any loader asserting an exact count will fail |
| **6.11** | **[R]§3b:** Dodson is "PD (explicit)" | Better than recorded: the `LICENSE` file is the full **CC0 1.0** legal code, and GitHub reports `CC0-1.0`. A formal dedication, not just a README assertion |
| **6.12** | **[R]§7:** UHB/UGNT listed as the recommended Word Root primary | UHB's own `LICENSE.md` states it is **derived from openscriptures/morphhb, which is CC BY 4.0**. The share-alike is added by the child. Taking the CC BY parent — or TAHOT/TAGNT — sidesteps the licence entirely at no capability cost (§3.4) |

### Things nobody had recorded at all

| # | Finding |
|---|---|
| **6.13** | **Theographic `People.csv` is 90.7% unfinished by its author's own marking** — only **286 of 3,069** rows have `status = publish`; 2,783 are `wip`. Lineage is planned on this file |
| **6.14** | **1,613 of 3,069 (52.5%) People rows carry an `ambiguous` flag, and the flag misses real cases.** Verified: `lydia_1837` has `verses = Gen.36.22,1Chr.1.39,Acts.16.14,Acts.16.40` — OT Horite-genealogy verses attached to the central figure of the Acts MVP — with an **empty** `ambiguous` flag |
| **6.15** | `People.csv` has an `occupations` column **populated in 0 of 3,069 rows** |
| **6.16** | **The OpenBible geocoding repo has not been touched since 2021-11-01.** Not a defect for a static gazetteer, but no upstream corrections should be expected |
| **6.17** | **HelloAO serves a per-commentary `sha256`** in its catalogue — a free provenance and cache-invalidation handle for the 8,300-request crawl |
| **6.18** | **`bible.literarystructure.info` has a broken TLS certificate** (presents a `*.sakura.ne.jp` wildcard). Retrieval was over plain HTTP; integrity rests on the checksums in `PROVENANCE.md`, not on TLS |
| **6.19** | **777 of 1,342 OpenBible places have multiple candidate sites.** `DECISIONS.md` #10 ("surface scholarly uncertainty") is not a stretch goal — it is the majority case |
| **6.20** | **`en_tn`'s `Tags` column is empty in all 3,516 Acts rows.** Filtering must use `SupportReference` |

### Things the research got right, re-verified

Cross-references **344,799** exactly · OpenBible/Theographic/HelloAO/STEPBible/Dodson/
HebrewLexicon licences all as described · TBESH's Online Bible permission caveat is real and
verbatim · MorphGNT's SBLGNT EULA split is real and verbatim · `openscriptures/strongs`
genuinely has no licence of any kind · HelloAO's 6 PD + 1 CC BY-SA split is exact ·
Matthew Henry's 4,124-verse coverage is exact · TVTMS versification divergence is real
(Psalm superscriptions confirmed).

---

## 7 · What I could not verify

Stated explicitly rather than left as a silent gap.

- **Wikidata's CC0 licensing** was not fetched and quoted this run. It is site-wide policy,
  not a per-dataset file, but I did not read it today.
- **Herodian rulers and Judaean prefects/procurators** (Pilate, Felix, Festus, Gallio) —
  my query used guessed Q-ids and returned unrelated entities. Coverage is **unknown**.
- **Pleiades' CC BY 3.0 licence** — the dump URL responds `200` with a fresh
  `Last-Modified`, but I did not re-read the licence page in full. It is marked DEFER anyway.
- **STEPBible TAHOT and TFLSJ contents** — headers and licences verified by ranged fetch;
  the data bodies were not downloaded or parsed.
- **HelloAO commentary corpus at scale** — only the catalogue and two Acts 16 chapters were
  retrieved. Per-commentary verse coverage is taken from the API's own self-reported counts.
- **`en_tn` outside the 4-book sample** — the 18.7% cultural-content figure is measured on
  Acts (3,516 notes) only. It should be re-measured across the canon before anyone sizes the
  Cultural badge on it.
- **Murai's OT sheets** were counted but not read for content quality; only the NT and Acts
  structures were inspected in detail.
- **No LLM API calls were made and no money was spent.** All findings are from static file
  fetches, public REST endpoints, and one public SPARQL service.
