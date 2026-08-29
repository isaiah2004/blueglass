# PROVENANCE — Tyndale House / STEPBible-Data

**Badges:** Word Root (Greek), **Manuscript**, Lineage (secondary), versification mapping
**Verdict:** USE for TAGNT / TBESG / TVTMS · **NEEDS-DECISION** for TIPNR redistribution

| | |
|---|---|
| Source repo | https://github.com/STEPBible/STEPBible-Data |
| Files retrieved from | `https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `master` |
| Upstream last push | 2026-08-21T20:14:30Z (actively maintained) |
| Licence | **CC BY 4.0**, declared in every file header and in `README.md` |
| Transformations | **Filenames only.** Content bytes unmodified. Upstream names contain spaces and the source description; renamed as mapped below. |

## Filename mapping (the only transformation applied)

| Local file | Upstream path |
|---|---|
| `TAGNT_Mat-Jhn.txt` | `Translators Amalgamated OT+NT/TAGNT Mat-Jhn - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt` |
| `TAGNT_Act-Rev.txt` | `Translators Amalgamated OT+NT/TAGNT Act-Rev - Translators Amalgamated Greek NT - STEPBible.org CC-BY.txt` |
| `TBESG.txt` | `Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt` |
| `TVTMS.txt` | `Versification/TVTMS - Translators Versification Traditions with Methodology for Standardisation for Eng+Heb+Lat+Grk+Others - STEPBible.org CC BY.txt` |
| `TIPNR.txt` | `Proper Nouns/TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt` |
| `README.md` | `README.md` |

## Licence, verified — and a correction to the prior research

`README.md` (retrieved, stored here) opens:

> # STEPBible Data Repository  **CC BY 4.0**
> Data created initially by Tyndale House Cambridge now curated by www.STEPBible.org

and grants:

> * **Include any part of STEPBible-Data in any software or publications** without requesting permission
> * **Make changes to the data and record the differences**
> * **Refer others to this repository as the source of the data.**
>   Updates or corrections are easier to implement when the data is distributed from a single source.
>   **You are welcome to make a mirror, so long as it is kept up-to-date and has a link back here.**
>
> And you should:
> * **Credit it** to "STEP Bible" linked to www.STEPBible.org

**However**, every *data file header* carries a stricter-sounding line the README does not.
Verified present in **TAGNT, TAHOT, TBESG, TVTMS and TIPNR alike** — not only TIPNR:

> * Refer others to github.com/STEPBible as the source of the data. Please do not redistribute it yourself.
>   (Updates or corrections are easier to implement when the data is distributed from a single source)

These two statements are in tension: the README explicitly welcomes mirrors, the file
headers ask you not to redistribute. Both sit **on top of a CC BY 4.0 grant, which permits
redistribution as a matter of licence** — so the request reads as etiquette, not a licence
condition. The important correction: **this applies to the whole STEPBible family, not just
TIPNR** as `ROADMAP.md` §4 currently states.

**Attribution string the UI must render:** `STEP Bible — www.STEPBible.org (CC BY 4.0)`

## What is actually in these files

### TAGNT — Translators Amalgamated Greek New Testament

Whole Greek NT, word by word, split across two files only because of GitHub's file-size
limit. Real rows, as retrieved (Acts 16:14, the Lydia passage):

```
Act.16.14#01=NKO	Καί (Kai)	And	G2532=CONJ	καί=and	NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
Act.16.14#03=NKO	γυνὴ (gunē)	woman	G1135G=N-NSF	γυνή=woman	NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
Act.16.14#05=NKO	Λυδία, (Ludia)	Lydia,	G3070=N-NSF-P	Λυδία=Lydia	NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
Act.16.14#06=NKO	πορφυρόπωλις (porphuropōlis)	a seller of purple	G4211=N-NSF	πορφυρόπωλις=dealer in purple	NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
```

Per word this yields: OSIS ref + word index, Unicode Greek surface form, transliteration,
English gloss, **Strong's number**, morphology code, dictionary lemma, and the list of
critical editions attesting the word. The join key `Act.16.14#01` parses trivially into
`verse_key` + `word_index`. **Greek is Unicode here**, unlike Dodson.

### TAGNT also carries a manuscript-variant layer (Manuscript badge)

The code after `=` on the reference is a manuscript-family marker. The file's own legend,
retrieved verbatim:

> N / "Ancient" = Greek in Nesté-Aland, translated by most Bibles.
> K / "Traditional" = Greek of the KJV or "Textus Receptus" based on Scrivener 1894.
> O / "Others" = any different Greek in major editions or used by translations.
> Lower case "n" "k", "o" are differences that are too minor to entail a different translation.

and its own summary table:

| Code | Words | Significance (file's own words) |
|---|---:|---|
| `NKO` etc. | 133,608 | "identical in virtually all manuscripts" — 94% of total |
| `N(K)(O)` etc. | 3,084 | "different in Traditional manuscripts" — **470 of which alter the translation** |
| `K(O)` / `k(o)` | 4,164 | "found in Traditional but not Ancient manuscripts" — **2,347 alter the translation** |
| `N(O)` / `n(o)` | 896 | "found in Ancient but not Traditional manuscripts" — **274 alter the translation** |
| `O` / `o` | 284 | "in manuscripts different from Ancient and Traditional" — **111 alter the translation** |

≈ **3,202 translation-altering variant words across the NT.** Spot-checked against two
textbook cases; both encode correctly:

```
Acts 8:37  — every word tagged =K, edition column "TR" only   (the classic TR-only verse)
1 John 5:7 — words #01–#05 =NKO (all editions);
             words #06+  =K, "TR" only                        (the Comma Johanneum)
```

Variant-code distribution within Acts, counted from the retrieved file: 17,737 `NKO`,
386 `N(k)O`, 282 `K`, 216 `k`, 94 `no`, 80 `NK(o)`, 68 `N(K)O`, 36 `NO`, 27 `NK(O)`,
14 `ko`, 11 `KO`, 9 `n`, 8 `o`, 5 `N(k)(o)`.

This is **edition-level attestation, not a full critical apparatus** — there are no
per-manuscript sigla (no P46, ℵ, B individually). It supports "this wording differs between
the manuscript traditions, and here is which editions carry it". It does not support
"witness X reads Y".

### TBESG — Greek lexicon

**11,035 entries** (lines beginning `G`). Real entries:

```
G0026	G0026 =	G0026	ἀγάπη	agapē	G:N-F	love	<b>ἀγάπη</b>, -ης, ἡ … <b>love, goodwill, esteem</b>. …
G3070	G3070 =	G3070	Λυδία	Ludia	N:N-F-P	Lydia	<b>Λυδία</b>, -ας, ἡ <b>Lydia, a woman of Thyatira</b>: <ref='Act.16.14, 40'>Act.16:14, 40</ref>.† (AS)
G4211	G4211 =	G4211	πορφυρόπωλις	porphuropōlis	G:N-F	dealer in purple	<b>πορφυρόπωλις</b>, -ιδος, ἡ <b>a seller of purple fabrics</b>: <ref='Act.16.14.'>Act.16:14.</ref>† (AS)
```

Extended Strong's key, Unicode Greek, transliteration, POS code, short gloss, and a long
definition carrying embedded `<ref=…>` verse links. Based on Abbott-Smith (marked `(AS)`),
itself public domain (1922). Note it disambiguates Lydia the person (G3070) from the region.

### TVTMS — versification mapping

**29,896 lines.** Maps verse references between traditions. Real rows, confirming the
Psalm-superscription offset the ingest must handle:

```
Psa.3:0	Psa.3:1
Psa.3:1	Psa.3:2
Psa.3:2	Psa.3:3
```

Required whenever Hebrew/Greek word data is attached to KJV-versified verses.

### TIPNR — proper names (Lineage / Route secondary)

Person- and place-level disambiguation with unique tags. Real record:

```
Lydia@Act.16.14-=G3070	Woman living at the time of the New Testament …
– Named	Lydia@Act.16.14-	G3070«G3070=Λυδία	Lydia	…	Act.16.14; Act.16.40
```

**Format warning:** TIPNR is not a plain TSV. Its own header states that records are
separated by `$` and sub-records are lines beginning with a space. Parsing effort is
materially higher than for the other files here.

## Coverage

TAGNT: whole Greek NT (27 books). TBESG: NT/LXX Greek vocabulary. TVTMS: all traditions,
whole canon. TIPNR: proper nouns across the canon, ESV-based with KJV/NIV differences noted.

**Not retrieved:** TAHOT (Hebrew OT, 67 MB across 4 files) and TFLSJ (31 MB). Acquisition
commands are recorded in `docs/architecture/dataset-validation.md`.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `README.md` | 14,495 | `261d5157c0ffeadeedad3f734db945a4c3642e3e4ce5fa28002985b6c52437b1` |
| `TAGNT_Act-Rev.txt` | 15,939,932 | `524e32375361e6d3fa2f7ef00b87605fdc4317a762f395651a05fdc31ad031b7` |
| `TAGNT_Mat-Jhn.txt` | 14,189,032 | `ab8eaaeb68e17a1dcfa34e1e9350358f22f03bc2a97244d848750ad81044bc8e` |
| `TBESG.txt` | 4,736,912 | `312f723d7b8ef263bbdfb0451c9b8057125804dfff390b6f8544cff2a84b57f4` |
| `TIPNR.txt` | 8,644,937 | `403c6c74b4e133d9814d73099921937e3a4140d2bdae7e990ac8cf25359f5f91` |
| `TVTMS.txt` | 5,790,928 | `63058e0f20201af4bdaa7d830da5be8f493455d947c5f147d84840b33db9ddf8` |

**Total:** 6 files, 49,316,236 bytes.
