# Original-language ingest — the data behind the [Root] badge

Written by the original-language ingest engineer, 2026-08-29, from the files in
`data/raw/` and the database they were loaded into. Every number here was measured, not
recalled. Nothing in this milestone made an LLM call and nothing was spent.

Read `dataset-validation.md` first for the licence position. This document records what
the files turned out to contain when parsed, which is not always what a table of contents
suggests.

---

## 1 · What is loaded

| Table | Rows | Source | Licence |
|---|---:|---|---|
| `lexicon` | **19,714** | TBESG (11,035) · OSHB HebrewStrong (8,674) · 5 minted from TAGNT | CC BY 4.0 |
| ↳ definitions | 19,708 | Dodson where it has one (5,408 keys), else the headword's own lexicon | CC0 / CC BY 4.0 |
| `verse_words` | **142,096** | STEPBible TAGNT, both files | CC BY 4.0 |
| `verse_word_alignments` | **185,703** | computed here from TAGNT's English column | derived, CC BY 4.0 upstream |
| `lexicon_usage` | **5,417** | aggregated from `verse_words` per PUBLISHED Strong's number | — |

`lexicon` by language: **11,040 Greek** (11,035 + 5 minted), **8,021 Hebrew**,
**653 Aramaic**. `verse_words` covers **7,957 verses** — the whole Greek New Testament.

Command: `docker compose run --rm api python -m scripts.ingest_lexicon`.
It is idempotent: a second run measures identical counts and changes only `loaded_at`.

---

## 2 · Five things the files do that a reader of their documentation would not expect

### 2.1 TAGNT's English column is a Bible, not a gloss list

The field description in the file itself reads:

> English: Based on Berean Study Bible, with permission, as at 1-July-2019 and adapted
> for this work.

This is the single fact that makes the Root badge possible. TAGNT does not merely say
what each Greek word means; it carries a real English rendering already split across the
Greek words. Aligning it to a loaded translation is therefore a matching problem, not a
translation problem — and the highest-coverage translation is *not* BSB (see §3).

### 2.2 TAGNT is NRSV-versified; `verses` is KJV. The file says so inline

Verse references carry an optional bracketed alternative: `[chapter.verse]` is the KJV
reference, `(...)` is NA, `{...}` is other traditions. **235 words carry a `[...]`.**

Applying it lands TAGNT's verse set **exactly** on the 7,957 KJV New Testament verses —
no TAGNT verse without a KJV verse, no KJV verse without Greek. Ignoring it would file
those words one verse away from the reader who tapped them. TVTMS is therefore *not*
needed for the New Testament; the mapping is in TAGNT itself.

### 2.3 The KJV and NRSV verse boundaries interleave, so word numbering collides

Because the boundary can fall mid-sentence, **53 KJV verses take their Greek from two
NRSV verses** — `Mat.17.14` plus the head of `Mat.17.15[17.14]` — and both halves start
their own numbering at `#01`. The other half of the split is equally real:
`Mat.17.15#03` onwards is KJV 17:15, so that verse's words start at index 3.

`word_index` in `verse_words` is therefore **Atlas's own numbering**, 1..n in canonical
file order per KJV verse, not TAGNT's `#nn`. For the 7,904 verses that did not split the
two are identical.

### 2.4 TAGNT and TBESG disagree about five Strong's numbers

TAGNT tags words with **5,580 distinct disambiguated Strong's numbers**. TBESG keys
11,035 of them — but **five of TAGNT's are not among them**: `G0256`, `G2453`, `G3700G`,
`G3700H`, `G3708`, covering **317 words**. This is exactly the failure
`data-inventory.md` §7 predicted for the `lexicon` foreign key.

Resolution: mint those five lexemes from **TAGNT's own dictionary-form column**
(`ὁράω=to see`) and attribute them to TAGNT rather than TBESG. Transliteration and part
of speech are left null, because TAGNT gives the transliteration of the *inflected* word,
not of the headword. Falling back to the undisambiguated eStrong would have been worse
than null: TBESG's `G3700` headword is ὀπτάνομαι, while TAGNT says the word's lemma is
ὁράω.

### 2.5 TBESG's Greek uses the "oxia" codepoints, not the canonical ones

TBESG writes σέβομαι with **U+1F73** (GREEK SMALL LETTER EPSILON WITH OXIA). Everything
else — editors, other lexicons, a reader's keyboard — writes **U+03AD** (WITH TONOS). The
two render identically and compare unequal.

Caught by an integration test whose expected lemma was typed rather than copied, which is
precisely how it would otherwise have reached the product: as a search that finds nothing
and a flashcard that never matches its own lemma. All Greek and Hebrew is normalised to
**NFC** at ingest. This is canonical equivalence, not a change to the data.

Also worth knowing, and already recorded in the PROVENANCE files: **Dodson's Greek is
Beta Code** (`a)/lfa` = ἄλφα), so only its English definition is taken and the headword
comes from TBESG; and **Dodson is tab-separated despite its `.csv` name**, with every
field double-quoted.

---

## 3 · The English alignment — what it achieves, honestly

No acquired dataset says which *English* word a Greek word became. The Root badge is a
tap on a word, so that mapping had to be computed. It is deterministic: no model, no
spend.

### The rule

A pairing is emitted **only when it is unambiguous in both directions** — the English
token occurs exactly once in the verse, **and** exactly one Greek word's gloss contains
it. Function words are excluded outright; words the translator supplied, which TAGNT
marks `<the>` or `[the] city`, are stripped from the gloss before matching. A second,
lower-confidence pass repeats the same uniqueness test on lightly stemmed tokens, which
is what lets BSB's "worshiper" reach TAGNT's "worshiping" (σεβομένη, G4576) — the
mockup's own example.

Everything ambiguous is dropped. **A wrong alignment shows the reader a Greek word that
is not behind the word they tapped, which is worse than showing no badge at all.**

### Measured coverage

| Translation | Content words aligned | NT verses with ≥1 tappable word |
|---|---:|---:|
| WEB | 48,954 / 77,966 — **62.8%** | 7,911 / 7,950 — **99.5%** |
| ASV | 47,517 / 76,587 — **62.0%** | 7,895 / 7,941 — **99.4%** |
| BSB | 44,914 / 75,518 — **59.5%** | 7,877 / 7,941 — **99.2%** |
| KJV | 44,318 / 76,676 — **57.8%** | 7,883 / 7,957 — **99.1%** |

"Content words" excludes the stopword list, which is the honest denominator: nobody taps
"the" for a root. **BSB is not the best-aligned translation** despite TAGNT's English
being BSB-derived, because TAGNT's is "adapted for this work" rather than copied.

### Measured precision

100 alignments were sampled and inspected by hand — 50 during development and 50 from the
loaded database, split across both tiers and all four translations. **No pairing pointed
at the wrong lemma.** Two were judged borderline, both the same shape: where one Greek
word is rendered by an English phrase, a secondary word of that phrase points at the head
word's lemma. KJV's "seller of purple" is one Greek noun, πορφυρόπωλις, so both "seller"
and "purple" resolve to it — correct, if less informative for "purple" than for "seller".

This is a hand sample, not a gold standard. There is no licensed word-alignment corpus
for these translations to score against, so the number to trust is the one the rule
guarantees by construction: **an emitted pairing had exactly one candidate on each side.**

### What the reader can and cannot tap

- **Can:** roughly three content words in five, on 99% of New Testament verses.
- **Cannot:** any Old Testament word (§4), function words, and the ~40% of content words
  where two candidates existed.

`char_start`/`char_end` are stored per alignment so the client tints and taps the exact
substring of `verses.text` rather than re-tokenising it. A tokeniser drift on the client
would silently highlight the wrong word; an integration test slices every one of the
185,703 rows back out of the verse text and asserts it equals the stored token.

---

## 4 · The gap: no Old Testament

**TAHOT — STEPBible's Hebrew word layer — is not among the acquired files.**
`data/raw/stepbible/PROVENANCE.md` lists it under "Not retrieved" (67 MB, four files),
with the acquisition command recorded in `dataset-validation.md` §2.

Consequence: the Hebrew and Aramaic lexicon loads (8,674 headwords, with definitions and
transliterations) but **nothing points at it from a verse**, so the Root badge cannot
render on an Old Testament word. `verse_words` holds zero rows below verse key
40,000,000, and an integration test asserts that deliberately — if it ever starts
failing, TAHOT has landed and the badge's reach has roughly doubled.

Adding it later is the same parser plus one book-code table. TVTMS, unnecessary for the
New Testament (§2.2), becomes **mandatory** there: the Psalm superscription offset is
real and already confirmed.

---

## 5 · Schema, and why it differs from `data-inventory.md` §7

Three additions to the proposed word layer:

1. **`lexicon.definition_source_id` beside `source_id`.** A headword and its long
   definition routinely come from different sources. `AI-05` requires the sheet to name
   the source of every claim it renders, so the row carries both, and a `CHECK`
   (`definition IS NULL OR definition_source_id IS NOT NULL`) makes an unsourced
   definition impossible to store rather than merely discouraged.
2. **`verse_word_alignments`.** Computed, not sourced, so it is stored apart from the
   sourced rows and carries the `method` and `confidence` that produced it. Its own
   `data_sources` row names it as Atlas's derivation of TAGNT rather than borrowing
   STEPBible's attribution and implying they published it.
3. **`lexicon_usage`.** `AI-07` says badge content is pre-computed; the stat strip is
   three aggregates over 142k rows, computed in the same transaction that writes them so
   the counts can never describe a different corpus.

   It is keyed on **`simple_strongs`, the number the badge prints**, not on the
   disambiguated key the word rows carry — 5,417 rows, not 5,580. Keyed per sense it
   counted one sense of a number a reader can look up, and 26 Root badges said "This
   word occurs once in the whole of the Greek New Testament" of Ἰησοῦς (992), ποιέω
   (579) and πνεῦμα (386). Since the builder picks the rarest word in a verse, the
   artificially rare split was preferentially chosen. Summing the per-sense rows at
   read time would not have fixed it: `verse_count` and `book_count` would double-count
   every verse holding two senses, so the aggregate is grouped once, at write time.
   `scripts/lexicon/assertions.py` refuses the load if it is grouped any other way.

`data_sources` gained **`retrieved_at`** (added `IF NOT EXISTS`, since several agents
extend that table): the ingest brief requires source, licence *and* retrieval date to
live in the database, not only in a `PROVENANCE.md` that never ships.

`verse_words` also carries `variant_code` and `editions` — TAGNT's manuscript-attestation
layer. No M2 badge reads them; they are stored because they arrive in the same row and
re-parsing 30 MB later to recover them would be waste.

---

## 6 · Cross-agent note: the Alembic revision graph forked

At the time of writing, `apps/api/db/versions/` holds two chains from `0003`:

```
0003 ─┬─ 0004 ────────── 0005 ────────── 0006_lexicon   (this work)
      └─ 0004_history ── 0005_structure
```

`alembic upgrade head` fails with "Multiple head revisions", which stops
`docker compose up -d` from starting the API. Applying one branch by name works
(`alembic upgrade 0006_lexicon`, which is what this ingest was verified against), and the
fix is one merge revision — but any merge written while agents are still landing
migrations is stale on arrival, so it belongs to whoever closes M2 rather than to any one
feature. Queued for the product owner as the revision-numbering question in
`ASSUMPTIONS.md`.
