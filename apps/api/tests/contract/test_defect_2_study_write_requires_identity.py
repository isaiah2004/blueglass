"""DEFECT 2 — PUT /study/{book}/{chapter} was an unauthenticated write.

Source of the defect
    A:/Work/spark/spark-app/server/app/routers/study.py: the PUT took a
    body, wrote it to chapter_studies, and ALSO ingested the prose into the RAG
    index -- with no credential of any kind. Anyone who could reach the port
    could rewrite what the grounded-chat surface cites, which is a direct breach
    of pillar 3 (zero-hallucination AI: every claim carries a citation).

What must stay true
    1. The write requires an identity.
    2. The write records WHO wrote it.
    3. The read stays public -- study content is not private, and requiring a
       header to read it would break caching for nothing.
    4. The write does not touch the retrieval index. Indexing is a build step
       over stored rows, not a side effect of an HTTP request.
"""

from __future__ import annotations

import ast
import importlib
import inspect
from pathlib import Path

from httpx import AsyncClient

from app.modules.study.application import SaveChapterStudy
from tests.conftest import DEVICE_HEADER

_STUDY_MODULE_ROOT = Path(__file__).resolve().parents[2] / "app" / "modules" / "study"

# import_module, not `import a.b.router`: the package __init__ rebinds the name
# `router` to the APIRouter instance, so the dotted form yields the object.
_STUDY_ROUTE_MODULE = importlib.import_module("app.modules.study.presentation.router")

_BODY = {"content": {"overview": "Wisdom begins in the fear of the LORD."}}


async def test_study_write_without_an_identity_is_rejected(
    client: AsyncClient,
) -> None:
    """The prototype answered 200 here. This must be a 401."""
    response = await client.put("/study/Proverbs/1", json=_BODY)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "identity_required"


async def test_study_write_with_an_identity_succeeds(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    response = await client.put("/study/Proverbs/1", headers=identified, json=_BODY)

    assert response.status_code == 200
    assert response.json()["book_number"] == 20
    assert response.json()["origin"] == "authored"


async def test_the_written_row_records_its_author(
    client: AsyncClient, container, identified: dict[str, str]
) -> None:
    """An unattributable claim cannot be retracted or trusted."""
    await client.put("/study/Proverbs/1", headers=identified, json=_BODY)

    stored = container.study_repository.studies[(20, 1)]
    assert stored.author_subject.startswith("device:")
    assert stored.author_subject != "dev-user"


async def test_study_read_stays_public(client: AsyncClient, identified) -> None:
    """Reading needs no credential; only writing does."""
    await client.put("/study/Proverbs/1", headers=identified, json=_BODY)

    response = await client.get("/study/Proverbs/1")

    assert response.status_code == 200
    assert response.json()["content"] == _BODY["content"]


async def test_missing_study_is_a_typed_404(client: AsyncClient) -> None:
    response = await client.get("/study/John/3")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "study_not_found"


async def test_empty_study_content_is_rejected(
    client: AsyncClient, identified: dict[str, str]
) -> None:
    response = await client.put("/study/Proverbs/1", headers=identified, json={"content": {}})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "empty_study_content"


def test_the_save_use_case_cannot_be_called_without_an_identity() -> None:
    """Structural guard: identity is the first POSITIONAL parameter and has no
    default, so a route that forgets it raises TypeError rather than quietly
    writing an anonymous row."""
    signature = inspect.signature(SaveChapterStudy.__call__)
    identity = list(signature.parameters.values())[1]

    assert identity.name == "identity"
    assert identity.default is inspect.Parameter.empty


def test_the_write_route_does_not_touch_the_retrieval_index() -> None:
    """The prototype's PUT called store.ingest inline, so a public write mutated
    what the grounded-chat surface cites. Nothing in the study module may import
    the retrieval module.

    Imports are read from the AST rather than grepped, because this module's own
    docstring has to be able to explain the defect it prevents.
    """
    offenders: list[str] = []
    for path in _STUDY_MODULE_ROOT.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                offenders += [a.name for a in node.names if "retrieval" in a.name]
            elif isinstance(node, ast.ImportFrom) and node.module:
                if "retrieval" in node.module:
                    offenders.append(node.module)

    assert offenders == []


def test_the_write_route_calls_nothing_named_ingest() -> None:
    """A second, narrower guard: the specific call the prototype made."""
    tree = ast.parse(inspect.getsource(_STUDY_ROUTE_MODULE))
    called = {
        node.func.attr
        for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
    }

    assert "ingest" not in called


async def test_a_devices_first_ever_write_registers_it_as_an_author(
    client: AsyncClient, container
) -> None:
    """REGRESSION. Found by running the real stack, not by a test.

    chapter_studies.author_subject is a foreign key to identities.subject, so a
    device whose first ever request was a study write hit a
    ForeignKeyViolationError and a 500. The use case now registers the author
    before attributing the row to them.
    """
    brand_new = {DEVICE_HEADER: "device-never-seen-before"}

    response = await client.put("/study/Ruth/2", headers=brand_new, json=_BODY)

    assert response.status_code == 200
    assert "device:device-never-seen-before" in container.identity_repository.subjects
