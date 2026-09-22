import threading
import time

import cv2
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ..model import encode_jpeg, segmenter
from ..store import store

router = APIRouter(tags=["dashboard"])


# ── overview ─────────────────────────────────────────────────────────
@router.get("/api/stats")
def stats() -> dict:
    return store.stats()


# ── defect reports ───────────────────────────────────────────────────
@router.get("/api/incidents")
def incidents(status: str | None = None, risk: str | None = None, camera: str | None = None, limit: int = 100) -> list[dict]:
    return store.list_incidents(status, risk, camera, min(limit, 300))


@router.get("/api/incidents/{code}")
def incident(code: str) -> dict:
    row = store.get_incident(code)
    if not row:
        raise HTTPException(404, "Report not found")
    return row


class IncidentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = Field(default=None, max_length=2000)
    operator: str | None = Field(default=None, max_length=80)


@router.patch("/api/incidents/{code}")
def update_incident(code: str, body: IncidentUpdate) -> dict:
    try:
        row = store.update_incident(code, body.status, body.notes, body.operator)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if not row:
        raise HTTPException(404, "Report not found")
    return row


@router.delete("/api/incidents/{code}")
def delete_incident(code: str) -> dict:
    if not store.delete_incident(code):
        raise HTTPException(404, "Report not found")
    return {"deleted": code}


@router.get("/api/inspections")
def inspections(limit: int = 10) -> list[dict]:
    return store.latest_inspections(min(limit, 50))


# ── cameras ──────────────────────────────────────────────────────────
class CameraIn(BaseModel):
    name: str = Field(max_length=80)
    camera_id: str | None = Field(default=None, max_length=20)
    sector: str | None = Field(default=None, max_length=40)
    type: str | None = Field(default=None, max_length=40)
    location: str | None = Field(default=None, max_length=80)
    stream_url: str | None = Field(default=None, max_length=500, description="rtsp://, http(s):// MJPEG/HLS, or a video file URL")
    video_source: str | None = Field(default=None, max_length=500)


@router.get("/api/cameras")
def cameras() -> list[dict]:
    return store.list_cameras()


@router.post("/api/cameras")
def add_camera(cam: CameraIn) -> dict:
    return store.add_camera(cam.model_dump())


@router.delete("/api/cameras/{key}")
def delete_camera(key: str) -> dict:
    if not store.delete_camera(key):
        raise HTTPException(404, "Camera not found")
    return {"deleted": key}


@router.get("/api/camera-stream/{key}")
def camera_stream(key: str, detect: bool = True, fps: float = 8):
    """MJPEG stream of a real camera (RTSP/HTTP) with rust detection drawn on.

    Use it as <img src=".../api/camera-stream/CAM-05">. Detection runs about once
    a second so a small CPU server can keep up.
    """
    cam = store.get_camera(key)
    if not cam or not cam.get("stream_url"):
        raise HTTPException(404, "Camera has no stream_url")

    def frames():
        cap = cv2.VideoCapture(cam["stream_url"])
        last_detect, result = 0.0, None
        delay = 1 / max(1.0, min(fps, 15))
        try:
            while cap.isOpened():
                ok, frame = cap.read()
                if not ok:
                    time.sleep(0.5)
                    cap.release()
                    cap = cv2.VideoCapture(cam["stream_url"])  # reconnect
                    continue
                h, w = frame.shape[:2]
                if max(h, w) > 960:
                    s = 960 / max(h, w)
                    frame = cv2.resize(frame, (round(w * s), round(h * s)))
                if detect and segmenter.loaded and time.time() - last_detect > 1.0:
                    result, last_detect = segmenter.predict(frame), time.time()
                if result and result["count"] and result["image"]["width"] == frame.shape[1]:
                    frame = segmenter.annotate(frame, result)
                yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + encode_jpeg(frame, 75) + b"\r\n"
                time.sleep(delay)
        finally:
            cap.release()

    return StreamingResponse(frames(), media_type="multipart/x-mixed-replace; boundary=frame")
