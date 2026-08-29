"""The word as this verse spells it, and only the word.

Purpose
    The Root badge prints its `surface` under the label "AS WRITTEN HERE". The
    aligned-word rows carry the token exactly as the original text sets it, and
    the original text sets clause boundaries against the word: Acts 16:11 stores
    `Samothraken,` and Acts 16:12 stores `kolonia.` -- so the sheet promised the
    reader a word and showed them a word plus a comma. A comma is a fact about
    the sentence, not about the lexeme the reader is being invited to compare
    with, so it is trimmed before the badge is built.

What is deliberately NOT trimmed
    The apostrophe. Greek elides before a vowel and writes the elision with a
    right single quote -- `di'`, `kat'`, `ap'` -- and that mark is part of the
    spelling, not punctuation around it. Trimming it would misspell exactly the
    words this badge exists to show. Only the marks that separate clauses and
    sentences are removed, and only from the ends.

Dependencies
    Standard library only. Pure. Rule 5.1.2.
"""

from __future__ import annotations

#: The marks that separate words from each other rather than belonging to one.
#:
#: Written by codepoint rather than as literals so this file stays plain ASCII
#: and so each mark is named. Greek adds two the Latin alphabet does not use:
#: the ano teleia, which is a semicolon, and the erotimatiko, which is a
#: question mark; both appear in TAGNT.
_ASCII_MARKS = ",.;:!?-\"()[]{}"
_UNICODE_MARKS = (
    chr(0x00AB)  # left guillemet
    + chr(0x00BB)  # right guillemet
    + chr(0x00B7)  # middle dot
    + chr(0x0387)  # Greek ano teleia
    + chr(0x037E)  # Greek erotimatiko
    + chr(0x2010)  # hyphen
    + chr(0x2013)  # en dash
    + chr(0x2014)  # em dash
    + chr(0x2026)  # ellipsis
    + chr(0x201C)  # left double quote
    + chr(0x201D)  # right double quote
)
_CLAUSE_MARKS = _ASCII_MARKS + _UNICODE_MARKS


def bare_surface(token: str) -> str:
    """Strip the punctuation the sentence put around a word.

    Args:
        token: The surface form as the aligned-word row stores it.

    Returns:
        The same token with leading and trailing clause marks and whitespace
        removed. A token that is nothing but punctuation returns the empty
        string, and a token with nothing to strip is returned unchanged -- the
        caller therefore never has to ask which case it is in.
    """
    return token.strip().strip(_CLAUSE_MARKS).strip()
