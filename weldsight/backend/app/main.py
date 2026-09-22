"""WeldSight API: one backend for the website and the inspection dashboard."""
import logging
import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import config
from .model import segmenter
from .routers import chat, dashboard, health, vision

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

app = FastAPI(title="WeldSight API", version=config.VERSION,
              description="Rust segmentation model, Gemini assistant and defect reports for WeldSight.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_origin_regex=config.ALLOWED_ORIGIN_REGEX,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

for r in (health.router, chat.router, vision.router, dashboard.router):
    app.include_router(r)


@app.on_event("startup")
def load_model_in_background() -> None:
    # load in a thread so the server starts answering health checks immediately
    threading.Thread(target=segmenter.load, daemon=True).start()


@app.get("/")
def root() -> dict:
    return {"name": "WeldSight API", "docs": "/docs", "health": "/api/health"}
