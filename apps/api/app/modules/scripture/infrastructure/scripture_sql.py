"""The SQL the scripture repository runs. Separated so it can be read as SQL.

Purpose
    Keep query text out of the adapter method bodies. A reviewer can read this
    file top to bottom and see every statement the read path issues, which is
    how index coverage gets checked.

Notes on the search statement
    - websearch_to_tsquery accepts what a human types, including quoted phrases
      and OR, and never raises on punctuation the way to_tsquery does.
    - The generated text_tsv column is indexed with GIN, so this is an index
      scan, not the sequential scan the prototype ILIKE forced.
    - Results are ranked by ts_rank_cd, then by verse_key, so equal-ranking
      verses come back in canonical order and the ordering is total. A total
      order matters: without it, two runs of the same query can differ.
"""

from __future__ import annotations

LIST_TRANSLATIONS = """
    SELECT t.code,
           t.name,
           t.language,
           t.can_redistribute
    FROM translations t
    WHERE EXISTS (SELECT 1 FROM verses v WHERE v.translation = t.code)
    ORDER BY (t.code = $1) DESC, t.code
"""

TRANSLATION_EXISTS = """
    SELECT EXISTS (
        SELECT 1 FROM verses WHERE translation = $1 LIMIT 1
    )
"""

GET_CHAPTER = """
    SELECT verse, text, osis_id, verse_key
    FROM verses
    WHERE translation = $1 AND book_number = $2 AND chapter = $3
    ORDER BY verse
"""

SEARCH_VERSES = """
    SELECT book_number,
           chapter,
           verse,
           text,
           osis_id,
           verse_key
    FROM verses
    WHERE translation = $1
      AND text_tsv @@ websearch_to_tsquery('english', $2)
      AND ($3::smallint IS NULL OR book_number = $3::smallint)
    ORDER BY ts_rank_cd(text_tsv, websearch_to_tsquery('english', $2)) DESC,
             verse_key
    LIMIT $4
"""

#: Fallback for queries the English text-search configuration reduces to
#: nothing -- a lone stop word, or a fragment the user is still typing. Trigram
#: similarity keeps the overlay responsive instead of showing an empty result
#: for "the". Still index-backed: verses_trgm_idx covers it.
SEARCH_VERSES_TRIGRAM = """
    SELECT book_number,
           chapter,
           verse,
           text,
           osis_id,
           verse_key
    FROM verses
    WHERE translation = $1
      AND text ILIKE '%' || $2 || '%'
      AND ($3::smallint IS NULL OR book_number = $3::smallint)
    ORDER BY verse_key
    LIMIT $4
"""

#: True when the configuration turns the query into an empty tsquery, i.e. the
#: main statement provably cannot match anything.
TSQUERY_IS_EMPTY = """
    SELECT numnode(websearch_to_tsquery('english', $1)) = 0
"""
