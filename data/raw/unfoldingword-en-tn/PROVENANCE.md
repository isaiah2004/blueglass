# PROVENANCE — unfoldingWord Translation Notes (en_tn)

**Badge:** Cultural (candidate) · **Verdict:** **NEEDS-DECISION** — share-alike *and* the
content is not what the badge needs without rework

| | |
|---|---|
| Source repo | https://git.door43.org/unfoldingWord/en_tn |
| Files retrieved from | `https://git.door43.org/unfoldingWord/en_tn/raw/branch/master/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `master` |
| Upstream last update | 2026-08-28T11:09:11Z (actively maintained; updated the day of retrieval) |
| Licence | **CC BY-SA 4.0** + an unfoldingWord trademark condition |
| Transformations | **None.** 4 of 66 book files retrieved as an evaluation sample. |

## Licence, verified

`LICENSE.md` was fetched from the repository and is stored verbatim beside the data
(1,308 bytes). Its operative words:

> *unfoldingWord® Translation Notes*
>
> *Copyright © 2026 by unfoldingWord*
>
> This work is made available under the Creative Commons Attribution-ShareAlike 4.0
> International License. …
>
> unfoldingWord® is a registered trademark of unfoldingWord. Use of the unfoldingWord name
> or logo requires the written permission of unfoldingWord. Under the terms of the CC BY-SA
> license, you may copy and redistribute this unmodified work as long as you keep the
> unfoldingWord® trademark intact. **If you modify a copy or translate this work, thereby
> creating a derivative work, you must remove the unfoldingWord® trademark.**
>
> On the derivative work, you must indicate what changes you have made and attribute the
> work as follows: "The original work by unfoldingWord is available from
> [unfoldingword.org/utn](https://www.unfoldingword.org/utn)". **You must also make your
> derivative work available under the same license (CC BY-SA).**

Two obligations, both explicit: **share-alike on derivatives**, and **trademark removal**
on derivatives. The identical text (with `/uhb` substituted for `/utn`) appears in the
UHB licence, so it governs the whole unfoldingWord family.

## What is actually in these files

Retrieved sample: 4 of 66 book files. The repository holds one TSV per book
(`tn_<BOOK>.tsv`), 73 entries at root including `LICENSE.md`, `README.md`,
`manifest.yaml`, `media.yaml`.

| File | Notes | Upstream bytes |
|---|---:|---:|
| `tn_ACT.tsv` | **3,516** | 1,249,796 |
| `tn_GEN.tsv` | **5,760** | 1,546,236 |
| `tn_LUK.tsv` | **4,434** | 1,426,046 |
| `tn_JHN.tsv` | **2,645** | 905,578 |

Header, verbatim:

```
Reference	ID	Tags	SupportReference	Quote	Occurrence	Note
```

Real rows, as retrieved (Acts 16:14, Lydia):

```
16:14	n952		rc://*/ta/man/translate/writing-participants	τις γυνὴ ὀνόματι Λυδία & ἤκουεν	1	Luke is using the phrase **a certain woman** to introduce **Lydia** as a new participant in the story. If your language has its own way of introducing new participants, you could use it here in your translation. Alternate translation: [there was a woman named Lydia … who was listening]
16:14	se6e		rc://*/ta/man/translate/translate-names	Λυδία	1	The word **Lydia** is the name of a woman.
16:14	qj86		rc://*/ta/man/translate/figs-metonymy	πορφυρόπωλις	1	Luke is using the color of **purple** cloth to mean the cloth itself by association. If it would be helpful in your language, you could state the meaning plainly. Alternate translation: [a seller of purple cloth]
```

`Reference` is `chapter:verse` — book comes from the filename. Verse-level join is trivial.

## The finding that matters: this is not a cultural-context dataset

The prior research (`bible-enrichment/PROPOSAL.md` §3f) calls en_tn the "**Best**
purpose-built culture/history/idiom notes", and `ROADMAP.md` §4 marks Cultural as
"✅ Sourceable … deterministic ingest". Reading the actual notes does not support that.

en_tn is a **translation-helps** resource. It is written *to a Bible translator working
into another language*, and most notes are grammatical mechanics, not cultural background.

`SupportReference` category distribution across the 3,516 Acts notes, counted from the
retrieved file:

| Category | Notes |
|---|---:|
| `figs-explicit` | 368 |
| `figs-activepassive` | 365 |
| `figs-metonymy` | 295 |
| `figs-metaphor` | 276 |
| `figs-idiom` | 254 |
| `writing-pronouns` | 202 |
| *(none)* | 163 |
| `translate-names` | 159 |
| `figs-abstractnouns` | 125 |
| `figs-synecdoche` | 96 |
| `figs-nominaladj` | 82 |
| `figs-hyperbole` | 73 |
| `figs-exclusive` | 61 |
| `figs-quotesinquotes` | 61 |
| `translate-unknown` | 60 |
| `translate-symaction` | 52 |

Counting the categories that carry actual cultural or realia information
(`translate-unknown`, `translate-names`, `translate-symaction`, `translate-b*` measures,
`figs-explicit`): **656 of 3,516 notes = 18.7%.** Being generous and also counting
`figs-idiom`: **893 = 25.4%.**

The remaining ~75% is material like *"If your language has its own way of introducing new
participants, you could use it here in your translation"* — correct, useful to a
translator, and meaningless to a reader tapping a Cultural badge.

Two consequences for the plan:

1. A Cultural loader must **filter by `SupportReference` category**, cutting the usable
   yield to roughly a quarter of the row count the roadmap assumes.
2. Even the usable notes are **addressed to a translator and reference an "Alternate
   translation"**. Rendering them verbatim in a reader-facing badge would be wrong in
   voice. Making them reader-facing is a **rewrite**, i.e. generation with review — not
   deterministic ingest. This moves part of Cultural out of the "$0, deterministic" column
   of `ROADMAP.md` §5 stage 2 and into stage 3.

Also note: the `Tags` column is **empty in all 3,516 Acts rows** — it cannot be used for
filtering.

## Coverage

Whole canon, 66 books, actively maintained.

## Acquisition of the remainder

Full repository is ~133 MB. Not retrieved. See `docs/architecture/dataset-validation.md`.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `LICENSE.md` | 1,308 | `595cb69620589e3c240b49cad6fc38a53a65093b8330bbcc6280aca5a55cdc7e` |
| `tn_ACT.tsv` | 1,249,796 | `46396586fe959bbcd581bf2a5c1ce77783b5a8679da76824d1a611f6995f26c9` |
| `tn_GEN.tsv` | 1,546,236 | `f9d4e933e6a63bd966013b555824a79044723e940e54952e015d9d9da86001f1` |
| `tn_JHN.tsv` | 905,578 | `b8803157511c8e4080f3baffa6e13d7979bb3f97fea5129498aa8435fbea504f` |
| `tn_LUK.tsv` | 1,426,046 | `ce9e461ad1d44cede5316e1b1333900718419494117c64d319f1f134fd55997c` |

**Total:** 5 files, 5,128,964 bytes.
