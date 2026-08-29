"""The composition root: every concrete class is chosen here and nowhere else.

Purpose
    Rule 5.1 puts DI wiring in exactly one place. Routes ask the container for a
    use case; they never import an adapter. That is what makes the endpoint
    tests able to run against in-memory doubles, and what makes swapping the
    device-id identity resolver for a real one a one-line change.

Key responsibilities
    - Own the Database lifecycle handle.
    - Construct each repository once and each use case once.
    - Expose them as plain attributes.

Dependencies
    Every module, by design. Nothing imports the container except main.py and
    the FastAPI dependency helpers.

Usage
    container = Container(get_settings())
    await container.startup()
"""

from __future__ import annotations

from dataclasses import dataclass, field

from ..infrastructure.db import Database
from ..modules.identity.application import (
    GetPreferences,
    IdentityRepository,
    IdentityResolver,
    SetPreferences,
)
from ..modules.identity.infrastructure import (
    DeviceIdentityResolver,
    PostgresIdentityRepository,
)
from ..modules.scripture.application import (
    GetChapter,
    ListBooks,
    ListTranslations,
    ScriptureRepository,
    SearchVerses,
)
from ..modules.scripture.infrastructure import PostgresScriptureRepository
from ..modules.study.application import (
    AuthorRegistry,
    GetChapterStudy,
    SaveChapterStudy,
    StudyRepository,
)
from ..modules.study.infrastructure import PostgresStudyRepository
from .settings import Settings


@dataclass
class Container:
    """Holds the wired object graph for one running application."""

    settings: Settings
    database: Database = field(init=False)

    # ── Ports, bound to their chosen adapters ─────────────────────────────
    scripture_repository: ScriptureRepository = field(init=False)
    identity_repository: IdentityRepository = field(init=False)
    identity_resolver: IdentityResolver = field(init=False)
    study_repository: StudyRepository = field(init=False)
    # The identity repository satisfies the study module's narrow author
    # port. Binding one adapter to two ports is the composition root's job.
    author_registry: AuthorRegistry = field(init=False)

    # ── Use cases ─────────────────────────────────────────────────────────
    list_translations: ListTranslations = field(init=False)
    list_books: ListBooks = field(init=False)
    get_chapter: GetChapter = field(init=False)
    search_verses: SearchVerses = field(init=False)
    get_preferences: GetPreferences = field(init=False)
    set_preferences: SetPreferences = field(init=False)
    get_chapter_study: GetChapterStudy = field(init=False)
    save_chapter_study: SaveChapterStudy = field(init=False)

    def __post_init__(self) -> None:
        self.database = Database(self.settings)
        self._wire_adapters()
        self._wire_use_cases()

    def _wire_adapters(self) -> None:
        """Choose one implementation per port. THE swap point for real auth."""
        self.scripture_repository = PostgresScriptureRepository(
            self.database, default_translation=self.settings.default_translation
        )
        self.identity_repository = PostgresIdentityRepository(self.database)
        self.author_registry = self.identity_repository
        self.identity_resolver = DeviceIdentityResolver()
        self.study_repository = PostgresStudyRepository(self.database)

    def _wire_use_cases(self) -> None:
        """Build each use case once; they are stateless and safe to share."""
        self.list_translations = ListTranslations(self.scripture_repository)
        self.list_books = ListBooks()
        self.get_chapter = GetChapter(self.scripture_repository)
        self.search_verses = SearchVerses(
            self.scripture_repository,
            default_limit=self.settings.search_default_limit,
            max_limit=self.settings.search_max_limit,
        )
        self.get_preferences = GetPreferences(self.identity_repository)
        self.set_preferences = SetPreferences(self.identity_repository)
        self.get_chapter_study = GetChapterStudy(self.study_repository)
        self.save_chapter_study = SaveChapterStudy(self.study_repository, self.author_registry)

    async def startup(self) -> None:
        """Open long-lived resources."""
        await self.database.connect()

    async def shutdown(self) -> None:
        """Close long-lived resources."""
        await self.database.disconnect()
