from typing import Any, Literal

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from ..agent import agent

router = APIRouter(tags=["assistant"])


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class ChatRequest(BaseModel):
    messages: list[Message] = Field(min_length=1, max_length=30)
    app: Literal["website", "dashboard"] = "website"
    page: str | None = Field(default=None, max_length=120)
    context: Any = None  # what the user is looking at, e.g. the current analysis result


@router.post("/api/chat")
async def chat(req: ChatRequest) -> dict:
    return await run_in_threadpool(agent.reply, [m.model_dump() for m in req.messages], req.app, req.page, req.context)
