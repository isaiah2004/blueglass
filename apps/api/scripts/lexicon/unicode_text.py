"""Normalise original-language text to one Unicode form, once, at ingest.

Purpose
    TBESG writes σέβομαι with U+1F73 (GREEK SMALL LETTER EPSILON WITH OXIA);
    almost everything else in the world -- editors, test files, other lexicons,
    a reader's keyboard -- writes it with U+03AD (WITH TONOS). The two look
    identical and compare unequal. Caught by an integration test whose expected
    lemma was typed rather than copied, which is exactly how it would otherwise
    have reached the product: as a search that finds nothing and a flashcard
    that never matches its own lemma.

Key responsibilities
    Put every Greek and Hebrew string into NFC before it is stored, so equality
    in the database means equality on the screen.

Why this is not "changing the data"
    NFC is canonical equivalence: U+1F73 decomposes to U+03B5 U+0301 and
    recomposes to U+03AD. The characters are the same characters. STEPBible's
    licence explicitly permits reformatting for an application, and this is the
    smallest reformatting there is.

Usage
    lemma = to_nfc(raw_lemma)
"""

from __future__ import annotations

import unicodedata


def to_nfc(text: str) -> str:
    """Canonical composed form. Returns the input unchanged if it is empty."""
    return unicodedata.normalize("NFC", text) if text else text


def to_nfc_or_none(text: str | None) -> str | None:
    """NFC for an optional field, keeping None as None."""
    return None if text is None else to_nfc(text)
