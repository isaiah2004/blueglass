"""No aligned word reaches "AS WRITTEN HERE" carrying the sentence's punctuation.

The unit tests beside `bare_surface` prove the rule against the marks it knows
about. This proves the list is COMPLETE, against every distinct surface TAGNT
actually loaded -- which is how the defect was found: the pilcrow was missing
from the list, `str.strip` stopped at it, and so the full stop behind it
survived on 2,240 word rows and reached the Root sheet for Matthew 27:5.

A mark nobody thought of is exactly the failure a hand-written list has. This
test is the one that notices.

Set ATLAS_TEST_DATABASE_URL to run.
"""

from __future__ import annotations

import unicodedata

import asyncpg
import pytest

from app.modules.badges.domain import bare_surface

pytestmark = pytest.mark.integration

_SURFACES = "SELECT DISTINCT surface FROM verse_words"

#: The one mark that is part of a word rather than around it. Greek elides
#: before a vowel and writes the elision with a koronis -- `kat'`, `di'`, `ap'`
#: -- so a trailing koronis is a spelling, not punctuation. Measured: 22 of the
#: 25,079 distinct surfaces end in one.
_KORONIS = chr(0x1FBD)


def _is_word_character(character: str) -> bool:
    """Letters, combining accents, and the koronis that spells an elision."""
    return character.isalpha() or unicodedata.combining(character) > 0 or character == _KORONIS


async def test_no_loaded_surface_starts_or_ends_in_punctuation(
    connection: asyncpg.Connection,
) -> None:
    """Over all 25,079 distinct surfaces, not a sample of them."""
    rows = await connection.fetch(_SURFACES)
    if not rows:
        pytest.skip("TAGNT is not loaded; run scripts.ingest_lexicon.")

    offenders = []
    for row in rows:
        bare = bare_surface(str(row["surface"]))
        if not bare:
            continue
        if not _is_word_character(bare[0]) or not _is_word_character(bare[-1]):
            offenders.append(bare)

    assert offenders[:10] == [], f"{len(offenders)} surfaces keep a mark"
