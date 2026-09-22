import base64
import os
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from .. import config, inspection

router = APIRouter(tags=["inspection"])


class ImageJSON(BaseModel):
    image: str = Field(description="Base64 image, with or without a data: prefix")
    mime_type: str = "image/jpeg"


def _b64(s: str) -> bytes:
    if s.startswith("data:"):
        s = s.split(",", 1)[1]
    try:
        data = base64.b64decode(s, validate=True)
    except Exception:
        raise HTTPException(400, "Image is not valid base64")
    _check_size(len(data), config.MAX_IMAGE_MB)
    return data


def _check_size(n: int, max_mb: float) -> None:
    if n > max_mb * 1024 * 1024:
        raise HTTPException(413, f"File is larger than {max_mb:g} MB")


async def _read_upload(file: UploadFile, max_mb: float) -> bytes:
    data = await file.read()
    _check_size(len(data), max_mb)
    if not data:
        raise HTTPException(400, "Empty file")
    return data


@router.post("/api/analyze")
async def analyze(req: ImageJSON) -> dict:
    """Website photo inspector: rust model + Gemini review. Saves a defect report when something is found."""
    try:
        return await run_in_threadpool(inspection.analyze_photo, _b64(req.image), "website")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/analyze/upload")
async def analyze_upload(file: UploadFile = File(...), source: str = Form("dashboard")) -> dict:
    """Same as /api/analyze, but with a normal file upload."""
    data = await _read_upload(file, config.MAX_IMAGE_MB)
    try:
        return await run_in_threadpool(inspection.analyze_photo, data, source if source in ("website", "dashboard") else "dashboard")
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/api/detect")
async def detect(
    file: UploadFile = File(...),
    camera_id: str | None = Form(None),
    threshold: float | None = Form(None),
    record: bool = Form(False),
    annotate: bool = Form(False),
) -> dict:
    """Rust model only (fast). Used by the dashboard's live feeds, one frame at a time."""
    data = await _read_upload(file, config.MAX_IMAGE_MB)
    if threshold is not None and not 0.05 <= threshold <= 0.99:
        raise HTTPException(400, "threshold must be between 0.05 and 0.99")
    try:
        return await run_in_threadpool(inspection.detect_frame, data, camera_id, threshold, record, annotate)
    except ValueError as e:
        raise HTTPException(400, str(e))
    except RuntimeError as e:
        raise HTTPException(503, f"Model unavailable: {e}")


@router.post("/api/video/analyze")
async def analyze_video(file: UploadFile = File(...)) -> dict:
    """Dashboard video upload: samples frames, runs the rust model on each, returns a timeline and summary."""
    data = await _read_upload(file, config.MAX_VIDEO_MB)
    suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        path = tmp.name
    try:
        return await run_in_threadpool(inspection.analyze_video, path, file.filename or "video")
    except ValueError as e:
        raise HTTPException(400, str(e))
    finally:
        os.unlink(path)
