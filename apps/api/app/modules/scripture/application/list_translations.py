"""Use case: what translations are loaded.

Purpose
    Decision S-01 ships multiple open translations with a switcher, so the
    client must ask rather than assume. Only translations with verses actually
    present are listed -- an empty translation in the table would render a
    switcher entry that yields an empty chapter.

Dependencies
    The ScriptureRepository port only.

Usage
    translations = await ListTranslations(repository)()
"""

from __future__ import annotations

from collections.abc import Sequence

from ..domain import Translation
from .ports import ScriptureRepository


class ListTranslations:
    """Return every translation with verses loaded."""

    def __init__(self, repository: ScriptureRepository) -> None:
        self._repository = repository

    async def __call__(self) -> Sequence[Translation]:
        return await self._repository.list_translations()
