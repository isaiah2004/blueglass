# PROVENANCE — OpenScriptures Hebrew Lexicon (BDB + Strong's)

**Badge:** Word Root (Hebrew glosses) · **Verdict:** USE

| | |
|---|---|
| Source repo | https://github.com/openscriptures/HebrewLexicon |
| Files retrieved from | `https://raw.githubusercontent.com/openscriptures/HebrewLexicon/master/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `master` |
| Upstream last push | 2024-04-19T21:27:33Z |
| Licence | **CC BY 4.0** for the structure/linking; underlying BDB and Strong's text is public domain |
| Transformations | **None.** |

## Licence, verified

The repository has **no `LICENSE` file** (GitHub metadata reports `"license": null`), so the
licence was read from `readme.md`, retrieved and stored here. Its own words:

> These files are released under the
> [Creative Commons Attribution 4.0 International](http://creativecommons.org/licenses/by/4.0/)
> license. The actual text of Brown, Driver, Briggs and Strong's Hebrew
> dictionary remain in the public domain.  For attribution purposes,
> credit the Open Scriptures Hebrew Bible Project.

It also carries a scope note worth recording:

> TWOT numbers are included for reference purposes only.  We are in no way
> directly transcribing the Theological Wordbook of the Old Testament.

**Attribution string the UI must render:** `Open Scriptures Hebrew Bible Project, CC BY 4.0`

## What is actually in these files

Verified by counting elements in the retrieved XML.

| File | Records | What it is |
|---|---:|---|
| `HebrewStrong.xml` | **8,674** `<entry>` | Strong's Hebrew dictionary, corrected |
| `BrownDriverBriggs.xml` | **11,845** `<entry>` | BDB lexicon content |
| `LexicalIndex.xml` | — | Bridge between BDB ids, Strong's numbers and TWOT numbers |
| `AugIndex.xml` | — | Maps OSHB augmented Strong's numbers to lexical-index ids |

Real record, as retrieved (H430, *Elohim*):

```
<entry id="H430">
  <w pos="n-m" pron="el-o-heem'" xlit="ʼĕlôhîym" xml:lang="heb">אֱלֹהִים</w>
  <source>plural of <w src="H433">433</w>;</source>
  <meaning><def>gods</def> in the ordinary sense; but specifically used (in the plural
    thus, especially with the article) of the supreme <def>God</def>; occasionally applied
    by way of deference to <def>magistrates</def>; and sometimes as a superlative</meaning>
  <usage>angels, × exceeding, God (gods) (-dess, -ly), × (very) great, judges, × mighty.</usage>
</entry>
```

Per entry: Strong's id, Unicode Hebrew lemma, transliteration, pronunciation, part of
speech, etymology, definition, and KJV usage list — everything the Word Root badge needs
for Hebrew.

**Hebrew is Unicode here**, with proper pointing.

### Why this rather than STEPBible TBESH

TBESH is the STEPBible Hebrew equivalent and is nominally CC BY 4.0, but its own file
header carries a restriction that CC BY does not:

> The Brief lexicon is based on Abridged BDB by Online Bible, and edited to conform with
> the extended Strongs. This is provided for guidence only. **Permission should be gained
> from Online Bible before these definitions are applied in any project.**

That is a third-party permission requirement layered onto the file. HebrewLexicon has no
such encumbrance and covers the same need with more depth. **Use HebrewLexicon; reject
TBESH.** (The prior research reached the same conclusion; this run re-verified the header
text directly.)

## Coverage

Complete Hebrew Old Testament vocabulary.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `AugIndex.xml` | 213,975 | `e7217ca8ff8ff3f21f9cf1bbe87411adf55f6aa88bcf5ed9ddc886cc6b160c5d` |
| `BrownDriverBriggs.xml` | 2,911,253 | `2b52658a4323d91674cda4090ab8b3ebddfff640f4f18143c28300e80b2c38f8` |
| `HebrewStrong.xml` | 2,749,042 | `a628f4f89f8bdaf2483fd3faf1abc8653cc6717758dfc9f24beb7571d9bdd0c4` |
| `LexicalIndex.xml` | 1,782,592 | `8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f` |
| `readme.md` | 2,503 | `9a129c25674387c494571c3828aa3a8eb78459c165e275c313ae26994ce8ff22` |

**Total:** 5 files, 7,659,365 bytes.
