# PROVENANCE — Dodson Greek Lexicon

**Badge:** Word Root (Greek glosses) · **Verdict:** USE

| | |
|---|---|
| Source repo | https://github.com/biblicalhumanities/Dodson-Greek-Lexicon |
| Files retrieved from | `https://raw.githubusercontent.com/biblicalhumanities/Dodson-Greek-Lexicon/master/…` |
| Retrieval date | 2026-08-28 |
| Default branch | `master` |
| Upstream last push | 2018-01-11T17:38:26Z |
| Licence | **CC0 1.0 Universal** (public domain dedication) |
| Transformations | **None.** |

## Licence, verified

Two independent statements, both fetched from the repository and stored here:

`LICENSE` (6,554 bytes) is the full **CC0 1.0 Universal** legal text, opening:

> CC0 1.0 Universal
>
> Statement of Purpose

`README.md` states in its own words:

> This lexicon, in all of its forms, is in the public domain.

GitHub repository metadata independently reports `"spdx_id": "CC0-1.0"`.

**This is stronger than the prior research recorded.** `bible-enrichment/PROPOSAL.md`
lists Dodson as "PD (explicit)"; it is in fact a formal CC0 dedication, which means **no
attribution obligation at all** and no share-alike exposure. Attribution remains a
courtesy we should still pay.

## What is actually in the file

| Metric | Value |
|---|---|
| `dodson.csv` data rows | **5,408** (5,409 lines including header) |
| Columns | 5 |
| Delimiter | **TAB** — despite the `.csv` extension |
| Quoting | Every field is double-quoted |

Header, verbatim:

```
"Strong's"	"Goodrick-Kohlenberger"	"Greek Word"	"English Definition (brief)"	"English Definition (longer)"
```

Real rows, as retrieved:

```
"0001"	"0001"	"a)/lfa"	"the first letter of the Greek alphabet"	"alpha; the first letter of the Greek alphabet."
"0002"	"0002"	"*)aarw/n, o("	"Aaron"	"Aaron, son of Amram and Jochebed, brother of Moses."
```

### Ingest-critical facts

1. **Greek is in Beta Code, not Unicode.** `a)/lfa` = ἄλφα. A Beta-Code → Unicode
   transcoder is required before display, or the Greek surface form must come from
   TAGNT instead and Dodson used for the gloss only.
2. Strong's numbers are **zero-padded to 4 digits without the `G` prefix** (`"0001"`).
   Join key must be normalised to `G1`/`G0001` consistently.
3. The brief/longer gloss pair is exactly the shape a tap-to-reveal badge wants.

## Coverage

Greek New Testament vocabulary. 5,408 entries against ~5,624 extended Strong's Greek
numbers — near-complete for NT usage.

## Files

| File | Bytes | SHA-256 |
|---|---:|---|
| `dodson.csv` | 539,071 | `46951bf82c40ed35caa8557db190a828b744e305e9619d9451ea5690a90d7101` |
| `LICENSE` | 6,554 | `5537d4d10b76b81b6e8dfd8b644480a4b1efa332fbb0cdb61126c5be781ef7b4` |
| `README.md` | 557 | `eada5184215fba69ddd420438e55690fb4ca0c14fdaa1f04a3f6c555b045e839` |

**Total:** 3 files, 546,182 bytes.
