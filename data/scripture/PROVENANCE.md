# PROVENANCE — Bible translations

**Decision:** `S-01` — multiple open translations with a switcher.
**Verdict:** USE all four. Every one is public domain; none carries a share-alike
obligation. **ESV appears in the product mockups, is licensed by Crossway, and is
deliberately absent.**

| | |
|---|---|
| Acquired | 2026-08-29 |
| Acquired by | `apps/api/scripts/acquire_sources.py` |
| Loaded by | `apps/api/scripts/load_scripture.py` → `verses`, `translations`, `data_sources` |
| Transformations | Two, both mechanical and both recorded below. Nothing else. |
| Total loaded | **124,372 verses** across 4 translations, measured in Postgres |

---

## 1. What was acquired

| Code | Translation | Upstream | Payload | Bytes | SHA-256 (uncompressed) |
|---|---|---|---|---:|---|
| `BSB` | Berean Standard Bible | `https://bereanbible.com/bsb.txt` | `bsb.txt` | 4,331,393 | `2ac3af1de52d4e68261cba91d85c320b7eadc6560e830d99e591767b8ff5ca96` |
| `KJV` | King James (Authorized) Version | `https://ebible.org/Scriptures/eng-kjv2006_vpl.zip` | `eng-kjv2006_vpl.txt` | 4,490,049 | `68c5f764bf1c204868c3eb72592035c0947f057b608c2149dbff765d8ddd86f6` |
| `WEB` | World English Bible | `https://ebible.org/Scriptures/engwebp_vpl.zip` | `engwebp_vpl.txt` | 4,327,889 | `71ea1ce60dac8780a16d908f6035fa3595ecc9459acf636de5d1c5023214f240` |
| `ASV` | American Standard Version (1901) | `https://ebible.org/Scriptures/eng-asv_vpl.zip` | `eng-asv_vpl.txt` | 4,450,459 | `8924ef74086d572425b1e335f531c7c529a561969e5c851e456b84c2ce6ad858` |

Payloads are stored gzipped under `sources/` (5.1 MB total). The hash above is of the
**decompressed** bytes and `load_scripture.py` verifies it before parsing — a swapped or
truncated cache cannot reach the parser, where it would most likely still produce
plausible-looking verses. `manifest.json` is the machine-readable form of this table.

**Why the files are committed.** `docs/architecture/data-inventory.md` §4 recorded the
prototype's worst data risk verbatim: nothing was bundled, both loaders fetched from
`raw.githubusercontent.com` at load time, and *"if that repo moves or the DB volume is
lost, there is no local copy to rebuild from"*. It is fixed here. `pnpm db:seed` works
with the network unplugged.

---

## 2. Licences, verified

Each statement below was read from the publisher's own page or from the copyright notice
shipped inside the download, on 2026-08-29.

### BSB — public domain

> The Berean Bible and Majority Bible texts are officially dedicated to the public domain
> as of April 30, 2023. All uses are freely permitted.
> — <https://berean.bible/terms.htm>

Attribution is *"appreciated but not required"*; the publisher's own suggested wording is
stored in `data_sources.attribution` and the reader shows it anyway.

This resolves assumption `Q-024`, which shipped without the BSB because its 2023
dedication was recorded as *"a licence judgement, not an engineering one"*. The judgement
is now made, on evidence.

### KJV — public domain, with a UK printing caveat

> Public Domain. Letters patent issued by King James with no expiration date means that to
> print this translation in the United Kingdom or import printed copies into the UK, you
> need permission. … This royal decree has no effect outside of the UK, where this work is
> firmly in the Public Domain.
> — `eng-kjv2006_about.htm`, shipped inside the download

The caveat concerns **printing** and importing printed copies into the UK. Serving text
from a server is not printing, so it does not bind this product — but it is recorded
rather than paraphrased away, because a future printed edition would need to know.

### WEB — public domain, trademarked name

> The World English Bible is in the Public Domain. … However, "World English Bible" is a
> Trademark of eBible.org. … All we ask is that if you CHANGE the actual text of the World
> English Bible in any way, you not call the result the World English Bible any more.
> — `engwebp_about.htm`, shipped inside the download

The trademark is on the **name**, not the text. The loader therefore applies **no**
transformation to the WEB (`cleanup=VERBATIM` in `translation_catalogue.py`), so the text
under the name is exactly the text eBible.org published.

### ASV — public domain

Published 1901; copyright long expired. eBible.org distributes it with no restrictions:
<https://ebible.org/Scriptures/details.php?id=eng-asv>.

---

## 3. Transformations applied

Two, both mechanical, neither adds, removes or reorders a word.

| Transformation | Applied to | Why |
|---|---|---|
| Remove `[` and `]` | KJV (14,241 verses), ASV (3,747) | eBible's plain-text rendering of the *italics* that mark words supplied by the translators. Rendered inline they read as stray markup. The words themselves are untouched. |
| Remove `¶` | KJV (2,970 verses) | The traditional KJV paragraph mark. Typography, not scripture — and left in place it would also land in the full-text index. |

Plus Unicode NFC normalisation and whitespace collapse on every translation, so the curly
apostrophes the WEB and BSB use compare and search identically however they were encoded.

**Known, deliberate loss:** removing `¶` discards the KJV's paragraph structure. The
`verses` table has nowhere to store it. If paragraph rendering is wanted later, re-acquire
with `strip_paragraph_marks=False` and add a column — the source bytes still carry it.

---

## 4. Verse counts — measured, never assumed

| Code | Printed verse numbers | Empty in the source | **Loaded** |
|---|---:|---:|---:|
| `BSB` | 31,102 | 16 | **31,086** |
| `KJV` | 31,102 | 0 | **31,102** |
| `WEB` | 31,103 | 5 | **31,098** |
| `ASV` | 31,102 | 16 | **31,086** |
| | | | **124,372** |

An empty verse is not a defect. The critical-text translations print
**Matt 17:21, 18:11, 23:14; Mark 7:16, 9:44, 9:46, 11:26, 15:28; Luke 17:36, 23:17;
John 5:4; Acts 8:37, 15:34, 24:7, 28:29; Rom 16:24** as empty on purpose — the ASV and BSB
omit all sixteen, the WEB omits five of them (Luke 17:36, Acts 8:37, 15:34, 24:7 and
Rom 16:25). They are dropped rather than stored blank so the reader never renders an empty
line, and the counts above are the counts **after** the drop, which is what makes the drop
auditable instead of silent.

The WEB also differs in versification: it prints the Romans doxology at **14:24-26** rather
than **16:25-27**, so it carries three verse numbers the KJV does not and lacks two the KJV
has. Verse keys are structural (`book × 1e6 + chapter × 1e3 + verse`), so this needs no
special handling — but a cross-translation feature that assumes every key exists in every
translation would be wrong, and Rom 16:25-27 is where it would break.

---

## 5. What was rejected, and why

**`scrollmapper/bible_databases` (MIT wrapper) — the prototype's source.** Its `KJVPCE`
dataset is **corrupt**: **Joshua 15:1, Job 7:1, Hosea 8:1 and Romans 8:1 are empty
strings**, in the JSON, the CSV, and every other format the repository publishes. Romans
8:1 is one of the best-known verses in the Bible. Measured on 2026-08-29 against the
current `master`. The repository has no `WEB.json` at all, which is why the prototype's
`load_more_translations.py` 404ed on every run.

Its `ASV` and `BSB` files are complete, but a source that silently drops four verses from
one translation is not a source to trust for the others.

**`AKJV`, `MKJV`** — non-commercial licences in the same repository. Excluded.
**`ESV`** — licensed by Crossway. In the mockups only. Never to be loaded.
**`NET`** — freely readable but not freely redistributable. Excluded.

---

## 6. Files

| File | Bytes |
|---|---:|
| `manifest.json` | 3,510 |
| `sources/bsb.txt.gz` | 1,325,429 |
| `sources/eng-asv_vpl.txt.gz` | 1,316,036 |
| `sources/eng-kjv2006_vpl.txt.gz` | 1,341,798 |
| `sources/engwebp_vpl.txt.gz` | 1,293,353 |

Gzipped with `mtime=0`, so re-acquiring an unchanged file produces no diff.

## 7. Re-acquiring

```bash
docker compose run --rm --no-deps \
  -v "$PWD/data/scripture:/acquire" -e ATLAS_SCRIPTURE_DATA_DIR=/acquire \
  api python -m scripts.acquire_sources --all
```

The `data/` mount on the `api` service is read-only on purpose, hence the second mount.
Acquisition re-measures every verse count with the real parser and **fails** if a publisher
has changed an edition — the manifest can never drift from the bytes beside it.
