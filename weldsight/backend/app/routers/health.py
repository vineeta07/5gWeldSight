from fastapi import APIRouter

from .. import config
from ..agent import agent
from ..knowledge import kb
from ..model import segmenter
from ..store import store

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    return {
        "status": "ok" if segmenter.loaded else "degraded",
        "version": config.VERSION,
        "model": segmenter.info(),
        "gemini": {"configured": agent.configured, "model": config.GEMINI_MODEL},
        "knowledge_chunks": len(kb.chunks),
        "uptime_s": store.stats()["uptime_s"],
    }
