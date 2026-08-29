# Atlas Bible — Data Inventory & Gap Analysis

**Surveyed:** `A:\Work\spark\spark-app` (read-only) · 2026-08-28
**Source repo state:** single commit `5bf6064 initial commit`, last file activity 2026-08-20.
**Method:** static read of every server/loader/schema file, read-only copy of the Chroma SQLite store, and a structural read of the Flutter client. The Postgres container was **not running**, so no live row counts (see §3).

---

## 1. Executive summary

- **A solid deterministic reading substrate exists, and it is genuinely good.** A FastAPI + asyncpg + Postgres/pgvector backend with a 20-table schema, a 66-book canon map, dual verse keys (integer `BBBCCCVVV` + OSIS string), idempotent loaders for the KJV text and 344,799 OpenBible cross-references, and 10 working HTTP endpoints. The verse-key scheme is exactly right for Atlas Bible and should be kept verbatim.
- **`bible-enrichment/` contains no enrichment data.** It is 7 files (~147 KB) of *research*: a proposal, a feasibility analysis, a decision log, and a raw findings dump cataloguing 52 datasets across 6 domains, 43 of them hands-on verified with live URLs and license text. It is a high-quality sourcing map, not a corpus. **Zero enrichment records exist.**
- **The only real enrichment content that exists anywhere is 1,029 LLM-generated study chunks** for Matthew 1–10 and Proverbs 1–10, sitting in an embedded Chroma store (`server/.chroma/chroma.sqlite3`). The Postgres `chapter_studies` rows that produced them are unreachable, and the loader that generated them (`loaders/enrich.py`) **is missing from the repo** despite being cited in `server/app/routers/study.py:3`.
- **Biggest risk: four of the ten badges have no dataset behind them, and nobody has noticed yet.** Route, Word Root, Cross-Ref, Lineage, Manuscript and Cultural all map to verified open datasets. **Chiasm/Structure, History (`temporal_data`: `year_approx`, `roman_emperor`), 3D City, and Meditate do not exist as data** in any source catalogued or that I could identify. They are LLM-generation or hand-authoring work, not ingestion work. The `spatial_data` block also needs a per-passage `camera_center`/`zoom_level` that no gazetteer provides — it must be computed from the place bounding box.
- **Recommended next step:** keep the verse-key scheme and the six deterministic loaders, and build a **verse-keyed store plus a pericope table** rather than the spec's literal passage-keyed store (see §7 and open question Q-009). Then run the Phase-2 deterministic ingest the proposal already specifies — it is ~1–2 weeks of parser work, $0 in model spend, and it lights up 6 of 10 badges. Treat the other 4 badges as a separate content problem.

---

## 2. API surface (existing FastAPI)

Base: `server/app/main.py`. Routers mounted at `main.py:38-44`. CORS is wide open (`allow_origins` defaults to `*`, `config.py:26`) with `allow_credentials=False` (`main.py:33`).

| Method | Path | Purpose | Request schema | Response schema | Streaming? | Atlas Bible |
|---|---|---|---|---|---|---|
| GET | `/health` | Liveness + whether OpenRouter key is set | — | `{status, model, openrouter_configured}` | No | **Keep** — `main.py:47` |
| POST | `/chat/stream` | Grounded chat as SSE; flags `use_rag`, `web_search` | `ChatRequest` (`schemas.py:11`) | SSE `data: {"meta"\|"delta"\|"error"}`, terminated `data: [DONE]` | **Yes (SSE)** | **Rework** — `chat.py:122`. Persona (`chat.py:18`, "Nuhra") and `[[Ref]]` citation convention are reusable; RAG must move Chroma → pgvector |
| POST | `/rag/ingest` | Chunk + embed + upsert documents | `IngestRequest` (`schemas.py:28`) | `IngestResponse` | No | **Drop** — `rag.py:15`. Ingestion becomes an offline pipeline, not a public endpoint |
| POST | `/rag/search` | Semantic search over ingested chunks | `SearchRequest` (`schemas.py:40`) | `SearchResponse` (`schemas.py:52`) | No | **Rework** — `rag.py:21`. Keep the shape, swap the backend |
| GET | `/translations` | Translations that actually have verses loaded | — | `{translations:[{code,name}]}` | No | **Keep** — `read.py:10` |
| GET | `/read/{book}/{chapter}?translation=` | Whole chapter, ordered by verse. `book` accepts name / OSIS / alias | path + query | `{reference, translation, book_number, chapter, verses:[{verse,text,osis_id,verse_key}]}` | No | **Keep** — `read.py:29`. Add per-verse badge availability flags |
| GET | `/verses/{osis}/cross-references?min_votes=&limit=` | Vote-ranked cross-refs + human labels + target verse text | path + query | `{osis, from_key, cross_references:[{ref,osis,to_start_key,to_end_key,votes,text}]}` | No | **Keep** — `enrichment.py:29`. This *is* the Cross-Ref badge |
| GET | `/search/scripture?q=&book=&translation=&limit=` | Case-insensitive `ILIKE` substring over verse text | query | `{query,count,results:[…]}` | No | **Rework** — `search.py:10`. `ILIKE '%term%'` cannot use an index; move to `tsvector` + trigram |
| GET | `/study/{book}/{chapter}` | LLM chapter study content | path | `{book_number, chapter, model, content}` | No | **Rework** — `study.py:23`. Becomes the enrichment-record endpoint |
| PUT | `/study/{book}/{chapter}` | Upsert study content, and side-effect ingest into RAG | `StudyIn` (`study.py:17`) | `{ok, book_number, chapter, ingested_chunks}` | No | **Drop** — `study.py:48`. Unauthenticated write endpoint; must not ship |
| GET | `/study/available` | Which (book, chapter) pairs have study content | — | `{chapters:[{book_number,chapter}]}` | No | **Rework** — `study.py:105`. Becomes badge-coverage lookup |
| GET | `/me` | Stub user profile | — | `{id, display_name, auth:"stub"}` | No | **Rework** — `user.py:23`. Auth is hardcoded to `dev-user` (`user.py:15`) |
| GET/POST/DELETE | `/me/notes`, `/me/notes/{id}` | User notes CRUD | `NoteIn` (`user.py:37`) | note rows | No | **Keep** (add real auth) — `user.py:46,63,75` |
| GET/POST | `/me/highlights` | Highlight list + toggle | `HighlightIn` (`user.py:85`) | `{highlighted: bool}` | No | **Keep** (add real auth) — `user.py:94,110` |
| GET/PUT | `/me/progress` | Last-read pointer | `ProgressIn` (`user.py:129`) | `{book_number, chapter}` | No | **Keep** — `user.py:134,144` |
| GET/PUT | `/me/prefs` | Arbitrary JSON prefs blob | `PrefsIn` (`user.py:157`) | prefs dict | No | **Keep** — `user.py:161,170` |
| GET/PUT | `/me/chats/{book}/{chapter}` | Per-chapter saved conversation | `ChatIn` (`user.py:182`) | `{messages}` | No | **Keep** — `user.py:186,201` |
| GET/POST/PUT/DELETE | `/me/ask`, `/me/ask/{id}` | Ask-thread history | `AskThreadIn` (`user.py:219`) | thread rows | No | **Keep** — `user.py:224-274` |

**Security notes carried forward:** every `/me/*` route resolves to the literal string `dev-user` (`user.py:15-20`), so the entire user layer is single-tenant with no authorization check. `PUT /study/{book}/{chapter}` lets any caller write chapter content and inject documents into the RAG index. Both must be closed before Atlas Bible is exposed.

**Client coupling.** The Flutter client calls only: `/read/{book}/{chapter}` (`app/lib/services/bible_api.dart:40`), `/verses/{osis}/cross-references` (`bible_api.dart:73`), and the `/me/*`, `/translations`, `/search/scripture`, `/study/*` set (`app/lib/services/content_api.dart:42-196`). Nothing calls `/rag/*` directly.

---

## 3. Database schema

**As it exists.** Defined across three files:

- `server/db/schema.sql` — 12 content tables + `CREATE EXTENSION vector` (line 5)
- `server/db/migrations_app.sql` — 8 app/user tables
- `server/db/schema_dump.sql` — a `pg_dump --schema-only` snapshot showing **20 tables, zero rows** (`grep -c '^COPY\|^INSERT'` → 0). This is the authoritative record of what the live DB looked like.

**Row counts could not be read.** `docker ps` fails — the Docker daemon is not running (`npipe:////./pipe/dockerDesktopLinuxEngine` unavailable). Port **5435 is closed**; port 5432 is open but that is an unrelated host Postgres, not the `spark-postgres` container, and I did not connect to it. Counts below marked *(documented)* come from `bible-enrichment/PHASE1.md`, which records an independent verification run.

### Content tables

| Table | Columns (type) | Indexes | Rows |
|---|---|---|---|
| `bible_translations` | `id serial PK`, `code varchar(16) UNIQUE`, `name text`, `language varchar(8) ='en'`, `license text`, `copyright text`, `provider text`, `can_redistribute bool =true`, `created_at timestamptz` | PK, unique(code) | 3 expected (KJVPCE, ASV, WEB) |
| `bible_verses` | `id bigserial PK`, `translation varchar(16)`, `book varchar(32)`, `book_number int`, `chapter int`, `verse int`, `text text`, `verse_key int`, `osis_id varchar(32)`; `UNIQUE(translation,book_number,chapter,verse)` | `(translation,verse_key)`, `(translation,osis_id)` | **31,102 for KJVPCE** *(documented)*; ASV/WEB unknown |
| `cross_references` | `id bigserial PK`, `from_key int`, `to_start_key int`, `to_end_key int`, `votes int =0`, `source varchar(32) ='openbible'` | `(from_key, votes DESC)` | **344,799** *(documented, 0 skipped)* |
| `strongs_lexicon` | `strongs varchar(16) PK`, `lang varchar(8)`, `lemma text`, `translit text`, `pos text`, `short_gloss text`, `definition text`, `license text` | PK | **0 — never loaded** |
| `verse_words` | `id bigserial PK`, `verse_key int`, `word_index int`, `surface text`, `lemma text`, `strongs varchar(16)`, `morph text`, `gloss text`, `source varchar(32)`; `UNIQUE(verse_key,source,word_index)` | `(verse_key)`, `(strongs)` | **0 — never loaded** |
| `verse_topics` | `id bigserial PK`, `topic text`, `start_key int`, `end_key int`, `quality_score real` | `(topic)` | **0** |
| `places` | `id bigserial PK`, `name text`, `modern_name text`, `lat float8`, `lng float8`, `feature_type text`, `confidence real`, `candidates jsonb`, `source varchar(32)` | PK only | **0** |
| `place_mentions` | `id bigserial PK`, `place_id bigint FK→places ON DELETE CASCADE`, `verse_key int` | `(verse_key)` | **0** |
| `verse_notes` | `id bigserial PK`, `scope varchar(16) ='verse'`, `verse_key int NULL`, `book_number int`, `chapter int`, `source_id varchar(48)`, `note_type text`, `body text`, `license text` | `(verse_key)`, `(book_number,chapter)` | **0** |
| `dictionary_entries` | `id bigserial PK`, `headword text`, `body text`, `source varchar(32)`, `license text` | PK only | **0** |
| `dictionary_verse_refs` | `entry_id bigint FK→dictionary_entries CASCADE`, `verse_key int` | `(verse_key)` | **0** |
| `data_sources` | `id serial PK`, `key varchar(48) UNIQUE`, `name text`, `url text`, `license text`, `attribution text`, `share_alike bool =false`, `loaded_at timestamptz` | PK, unique(key) | 2 expected (`kjv_scrollmapper`, OpenBible) |

### App / user tables (`migrations_app.sql`)

| Table | Columns | Indexes | Rows |
|---|---|---|---|
| `app_users` | `id text PK`, `display_name text`, `created_at timestamptz` | PK | 1 (`'dev-user'`, seeded at `migrations_app.sql:10`) |
| `user_notes` | `id bigserial PK`, `user_id text`, `book_number int`, `chapter int`, `verse int NULL`, `verse_key int NULL`, `osis_id text NULL`, `body text`, `created_at` | `(user_id,book_number,chapter)` | unknown |
| `user_highlights` | `id bigserial PK`, `user_id text`, `verse_key int`, `osis_id text`, `book_number int`, `chapter int`, `verse int`, `color text ='amber'`, `created_at`; `UNIQUE(user_id,verse_key)` | `(user_id,book_number,chapter)` | unknown |
| `reading_progress` | `user_id text PK`, `book_number int`, `chapter int`, `updated_at` | PK | ≤1 |
| `user_prefs` | `user_id text PK`, `prefs jsonb ='{}'` | PK | ≤1 |
| `chapter_studies` | `book_number int`, `chapter int`, `content jsonb`, `model text`, `created_at`; `PRIMARY KEY(book_number,chapter)` | PK only | **~20** (Matthew 1–10, Proverbs 1–10 — inferred from the Chroma store, §5) |
| `reading_chats` | `user_id text`, `book_number int`, `chapter int`, `messages jsonb ='[]'`; `PK(user_id,book_number,chapter)` | PK | unknown |
| `ask_threads` | `id bigserial PK`, `user_id text`, `title text`, `messages jsonb ='[]'`, `updated_at` | `(user_id, updated_at DESC)` | unknown |

### Observations

- **`pgvector` is installed but never used.** `CREATE EXTENSION vector` at `schema.sql:5`, and no table anywhere declares a `vector` column. All embeddings live in Chroma instead.
- **No foreign keys from enrichment tables to `bible_verses`.** `verse_key` is a bare `int` everywhere. Only `place_mentions → places` and `dictionary_verse_refs → dictionary_entries` have real FKs.
- **`chapter_studies` has no index beyond its PK** and no `source`/`license`/`review` columns — no way to distinguish AI-generated from sourced content.
- `cross_references` has no index on `to_start_key`, so reverse lookups ("what points *at* this verse?") are a sequential scan over 344,799 rows.

---

## 4. Scripture text inventory

> **Superseded for Atlas Bible, 2026-08-29.** This section describes the *prototype*. Atlas
> Bible no longer uses scrollmapper at all and loads **four** translations — BSB, KJV, WEB,
> ASV, **124,372 verses measured in Postgres** — from committed, hash-pinned files in
> `data/scripture/`. See `data/scripture/PROVENANCE.md` and `apps/api/scripts/`.
>
> Three findings from this section were resolved by measurement:
> - **§8 question 2 ("whether ASV and WEB actually loaded")** — scrollmapper publishes no
>   `WEB.json`, so the prototype's `load_more_translations.py` 404ed on every run. WEB was
>   never loaded there. It now comes from eBible.org.
> - **"Licensing status: clean"** is right about the licences and wrong about the data.
>   scrollmapper's `KJVPCE` is **corrupt**: Joshua 15:1, Job 7:1, Hosea 8:1 and **Romans
>   8:1** are empty strings in every format it publishes. The prototype's 31,102 assertion
>   at `load_verses.py:173` would have caught it; whatever produced the documented count
>   did not.
> - **"Nothing is bundled … no local copy to rebuild from"** — fixed. `pnpm db:seed` works
>   offline from the committed cache, and the loader verifies each payload's SHA-256 before
>   parsing it.
>
> The **verse-key scheme below is kept verbatim** and is what every new loader emits.


| Translation | Code | Books | Verses | Format on disk | Where it lives | License |
|---|---|---|---|---|---|---|
| King James Version (Pure Cambridge) | `KJVPCE` | 66 | **31,102** *(asserted at load, `load_verses.py:173`)* | none — fetched at load time | `bible_verses` in Postgres | Public Domain; data wrapper MIT (`load_verses.py:138`) |
| American Standard Version | `ASV` | 66 | not asserted | none | `bible_verses` | Public Domain (`load_more_translations.py:53`) |
| World English Bible | `WEB` | 66 | not asserted | none | `bible_verses` | Public Domain |

**Nothing is bundled.** There is no scripture text file anywhere in the repo — not in `app/assets/`, not in `server/db/`. Both loaders fetch over HTTPS from `raw.githubusercontent.com/scrollmapper/bible_databases` at runtime (`load_verses.py:25`, `load_more_translations.py:16`) and `COPY` straight into Postgres. **If that repo moves or the DB volume is lost, there is no local copy to rebuild from.**

**Versification:** KJV / Protestant, 31,102 verses, 66 books. Canonical book map at `server/app/scripture/books.py:7-31` (book_number ↔ canonical name ↔ OSIS code), with a tolerant alias table for wild-caught names.

**Verse keys — keep these exactly.** `server/app/scripture/refs.py:9`:
```
verse_key = book_number * 1_000_000 + chapter * 1_000 + verse    # John 3:16 -> 43003016
osis_id   = "John.3.16"
```
Both are stored on every row. The integer is the fast internal key; the OSIS string is the join key that every external enrichment dataset natively emits. `refs.py:51` also parses OSIS ranges (`1John.4.9-1John.4.10`), which is how OpenBible encodes multi-verse targets.

**Licensing status: clean.** All three translations are public domain, loaded from an MIT-licensed data repo, with provenance recorded in `data_sources` (`load_verses.py:122-140`). `DECISIONS.md` #8 records the deliberate swap away from scrollmapper's GPL-encumbered `KJV` module to PD `KJVPCE`, and away from the non-commercial `AKJV`/`MKJV` traps in the same repo.

**Third loader present but out of scope of the brief:** `server/loaders/load_xrefs.py` fetches `https://a.openbible.info/data/cross-references.zip` (`:31`), expects exactly 344,799 rows (`:34`), and asserts on load (`:143-147`).

**Missing loader:** `server/app/routers/study.py:3` says chapter studies are "Populated by `loaders/enrich.py`". **That file does not exist in the repo.** The only loaders present are `load_verses.py`, `load_more_translations.py`, and `load_xrefs.py`. The generation logic for the one piece of real enrichment content is gone.

---

## 5. Enrichment data inventory

### 5a. `bible-enrichment/` — research, not data

**7 files, 147,864 bytes total. No subdirectories. No data files.**

| File | Size | What it is |
|---|---|---|
| `PROPOSAL.md` | 19,696 | The sourcing plan: 6 domains, recommended stack, canonical data model, 9-step ingestion pipeline, cost/effort estimates, 3-tier license analysis |
| `findings.json` | 102,291 | Raw scout output — 52 resources across 6 domains, **43 verified** by live fetch, each with URL, license text, format, join key, coverage, and evidence |
| `feasibility.json` | 16,960 | Verdict + verse-ID-scheme justification + pipeline detail |
| `DECISIONS.md` | 2,396 | 18 locked product-owner decisions (2026-08-12) |
| `PHASE1.md` | 2,374 | What shipped: DB counts, endpoints, validation results |
| `VALIDATION.md` | 2,197 | Independent re-verification log |
| `extract.mjs` | 892 | The script that split an agent result blob into the three files above |

**Coverage matrix: there is none.** No book, chapter, or verse has an enrichment record in this folder. Its value is the verified source catalogue in §6.

The `DECISIONS.md` entries that constrain Atlas Bible:

| # | Decision |
|---|---|
| 1 | Do **not** redistribute the enrichment DB — pull on-demand, server-side only |
| 2 | Keep CC BY-SA data in its own tagged tables, never blended |
| 3 | Commercial future → exclude non-commercial and copyrighted sources |
| 6 | Canonical versification = **KJV** (31,102 verses) |
| 7 | Verse key scheme = **both** integer `BBBCCCVVV` and OSIS string |
| 10 | Maps must **surface scholarly uncertainty** — show multiple candidate sites + confidence |
| 11 | Cross-references default to high-confidence only (`votes > 0`) |
| 13 | Cultural/historical context is **chapter-level** for now |
| 15 | Optional AI layer deferred to Phase 3 |

Note that decisions #1 and #2 predate the Atlas Bible pre-computed-record design and may now conflict with it — queued as **Q-007**.

### 5b. The Chroma store — the only real enrichment content that exists

`server/.chroma/chroma.sqlite3`, 4,870,144 bytes. Read via a scratch copy; the original was not touched.

- **1 collection** `documents`, **384 dimensions** (Chroma's bundled all-MiniLM-L6-v2 ONNX embedder — no API key needed, `rag/store.py:12-22`)
- **1,029 embeddings**, 6,971 metadata rows

| Book | Chunks |
|---|---|
| Matthew | 531 |
| Proverbs | 497 |
| *(1 chunk with no book metadata)* | 1 |

| `kind` | Chunks |
|---|---|
| `verse` | 603 |
| `commentary` | 197 |
| `word` | 127 |
| `culture` | 81 |
| `overview` | 20 |

Chapters span **1–10 only**, for both books. So: **20 chapters enriched out of 1,189 — 1.7% of the canon**, and only in LLM-generated prose.

**Real sample records** (verbatim from the store):

```
kind:      overview
source_id: study:Proverbs.2:overview:0
text:      "Proverbs 2 unfolds as a single extended sentence in the Hebrew: a long
            chain of conditions (vv.1-4) followed by their results (vv.5-22), making
            it one of the most tightly structured chapters in the book. The father
            urges his son to actively receive, treasure, and search for wisdom as one
            would mine for silver, promising that such pursuit yields the fear of the
            Lord and the knowledge of God. That wisdom then functions as a protective
            guard against two dangerous paths: violent, crooked men (vv.12-15) and the
            seductive 'strange woman' who has abandoned her marriage covenant
            (vv.16-19)…"
```
```
kind:      culture
source_id: study:Proverbs.2:culture:39
text:      "The 'my son' address (v.1) reflects the father-to-son instructional genre
            common across ancient Near Eastern wisdom literature, including Egyptian
            instructional texts, where a senior figure passes on practical and moral
            counsel to a younger heir."
```
```
kind:      commentary
source_id: study:Proverbs.2:commentary:29
text:      "The conditional 'if' launches the chapter's long sentence, showing that
            wisdom's benefits (not fully stated until v.5) are contingent on the son's
            willingness to receive and internalize instruction now."
```
```
kind:      verse
source_id: study:Proverbs.2:verse:1
text:      "The father calls his son to receive his words and 'hide' (treasure inwardly)
            his commandments, setting the condition on which everything that follows
            depends."
```
```
kind:      word
source_id: study:Proverbs.1:word:2
text:      "fear: reverent awe —"
```

The record shape is defined by `study.py:76-102` (`_study_documents`) and `app/lib/models/study.dart:50` (`StudyContent`): `{overview, theme, key_points[], words[], culture[], commentary[], verses[]}`.

### 5c. Flutter prototype fixtures — design intent, hand-authored, not data

`app/lib/data/content.dart` (20,164 bytes) is explicitly labelled *"All demo content for the Lampstand prototype… authored for Ruth 2"* (`content.dart:7-8`). It is the closest existing thing to the Atlas Bible badge system, and it is worth reading as a **spec**, not as a corpus. It contains, for Ruth 2 only:

- 5 wiki `Entity` records (Moab, Bethlehem, Gleaning, Kinsman-redeemer/`gō'ēl`, Barley harvest) with body prose, cross-refs, and `[[id|label]]` wiki links
- 4 `HebrewVerse` rows (pointed Hebrew + academic transliteration)
- 5 `InterlinearWord` rows with Strong's numbers — real sample: `{hebrew:'מוֹדָ֖ע', translit:'môdāʿ', gloss:'a relative', root:'ידע', strong:'H4129'}`
- 3 `Witness` rows — a **manuscript-variant badge in miniature**: Masoretic (Leningrad Codex, 1008 AD), Septuagint (`δυνατὸς ἰσχύι`), Targum Ruth
- 2 commentary quotes, a genealogy chain, a timeline, a translation comparison

The context panel (`app/lib/widgets/context_panel.dart`, 73,578 bytes) already renders tabs named **Overview / Original / Culture / Map / Word** (`context_panel.dart:1021-1026`) plus a "Manuscript witnesses" section (`:1325`) and a `_MapTab` with hardcoded pins (`:1605-1606`). The badge UI substantially exists. The data behind it does not.

### 5d. `app/assets/` — no data, no media of consequence

```
app/assets/textures/grain.png     10,732 bytes
app/assets/textures/noise.png  3,745,629 bytes
```
Two UI texture overlays. **No bundled scripture, no maps, no geodata, no 3D assets.** (`app/doc/` additionally holds a 1.9 MB capabilities report and 14 screenshots — documentation, not data.)

### 5e. `scripts/` — one utility

`scripts/check-env.mjs` (6,442 bytes): reads `.env.local`, lists every variable with secrets masked to length+prefix, live-probes known API keys with read-only calls, and TCP-probes the `DATABASE_URL` host. Zero dependencies. **Worth porting to Atlas Bible as-is** — it is the right pattern for env validation.

### 5f. Verdict: is this usable as-is for the badge system?

**No.** What is usable:

- ✅ The **verse-key scheme, book map, and OSIS parser** — port verbatim (`scripture/books.py`, `scripture/refs.py`)
- ✅ The **cross-references corpus + endpoint** — this is the Cross-Ref badge, working today
- ✅ The **three loaders** — the idempotent fetch → validate → `COPY` → assert pattern is the right shape for all remaining ingests
- ✅ The **sourcing research** in `PROPOSAL.md` / `findings.json` — saves days of license archaeology
- ✅ The **prototype fixtures** as a UI/content spec for what a badge record must contain
- ❌ The **1,029 study chunks** — 1.7% coverage, LLM-generated, no provenance or review flag, and the generator script is missing. Treat as a throwaway prototype.
- ❌ Everything else — 9 of 12 enrichment tables are empty.

### 5g. Environment / secrets

Present, **values not read or printed**. `server/.env`: `OPENROUTER_API_KEY`, `DEFAULT_MODEL`, `ALLOWED_ORIGINS`, `DATABASE_URL`. Repo-root `.env.local`: Clerk publishable + secret keys, `DATABASE_URL`, `AI_PROVIDER`, `AI_CHAT_MODEL`, `AI_EMBEDDING_MODEL`, `AI_EMBEDDING_DIMENSIONS`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `COHERE_API_KEY`, `AI_RERANK_MODEL`, `API_BIBLE_KEY`, `API_BIBLE_IDS`, plus log/rate-limit settings. `VALIDATION.md` records that `COHERE_API_KEY` and `API_BIBLE_KEY` were empty and the `DATABASE_URL` host was unreachable (Railway-internal). **`.env.local` is not gitignored** (`.gitignore` covers `server/.env` only) — flag for the new repo.

---

## 6. Gap analysis

Effort: **S** = days, **M** = 1–2 weeks, **L** = a month or more / open-ended content problem.

### The 10 inline badges

| Badge | Data we have | Data we need | Where it comes from | Effort |
|---|---|---|---|---|
| **Route** | Nothing. `places` + `place_mentions` tables exist, empty | Place → coords → verse, with confidence + alternate candidate sites (DECISIONS #10) | **OpenBible Bible-Geocoding-Data**, CC BY 4.0, JSONL, OSIS join — 1,341 places / 5,616 verses · `https://github.com/openbibleinfo/Bible-Geocoding-Data` (`data/ancient.jsonl`, `modern.jsonl`, `geometry.jsonl`). Cross-load **Theographic Places.csv** (CC BY-**SA**) 1,911 places · `https://github.com/robertrouse/theographic-bible-metadata` | **S** |
| **3D City** | **Nothing** — no 3D assets, no models, no source identified | Per-city 3D geometry or photogrammetry for Jerusalem, Ephesus, Corinth, Troas… | **No open dataset exists.** Options: commission/license models, or degrade to a stylised 2.5D map from OSM + elevation. OSM basemap `https://www.openstreetmap.org` (ODbL, share-alike); terrain from **Natural Earth** (PD) `https://www.naturalearthdata.com` | **L** |
| **History** (`temporal_data`) | Nothing | `year_approx`, `roman_emperor`, `cultural_context_note` per passage | **No dataset provides this joined to verses.** `roman_emperor`/`year_approx` are tractable as a small hand-built ruler-reign table joined by date range (~200 rows, Wikidata-derivable). `cultural_context_note` → **unfoldingWord en_tn** (CC BY-SA 4.0, TSV, whole canon) `https://git.door43.org/unfoldingWord/en_tn`, plus **HelloAO** PD commentaries `https://bible.helloao.org/api/available_commentaries.json`. Dating passages to years is scholarly judgement — LLM or hand | **L** |
| **Word Root** (Greek/Hebrew + Strong's) | `verse_words` + `strongs_lexicon` tables exist, both empty. Prototype shows the exact target shape (`content.dart:191`) | ~560K per-word rows (lemma, Strong's, morph) + ~14,300 lexicon entries | **unfoldingWord UHB** (Hebrew OT) + **UGNT** (Greek NT), CC BY-SA 4.0, USFM 3.0 `\w …\|lemma= strong= x-morph=` · `https://git.door43.org/unfoldingWord/hbo_uhb`, `https://git.door43.org/unfoldingWord/el-x-koine_ugnt`. Lexicons: **OpenScriptures HebrewLexicon** (BDB, CC BY 4.0) `https://github.com/openscriptures/HebrewLexicon` + **Dodson Greek Lexicon** (PD) `https://github.com/biblicalhumanities/Dodson-Greek-Lexicon`. CC BY 4.0 alternative to UHB/UGNT: **STEPBible TAHOT/TAGNT** `https://github.com/STEPBible/STEPBible-Data`. **Requires STEPBible TVTMS versification mapping** — Hebrew/Greek numbering diverges from KJV | **M** |
| **Lineage** | Nothing. Prototype has a hardcoded 3-name chain (`content.dart:296`) | Person → parent/child edges, joined to verses | **Theographic Bible Metadata** `People.csv` / `PeopleGroups.csv` (CC BY-SA 4.0) `https://github.com/robertrouse/theographic-bible-metadata` — the only verified open genealogy graph. Secondary: **STEPBible TIPNR** proper nouns (CC BY 4.0 but carries a "please don't re-host" request — needs a human call) | **M** |
| **Manuscript** | Nothing in the DB. Prototype has 3 hand-written `Witness` cards for one verse (`content.dart:224`) | Textual variants per verse: witness sigla, readings, significance | **Weakest domain.** No verified variant apparatus was found in the research. Partial: **openscriptures/morphhb** (WLC, PD + CC BY 4.0 annotations) `https://github.com/openscriptures/morphhb` gives the Hebrew base text; SBLGNT apparatus exists but is **EULA-encumbered and explicitly rejected** in `PROPOSAL.md` §3a. Realistically hand-authored for a small set of famous variants | **L** |
| **Cross-Ref** | ✅ **344,799 rows loaded and serving.** `GET /verses/{osis}/cross-references` works today | Nothing — this is done | **OpenBible.info Cross References**, CC BY 4.0 · `https://a.openbible.info/data/cross-references.zip` (already wired: `load_xrefs.py:31`) | **Done** |
| **Chiasm/Structure** | **Nothing.** Zero occurrences of "chiasm"/"chiastic" anywhere in the repo | `literary_type` + `key_chiastic_nodes[]` per passage | **No open dataset exists.** Literary-structure analysis is scholarly interpretation. LLM-generated with review, or hand-authored. Nearest adjacent source: **unfoldingWord en_tn** discourse notes | **L** |
| **Cultural** | 81 LLM-generated `culture` chunks for 20 chapters | Chapter- or verse-level culture/custom/idiom notes across the canon | **unfoldingWord en_tn** (CC BY-SA 4.0, purpose-built culture/idiom/background notes, whole canon) `https://git.door43.org/unfoldingWord/en_tn` + **en_tw** key terms `https://git.door43.org/unfoldingWord/en_tw` + **Easton's/Smith's dictionaries** (5,998 entries / 35,089 verse refs, CC BY 4.0) `https://github.com/neuu-org/bible-dictionary-dataset` | **M** |
| **Meditate** | **Nothing** | Reflection prompts / guided practice per passage | **No dataset.** Pure content authoring, or LLM-generated from the passage + its notes | **M** (LLM) / **L** (hand) |

### The passage JSON schema

| Spec field | Data we have | Data we need | Source | Effort |
|---|---|---|---|---|
| `passage_id` (`ACTS_16_11_15`) | Verse keys only — no pericope table anywhere | Passage boundary definitions for the whole canon | No verified open pericope dataset. Derivable from USFM `\s` section headings in **BSB USFM** (PD) `https://github.com/BSB-publishing/bsb2usfm`, or from chapter+paragraph markers. **Queued as Q-009** | **M** |
| `book`, `chapter`, `verses` | ✅ Fully covered by `books.py` + `refs.py` | — | Existing | **Done** |
| `spatial_data.locations[]` | Nothing | name, `[lng,lat]`, role (`departure`/`arrival`/…) | OpenBible geocoding gives name + coords + confidence. **Role/`type` is not in any dataset** — it is narrative interpretation, must be derived | **M** |
| `spatial_data.camera_center`, `zoom_level` | Nothing | Per-passage camera framing | **Not a dataset — computed.** Bounding box over the passage's `locations[]` → centroid + zoom. Pure geometry once places exist | **S** |
| `temporal_data.year_approx` | Nothing | Approximate date per passage | Hand-built passage-dating table, or LLM. No open source | **L** |
| `temporal_data.roman_emperor` | Nothing | Ruler in office at that date | Hand-built ruler-reign table (~200 rows, Wikidata-derivable), joined by date range. Only works once `year_approx` exists | **S** (given dates) |
| `temporal_data.cultural_context_note` | 81 LLM chunks, 20 chapters | Canon-wide notes | unfoldingWord en_tn + HelloAO commentaries | **M** |
| `structural_data.literary_type` | Nothing | Genre per passage | Book-level genre is a 66-row hand table (trivial). Passage-level (parable/hymn/genealogy/travel-narrative) is classification work — LLM or hand | **S**–**M** |
| `structural_data.key_chiastic_nodes[]` | Nothing | Chiastic structure per passage | No dataset. See Chiasm badge | **L** |

**Summary:** 1 of 10 badges ships today. 4 more (Route, Word Root, Cultural, Lineage) are deterministic ingest against verified open datasets — the `PROPOSAL.md` estimate of 1–2 weeks and $0 model spend is credible. The remaining 5 (3D City, History, Manuscript, Chiasm, Meditate) plus `year_approx`/`literary_type`/`key_chiastic_nodes` are **content-creation problems, not data-engineering problems**, and no amount of ingestion work will produce them. That is the single most important finding in this document.

---

## 7. Recommended target schema

Postgres 16 + pgvector. Design principles: (1) **verse-keyed storage with a pericope overlay**, so every open dataset joins with zero remapping while the spec's passage records are still expressible; (2) **real foreign keys** — the old schema's bare `int` verse keys let bad data in silently; (3) **provenance on every enrichment row**, because DECISIONS #2/#4 require license-tagged separability and per-source attribution; (4) **pgvector in Postgres**, retiring Chroma so RAG and scripture live in one transactional store.

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── Provenance (every enrichment row points here) ────────────────────────────
CREATE TABLE data_sources (
    id          serial PRIMARY KEY,
    key         varchar(48) UNIQUE NOT NULL,      -- 'openbible_xref', 'uw_uhb'
    name        text NOT NULL,
    url         text,
    license     text NOT NULL,                    -- SPDX-ish: 'CC-BY-4.0'
    share_alike boolean NOT NULL DEFAULT false,   -- drives the separability rule
    attribution text NOT NULL,                    -- exact string the UI must show
    version     text,
    loaded_at   timestamptz
);

-- ── Scripture backbone ───────────────────────────────────────────────────────
CREATE TABLE translations (
    code             varchar(16) PRIMARY KEY,     -- 'KJVPCE'
    name             text NOT NULL,
    language         varchar(8)  NOT NULL DEFAULT 'en',
    source_id        int REFERENCES data_sources(id),
    can_redistribute boolean NOT NULL DEFAULT true
);

CREATE TABLE verses (
    verse_key   int  NOT NULL,                    -- BBBCCCVVV, canonical KJV versification
    translation varchar(16) NOT NULL REFERENCES translations(code),
    book_number smallint NOT NULL CHECK (book_number BETWEEN 1 AND 66),
    chapter     smallint NOT NULL,
    verse       smallint NOT NULL,
    osis_id     varchar(32) NOT NULL,             -- 'John.3.16'
    text        text NOT NULL,
    text_tsv    tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED,
    PRIMARY KEY (translation, verse_key)
);
CREATE INDEX verses_osis_idx  ON verses (translation, osis_id);
CREATE INDEX verses_ref_idx   ON verses (translation, book_number, chapter, verse);
CREATE INDEX verses_tsv_idx   ON verses USING gin (text_tsv);
CREATE INDEX verses_trgm_idx  ON verses USING gin (text gin_trgm_ops);
```
*Why:* `(translation, verse_key)` as a natural composite PK removes the pointless `bigserial` and makes the hot path — "give me this chapter in this translation" — a single index range scan. `text_tsv` + trigram replaces the unindexable `ILIKE '%q%'` at `search.py:24`.

```sql
-- ── Passages (pericopes) — the spec's passage_id lives here ──────────────────
CREATE TABLE passages (
    passage_id   varchar(48) PRIMARY KEY,         -- 'ACTS_16_11_15'
    book_number  smallint NOT NULL,
    chapter      smallint NOT NULL,
    start_key    int NOT NULL,                    -- 44016011
    end_key      int NOT NULL,                    -- 44016015
    title        text,
    literary_type text,                           -- structural_data.literary_type
    scheme       varchar(24) NOT NULL DEFAULT 'atlas',  -- allows alternate pericope schemes
    CHECK (end_key >= start_key)
);
CREATE INDEX passages_range_idx ON passages USING gist (int4range(start_key, end_key, '[]'));
CREATE INDEX passages_book_idx  ON passages (book_number, chapter);
```
*Why:* a GiST range index answers "which passage contains verse 44016013?" in one lookup — the query every verse-level badge needs. Keeping `scheme` means a second pericope tradition can coexist without a migration.

```sql
-- ── Word layer (Word Root badge) ─────────────────────────────────────────────
CREATE TABLE lexicon (
    strongs     varchar(16) PRIMARY KEY,          -- 'H7225', 'G2424'
    lang        varchar(8)  NOT NULL,
    lemma       text, translit text, pos text,
    short_gloss text, definition text,
    source_id   int NOT NULL REFERENCES data_sources(id)
);

CREATE TABLE verse_words (
    id         bigserial PRIMARY KEY,
    verse_key  int NOT NULL,
    word_index smallint NOT NULL,
    surface    text NOT NULL,
    lemma      text,
    strongs    varchar(16) REFERENCES lexicon(strongs),
    morph      text, gloss text,
    source_id  int NOT NULL REFERENCES data_sources(id),
    UNIQUE (verse_key, source_id, word_index)
);
CREATE INDEX verse_words_key_idx     ON verse_words (verse_key);
CREATE INDEX verse_words_strongs_idx ON verse_words (strongs);
```
*Why:* the FK to `lexicon` catches Strong's numbers that the UHB/UGNT parser emits but no lexicon covers — a real failure mode in this data. `source_id` on the row (not the table) is what makes CC BY-SA separability enforceable with a `WHERE` clause.

```sql
-- ── Geography (Route badge + spatial_data) ───────────────────────────────────
CREATE TABLE places (
    id           bigserial PRIMARY KEY,
    name         text NOT NULL,
    modern_name  text,
    lng          double precision,
    lat          double precision,
    feature_type text,
    confidence   real,                            -- DECISIONS #10
    candidates   jsonb NOT NULL DEFAULT '[]',     -- alternate scholarly sites
    source_id    int NOT NULL REFERENCES data_sources(id)
);
CREATE INDEX places_name_idx ON places USING gin (name gin_trgm_ops);

CREATE TABLE place_mentions (
    place_id  bigint NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    verse_key int NOT NULL,
    role      text,                               -- 'departure'|'arrival'|'setting'
    PRIMARY KEY (place_id, verse_key)
);
CREATE INDEX place_mentions_verse_idx ON place_mentions (verse_key);
```
*Why:* `candidates jsonb` is the direct implementation of DECISIONS #10 (never collapse scholarly disagreement to one pin). `role` is the spec's `locations[].type`; it is nullable because no dataset supplies it.

```sql
-- ── Notes, cross-refs, topics, dictionary, people ────────────────────────────
CREATE TABLE cross_references (
    from_key     int NOT NULL,
    to_start_key int NOT NULL,
    to_end_key   int NOT NULL,
    votes        int NOT NULL DEFAULT 0,
    source_id    int NOT NULL REFERENCES data_sources(id),
    PRIMARY KEY (from_key, to_start_key, to_end_key)
);
CREATE INDEX xref_from_idx ON cross_references (from_key, votes DESC);
CREATE INDEX xref_to_idx   ON cross_references (to_start_key);   -- reverse lookup

CREATE TABLE notes (
    id          bigserial PRIMARY KEY,
    scope       varchar(16) NOT NULL,             -- 'verse'|'passage'|'chapter'|'book'
    verse_key   int,
    passage_id  varchar(48) REFERENCES passages(passage_id),
    book_number smallint, chapter smallint,
    note_type   text NOT NULL,                    -- 'culture'|'history'|'structure'|'meditate'
    body        text NOT NULL,
    origin      varchar(16) NOT NULL DEFAULT 'sourced',  -- 'sourced'|'generated'|'authored'
    reviewed_by text,
    source_id   int REFERENCES data_sources(id),
    CHECK (verse_key IS NOT NULL OR passage_id IS NOT NULL OR chapter IS NOT NULL)
);
CREATE INDEX notes_verse_idx   ON notes (verse_key, note_type);
CREATE INDEX notes_passage_idx ON notes (passage_id, note_type);

CREATE TABLE topics (
    topic     text NOT NULL,
    start_key int NOT NULL, end_key int NOT NULL,
    score     real,
    source_id int NOT NULL REFERENCES data_sources(id),
    PRIMARY KEY (topic, start_key, end_key)
);

CREATE TABLE people (
    id          bigserial PRIMARY KEY,
    name        text NOT NULL,
    gender      varchar(8),
    source_id   int NOT NULL REFERENCES data_sources(id)
);
CREATE TABLE person_relations (            -- Lineage badge
    parent_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    child_id  bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    relation  varchar(16) NOT NULL DEFAULT 'parent',
    PRIMARY KEY (parent_id, child_id, relation)
);
CREATE TABLE person_mentions (
    person_id bigint NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    verse_key int NOT NULL,
    PRIMARY KEY (person_id, verse_key)
);
```
*Why one `notes` table rather than five:* culture / history / structure / meditate all have the same shape (scoped text + provenance) and differ only in `note_type`. The `origin` column is load-bearing — it is the only way the UI can honestly distinguish "unfoldingWord says" from "a model wrote this", and §6 shows a large fraction of Atlas Bible's content will be `generated`.

```sql
-- ── Temporal (History badge) ─────────────────────────────────────────────────
CREATE TABLE rulers (                      -- hand-built, ~200 rows
    id         serial PRIMARY KEY,
    name       text NOT NULL,
    realm      text NOT NULL,              -- 'Roman Empire', 'Judah', 'Persia'
    title      text,                       -- 'Emperor', 'King'
    start_year int NOT NULL,               -- negative = BC
    end_year   int NOT NULL
);
CREATE INDEX rulers_span_idx ON rulers USING gist (int4range(start_year, end_year, '[]'), realm);

CREATE TABLE passage_dating (
    passage_id varchar(48) PRIMARY KEY REFERENCES passages(passage_id),
    year_approx int,
    year_label  text,                      -- '50 AD', 'c. 1100 BC'
    confidence  real,
    origin      varchar(16) NOT NULL DEFAULT 'authored',
    rationale   text
);
```
*Why:* `temporal_data.roman_emperor` becomes a **join, not stored data** — `passage_dating.year_approx` against `rulers` range. One 200-row table serves every passage, and correcting a reign date fixes the whole canon at once.

```sql
-- ── Pre-computed enrichment record (the spec's JSON, materialised) ───────────
CREATE TABLE passage_enrichment (
    passage_id     varchar(48) PRIMARY KEY REFERENCES passages(passage_id) ON DELETE CASCADE,
    spatial_data   jsonb,
    temporal_data  jsonb,
    structural_data jsonb,
    badges         text[] NOT NULL DEFAULT '{}',  -- which badges have content
    built_at       timestamptz NOT NULL DEFAULT now(),
    builder_version text NOT NULL
);
CREATE INDEX passage_enrichment_badges_idx ON passage_enrichment USING gin (badges);
```
*Why:* this is a **derived cache**, not the source of truth — rebuildable from the normalised tables by a builder job. The spec's JSON shape is preserved exactly for the client, but a corrected place coordinate or reign date propagates by re-running the builder rather than by editing thousands of JSON blobs. `badges text[]` + GIN index answers "which badges light up on this verse?" without deserialising anything.

```sql
-- ── RAG / grounded chat (retires Chroma) ─────────────────────────────────────
CREATE TABLE embeddings (
    id         bigserial PRIMARY KEY,
    kind       varchar(24) NOT NULL,       -- 'verse'|'note'|'dictionary'|'commentary'
    ref_key    text NOT NULL,              -- verse_key, passage_id, or notes.id
    verse_key  int,                        -- nullable back-pointer for filtered search
    chunk_index smallint NOT NULL DEFAULT 0,
    content    text NOT NULL,
    embedding  vector(1536) NOT NULL,      -- text-embedding-3-small
    source_id  int REFERENCES data_sources(id),
    UNIQUE (kind, ref_key, chunk_index)
);
CREATE INDEX embeddings_hnsw_idx ON embeddings
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX embeddings_verse_idx ON embeddings (verse_key);
CREATE INDEX embeddings_kind_idx  ON embeddings (kind);
```
*Why pgvector over Chroma:* (1) retrieval can be **filtered by book, passage, or license tier in the same query** — impossible across a process boundary, and DECISIONS #2 makes license filtering a hard requirement; (2) the existing Chroma collection is persisted with `hnsw:space = l2` despite `rag/store.py:20` requesting `cosine`, and `store.py:71` then computes `score = 1.0 - distance` as if it were cosine — **the current relevance scores are wrong**, and a rebuild is needed regardless; (3) one backup, one transaction boundary, no second service; (4) 1536-dim `text-embedding-3-small` at ~$0.02/1M tokens puts a full-canon embed under $1 per `PROPOSAL.md` §6, versus the current 384-dim MiniLM.

**User tables** (`app_users`, `user_notes`, `user_highlights`, `reading_progress`, `user_prefs`, `reading_chats`, `ask_threads`) port across essentially unchanged from `migrations_app.sql` — but `user_id` must become a real FK to an authenticated identity, replacing the `'dev-user'` constant at `user.py:15`.

---

## 8. Open questions

**Could not determine from the repo:**

1. **Live row counts.** Docker is not running and port 5435 is closed, so `bible_verses`, `cross_references`, `chapter_studies` and all user tables could not be counted. The 31,102 / 344,799 figures are from `PHASE1.md`'s validation log and from the load-time assertions at `load_verses.py:173` and `load_xrefs.py:143`, not from a live read. **Whether the DB volume still exists at all is unknown** — `docker volume ls` was not reachable either.
2. **Whether ASV and WEB actually loaded.** `load_more_translations.py` has no verse-count assertion (unlike `load_verses.py:173`), and `PHASE1.md` mentions only KJVPCE. They may be complete, partial, or absent.
3. **`loaders/enrich.py` is missing.** `study.py:3` documents it as the generator for `chapter_studies`, but it is not in the repo and not in git history (single commit). The prompt, model, and schema used to produce the 1,029 study chunks are unrecoverable.
4. **Whether `chapter_studies` content matches the Chroma chunks.** The Chroma store is the flattened output of `_study_documents` (`study.py:76`); the structured `content` jsonb it came from is only in Postgres, which is unreachable. Chapter counts (Matthew 1–10, Proverbs 1–10) are inferred from Chroma metadata.
5. **The `Bible Study App.dc.html` design file** referenced in `PHASE1.md` ("the real UI skin once … is available") is not in the repo. `app/doc/CAPABILITIES_REPORT.html` (1.9 MB) may or may not be related.
6. **Which host Postgres is on port 5432.** Open, but not the spark container and not connected to.

**Queued for the human** (via question-hub, section *18 · From the fleet*):

- **Q-007** — CC BY-SA share-alike posture for the enrichment DB. The best Word Root and Cultural sources (unfoldingWord UHB/UGNT/en_tn, Tyndale OSN, Theographic) are all share-alike, and the spec's pre-computed record blends sources by design. `DECISIONS.md` #2 said "keep table-scoped", but that predates this design. *Recommended: keep table-scoped.*
- **Q-008** — How to source the four badges with no dataset (Chiasm, History/`temporal_data`, 3D City, Meditate). *Recommended: LLM-generate at build time with an `origin='generated'` flag, plus a deterministic hand-built ruler table for `roman_emperor`.*
- **Q-009** — Passage-keyed vs verse-keyed storage. Every open dataset joins on a single verse; the spec's `passage_id` is a range. *Recommended: verse-keyed storage plus a pericope table, with passage records as a rebuildable materialisation (as modelled in §7).*

**Additional decisions worth raising but not yet queued:**

7. Pericope boundaries have no verified open source. Deriving them from BSB USFM `\s` section headings is the cheapest path but ties passage identity to one translation's editorial choices.
8. `spatial_data.locations[].type` (`departure`/`arrival`) is narrative interpretation, present in no gazetteer. Needs the same generate-or-author decision as Q-008.
9. Whether to keep OpenRouter (`config.py:17`, `anthropic/claude-sonnet-4.5`) or move to a direct provider for the build-time generation pipeline, where throughput and cost matter more than model breadth.
