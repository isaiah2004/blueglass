"""HTTP routes for the Studio Assistant.

Purpose
    One route: ask a grounded question, get an answer with citations and a
    confidence grade. Everything else -- retrieval, prompting, pricing,
    spend guarding -- lives in application/ and infrastructure/; this module
    only maps HTTP in and out.

Routes
    POST /assistant/ask

Dependencies
    FastAPI, the AskStudioAssistant use case via the container, the wire
    schemas.
"""

from __future__ import annotations

from fastapi import APIRouter

from ....presentation_dependencies import ContainerDep
from . import mappers
from .schemas import AskIn, AskOut

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post(
    "/ask",
    response_model=AskOut,
    summary="Ask the Studio Assistant a grounded question",
    responses={
        422: {"description": "empty or over-length question"},
        503: {
            "description": (
                "dependency_unavailable -- the spend ceiling has been reached, "
                "or a vendor key is not configured"
            )
        },
    },
)
async def ask(container: ContainerDep, body: AskIn) -> AskOut:
    """Answer one question, grounded only in the passage's nearest chunks."""
    answer = await container.ask_studio_assistant.ask(question=body.question)
    return mappers.to_ask_out(answer)
