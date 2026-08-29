"""Every statement the badge repository runs. SQL, reviewed as SQL.

Purpose
    There is no ORM in this service (see `infrastructure/db/pool.py`), so the
    queries live where a reviewer can read them as a set. Keeping them in one
    module also makes the round-trip count visible: eight statements, issued
    together, for a whole chapter's badges.

Index alignment
    Each statement was written against an index the ingest migrations created,
    not the other way round:
      verses          -> verses_ref_idx (translation, book_number, chapter)
      place_mentions  -> place_mentions_verse_idx (verse_key)
      routes          -> routes_book_idx (book_number, chapter)
      passage_dating  -> passages_range_idx, a GiST range index
      cross_references-> xref_from_idx (from_key, votes DESC)
      alignments      -> verse_word_alignments PK (translation, verse_key, ...)

Dependencies
    None. Text constants only.
"""

from __future__ import annotations

#: $1 translation, $2 book_number, $3 chapter.
CHAPTER_VERSES = """
    SELECT verse_key, verse, osis_id, text
      FROM verses
     WHERE translation = $1 AND book_number = $2 AND chapter = $3
     ORDER BY verse_key
"""

#: No parameters. Fourteen rows today; fetching all of them once is cheaper
#: than joining data_sources into eight other statements.
DATA_SOURCES = """
    SELECT key, name, license, attribution, share_alike, url, version, retrieved_at
      FROM data_sources
     ORDER BY id
"""

#: $1 first verse key of the chapter, $2 last.
PLACE_MENTIONS = """
    SELECT verse_key, place_id, mention_kind
      FROM place_mentions
     WHERE verse_key BETWEEN $1 AND $2
     ORDER BY verse_key, place_id
"""

#: The offset the loader adds to a primary name's weight so that a place's own
#: spelling always outranks a variant (`scripts.place_rows.PRIMARY_NAME_WEIGHT`).
#: Subtracting it back out recovers the raw translation count, which is the only
#: number the admissibility gates can compare across spellings -- Jerusalem
#: publishes "Jerusalem" 7,819 times and "Jews" once, and without this the
#: denominator would be 10 rather than 7,819. `tests/integration/test_schema.py`
#: asserts the two constants agree, so they cannot drift apart silently.
PRIMARY_NAME_WEIGHT = 1_000_000

#: $1 first verse key, $2 last, $3 book_number, $4 chapter.
#:
#: The place set is the union of what the chapter MENTIONS and what its route
#: STOPS AT, because a route can pass through a place the English text does not
#: name and the sheet still has to draw the pin.
#:
#: Only `primary` and `translation` spellings are collected. `modern` is
#: excluded deliberately: the gazetteer files Athens as a modern name for the
#: place called Greece, and anchoring a badge on it would tint a word scripture
#: did not write.
#:
#: Each spelling arrives as a record, not as a bare key, because the domain has
#: to weigh it: `kind`, how many translation uses OpenBible counted for it, and
#: whether some OTHER place publishes the same string as its own name. The last
#: one cannot be answered from a single row, which is why it is a subquery here
#: rather than a rule in `spellings.py` -- the adapter supplies the fact, the
#: domain makes the judgement (rule 5.1).
CHAPTER_PLACES = f"""
    WITH wanted AS (
        SELECT place_id FROM place_mentions WHERE verse_key BETWEEN $1 AND $2
        UNION
        SELECT rs.place_id
          FROM route_stops rs
          JOIN routes r USING (route_id)
         WHERE r.book_number = $3 AND r.chapter = $4
    )
    SELECT p.place_id,
           p.name,
           p.modern_name,
           p.lat,
           p.lng,
           p.feature_type,
           p.named_verse_count,
           p.candidate_count,
           p.homonym_count,
           p.precision_type,
           ds.key AS source_key,
           COALESCE(
               jsonb_agg(
                   jsonb_build_object(
                       'normalised', pn.normalised,
                       'name', pn.name,
                       'kind', pn.kind,
                       'attestation', GREATEST(
                           pn.weight - CASE WHEN pn.kind = 'primary'
                                            THEN {PRIMARY_NAME_WEIGHT} ELSE 0 END, 0),
                       'names_another_place', EXISTS (
                           SELECT 1 FROM place_names other
                            WHERE other.normalised = pn.normalised
                              AND other.kind = 'primary'
                              AND other.place_id <> p.place_id)
                   )
               ) FILTER (WHERE pn.kind IN ('primary', 'translation')),
               '[]'::jsonb
           ) AS spellings
      FROM places p
      JOIN data_sources ds ON ds.id = p.source_id
      LEFT JOIN place_names pn ON pn.place_id = p.place_id
     WHERE p.place_id IN (SELECT place_id FROM wanted)
     GROUP BY p.place_id, ds.key
     ORDER BY p.place_id
"""  # noqa: S608 - the only interpolation is a module constant

#: $1 book_number, $2 chapter.
CHAPTER_ROUTES = """
    SELECT r.route_id,
           r.scheme,
           r.start_key,
           r.end_key,
           ds.key AS source_key,
           rs.position,
           rs.verse_key,
           rs.place_id
      FROM routes r
      JOIN data_sources ds ON ds.id = r.source_id
      JOIN route_stops rs ON rs.route_id = r.route_id
     WHERE r.book_number = $1 AND r.chapter = $2
     ORDER BY r.route_id, rs.position
"""

#: $1 first verse key of the chapter, $2 last.
#:
#: DISTINCT ON keeps one structure per passage. Chiasm is contested and the
#: schema deliberately allows a second scholar's reading beside the first; this
#: badge shows one, and picking it by lowest id rather than by row order is
#: what makes the choice the same on every call.
DATED_PASSAGES = """
    SELECT DISTINCT ON (pd.passage_id)
           pd.passage_id,
           p.start_key,
           p.end_key,
           p.title,
           pd.year_approx,
           pd.year_label,
           pd.rationale,
           pd.confidence,
           pd.origin,
           ds.key AS source_key,
           ls.attributed_to,
           ls.claim_label,
           ls.claim_type,
           cs.key AS claim_source_key
      FROM passage_dating pd
      JOIN passages p ON p.passage_id = pd.passage_id
      JOIN data_sources ds ON ds.id = pd.source_id
      LEFT JOIN literary_structures ls ON ls.passage_id = pd.passage_id
      LEFT JOIN data_sources cs ON cs.id = ls.source_id
     WHERE int4range(p.start_key, p.end_key, '[]') && int4range($1, $2, '[]')
     ORDER BY pd.passage_id, ls.id
"""

#: $1 book_number. The year window that decides which of these reach the
#: timeline is a domain rule, applied in `builders/history.py`.
BOOK_EVENTS = """
    SELECT e.id, e.title, e.year_approx, e.date_label,
           e.start_key, e.end_key, e.part_of, ds.key AS source_key
      FROM historical_events e
      JOIN data_sources ds ON ds.id = e.source_id
     WHERE e.book_number = $1
     ORDER BY e.start_key, e.id
"""

#: No parameters. Forty-three rows; which reigns are open in a given year is a
#: domain rule, so the whole table is handed over.
RULERS = """
    SELECT r.id, r.name, r.realm, r.title, r.start_year, r.end_year,
           ds.key AS source_key
      FROM rulers r
      JOIN data_sources ds ON ds.id = r.source_id
     ORDER BY r.id
"""

#: $1 translation, $2 first verse key, $3 last.
#:
#: The INNER join to lexicon_usage is a filter as well as a fetch: a lemma with
#: no usage row has no occurrence count, and the Root badge's whole selection
#: rule is rarity, so a word we cannot count is a word we cannot rank.
#:
#: It joins on `simple_strongs` because `simple_strongs` is what the badge
#: prints. Joined on `l.strongs` -- the disambiguated key the word rows carry --
#: the payload paired a number a reader can look up with a count of one sense
#: of it, and told 26 badges' worth of readers that Ἰησοῦς, ποιέω and πνεῦμα
#: occur once. See `db/versions/0009_20260829_usage_by_published_strongs.py`.
CHAPTER_WORDS = """
    SELECT a.verse_key,
           a.token_index,
           a.token,
           a.char_start,
           a.char_end,
           a.method,
           a.confidence,
           w.surface,
           ads.key AS alignment_source_key,
           wds.key AS word_source_key,
           l.strongs,
           l.simple_strongs,
           l.lang,
           l.lemma,
           l.translit,
           l.pos,
           l.short_gloss,
           l.definition,
           lds.key AS lexeme_source_key,
           dds.key AS definition_source_key,
           u.occurrence_count,
           u.verse_count,
           u.book_count
      FROM verse_word_alignments a
      JOIN verse_words w ON w.id = a.verse_word_id
      JOIN lexicon l ON l.strongs = w.strongs
      JOIN lexicon_usage u ON u.simple_strongs = l.simple_strongs
      JOIN data_sources ads ON ads.id = a.source_id
      JOIN data_sources wds ON wds.id = w.source_id
      JOIN data_sources lds ON lds.id = l.source_id
      LEFT JOIN data_sources dds ON dds.id = l.definition_source_id
     WHERE a.translation = $1 AND a.verse_key BETWEEN $2 AND $3
     ORDER BY a.verse_key, a.token_index
"""

#: $1 translation, $2 first verse key, $3 last, $4 minimum votes, $5 targets
#: per verse. The last two are the domain's own constants, passed in rather
#: than written here, so the threshold has exactly one definition.
#:
#: The window function does the per-verse trim in the database. Without it a
#: 40-verse chapter of Acts returns about a thousand rows to discard nine
#: hundred of; with it, at most $5 per verse cross the wire.
CHAPTER_CROSS_REFS = """
    WITH ranked AS (
        SELECT x.from_key,
               x.to_start_key,
               x.to_end_key,
               x.votes,
               ds.key AS source_key,
               ROW_NUMBER() OVER (
                   PARTITION BY x.from_key
                   ORDER BY x.votes DESC, x.to_start_key, x.to_end_key
               ) AS vote_rank
          FROM cross_references x
          JOIN data_sources ds ON ds.id = x.source_id
         WHERE x.from_key BETWEEN $2 AND $3
           AND x.votes >= $4
    )
    SELECT ranked.from_key,
           ranked.to_start_key,
           ranked.to_end_key,
           ranked.votes,
           ranked.source_key,
           v.text
      FROM ranked
      LEFT JOIN verses v
             ON v.translation = $1 AND v.verse_key = ranked.to_start_key
     WHERE ranked.vote_rank <= $5
     ORDER BY ranked.from_key, ranked.votes DESC, ranked.to_start_key
"""
