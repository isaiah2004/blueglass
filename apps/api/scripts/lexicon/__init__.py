"""Original-language ingest: the data behind the [Root] badge.

The pipeline, in order:

    sources           where the files are, and what may be said about them
    tagnt_parser      142k tagged Greek words, with the KJV versification fix
    lexeme_parsers    TBESG, Dodson and OSHB lexicons
    lexeme_builder    one lexicon row-set, with a source per claim
    gloss_alignment   which English word renders which Greek word (pure rule)
    alignment_builder that rule applied to every loaded translation
    provenance        data_sources rows: licence, attribution, retrieval date
    word_layer_writer one transaction, delete-then-COPY, idempotent
    assertions        the gates that must pass before it commits

`scripts.ingest_lexicon` is the CLI that runs them.
"""

from __future__ import annotations

from .sources import ALL_SOURCES, LexiconDataError, LexiconSource

__all__ = ["ALL_SOURCES", "LexiconDataError", "LexiconSource"]
