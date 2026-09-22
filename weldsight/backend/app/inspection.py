"""
Inspection logic used by the API routes.

- analyze_photo: rust model + (optional) Gemini visual review of weld defects.
- analyze_video: rust model on frames sampled across a video + written summary.
- detect_frame:  rust model only, for live feeds (fast path).

Every inspection is added to the shared store, and findings become defect
reports, so the website and the dashboard see the same data.
"""
from __future__ import annotations

import base64
import json
import logging

import cv2
import numpy as np

from . import config
from .agent import agent
from .model import decode_image, encode_jpeg, public, segmenter
from .store import store

log = logging.getLogger("weldsight.inspection")

RISK_TO_STATUS = {"LOW": "GREEN", "MEDIUM": "AMBER", "HIGH": "RED", "CRITICAL": "RED"}
STATUS_RANK = {"GREEN": 0, "AMBER": 1, "RED": 2}


def _data_url(img: np.ndarray, max_side: int = 640, quality: int = 72) -> str:
    h, w = img.shape[:2]
    s = min(1.0, max_side / max(h, w))
    if s < 1:
        img = cv2.resize(img, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    return "data:image/jpeg;base64," + base64.b64encode(encode_jpeg(img, quality)).decode()


def _rust_sentence(r: dict) -> str:
    if r["count"] == 0:
        return "The rust model found no rust or corrosion."
    areas = "area" if r["count"] == 1 else "areas"
    return (f"The rust model found {r['count']} {areas} of rust covering {r['coverage_pct']}% of the image "
            f"(highest confidence {r['max_score']:.0%}).")


# ── Gemini visual review ─────────────────────────────────────────────
REVIEW_PROMPT = """You are an experienced visual weld inspector. Look at the photo.

1. Decide whether it shows a weld or welded metal. If not, set is_weld=false, score=0,
   status="AMBER", defects=[], and use summary to say briefly what the photo shows and
   how to take a better one (close-up of the weld, good light). action can be empty.
2. If it does, list visible defects (porosity, cracks, undercut, overlap, lack of fusion,
   incomplete penetration, spatter, burn-through, irregular bead, rust/corrosion) with
   severity (minor, moderate or severe) and where they are in the image.
3. Give a 0-100 quality score and a status: GREEN acceptable (about 75-100),
   AMBER needs review (45-74), RED reject or repair (0-44). Any visible crack means RED.
4. summary: two plain sentences connecting the findings and their likely cause.
   Don't start with "This weld" or "Based on".
5. action: one clear instruction for the welder or inspector.

An automatic rust segmentation model has already checked this photo:
{rust}
Treat it as a second opinion: it can confuse other orange or brown surfaces with rust.
Only report what you can see. If the image quality limits the assessment, say so."""


def gemini_review(img: np.ndarray, rust: dict) -> dict | None:
    if not agent.configured:
        return None
    try:
        from google.genai import types

        schema = types.Schema(
            type="OBJECT",
            required=["is_weld", "score", "status", "defects", "summary", "action"],
            properties={
                "is_weld": types.Schema(type="BOOLEAN"),
                "score": types.Schema(type="INTEGER"),
                "status": types.Schema(type="STRING", enum=["GREEN", "AMBER", "RED"]),
                "defects": types.Schema(type="ARRAY", items=types.Schema(
                    type="OBJECT", required=["type", "severity", "location"],
                    properties={
                        "type": types.Schema(type="STRING"),
                        "severity": types.Schema(type="STRING", enum=["minor", "moderate", "severe"]),
                        "location": types.Schema(type="STRING"),
                    })),
                "summary": types.Schema(type="STRING"),
                "action": types.Schema(type="STRING"),
            },
        )
        cfg = dict(system_instruction=REVIEW_PROMPT.format(rust=_rust_sentence(rust)), temperature=0.2,
                   response_mime_type="application/json", response_schema=schema)
        if "flash" in config.GEMINI_MODEL:
            cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        resp = agent.client.models.generate_content(
            model=config.GEMINI_MODEL,
            contents=[types.Part.from_bytes(data=encode_jpeg(img, 85), mime_type="image/jpeg"), "Inspect this photo and return the report."],
            config=types.GenerateContentConfig(**cfg),
        )
        data = json.loads(resp.text)
        data["score"] = int(max(0, min(100, data.get("score", 0))))
        return data
    except Exception:
        log.exception("Gemini review failed; using the model-only report")
        return None


def model_only_review(rust: dict) -> dict:
    """Report built from the rust model alone (used when Gemini isn't available)."""
    status = "GREEN" if rust["count"] == 0 else RISK_TO_STATUS[rust["risk_level"]]
    raw = 100 if rust["count"] == 0 else round(100 - min(90, rust["coverage_pct"] * 2.2) - 4 * rust["count"])
    lo, hi = {"GREEN": (75, 100), "AMBER": (45, 74), "RED": (5, 44)}[status]
    score = max(lo, min(hi, raw))  # keep the score inside the band its status stands for
    defects = [{"type": "rust / corrosion", "severity": {"LOW": "minor", "MEDIUM": "moderate"}.get(rust["risk_level"], "severe"),
                "location": f"{d['area_pct']}% of the image, confidence {d['score']:.0%}"} for d in rust["detections"][:5]]
    if rust["count"] == 0:
        summary = "No rust or corrosion was found in this photo. The rust model does not check for other weld defects such as porosity or cracks."
        action = "No rust-related action needed. Have other defect types checked visually."
    else:
        summary = f"{_rust_sentence(rust)} Rust near a weld can cause porosity during welding and weakens finished joints over time."
        action = {"GREEN": "Note it and recheck at the next inspection.", "AMBER": "Clean the area back to bright metal and recheck.",
                  "RED": "Stop and have a qualified inspector assess the affected area before further work."}[status]
    return {"is_weld": True, "score": score, "status": status, "defects": defects, "summary": summary, "action": action}


def _merge(rust: dict, review: dict) -> dict:
    """Make sure the model's rust findings are reflected in the final report."""
    if not review.get("is_weld", True) or rust["count"] == 0:
        return review
    has_rust = any("rust" in d.get("type", "").lower() or "corros" in d.get("type", "").lower() for d in review["defects"])
    if not has_rust:
        review["defects"].append({"type": "rust / corrosion (model)",
                                  "severity": {"LOW": "minor", "MEDIUM": "moderate"}.get(rust["risk_level"], "severe"),
                                  "location": f"{rust['coverage_pct']}% of the image"})
    model_status = RISK_TO_STATUS[rust["risk_level"]]
    if STATUS_RANK[model_status] > STATUS_RANK.get(review["status"], 0):
        review["status"] = model_status
        review["score"] = min(review["score"], {"AMBER": 74, "RED": 44}[model_status])
    return review


# ── public entry points ─────────────────────────────────────────────
def analyze_photo(data: bytes, source: str = "website", record: bool = True) -> dict:
    img = decode_image(data)
    rust = segmenter.predict(img)
    annotated = segmenter.annotate(img, rust) if rust["count"] else img
    review = gemini_review(img, rust)
    engine = "model+gemini" if review else "model"
    report = _merge(rust, review) if review else model_only_review(rust)

    code = None
    if record and report.get("is_weld", True) and (rust["count"] or report["status"] != "GREEN"):
        risk = {"GREEN": "LOW", "AMBER": "MEDIUM", "RED": "HIGH"}[report["status"]]
        if rust["risk_level"] == "CRITICAL":
            risk = "CRITICAL"
        kind = report["defects"][0]["type"].capitalize() if report["defects"] else "Rust / corrosion"
        inc = store.add_incident(
            camera_id="WEB", camera_name="Website photo inspector", sector="Public", kind=kind,
            object_type="rust" if rust["count"] else "weld_defect", confidence=rust["max_score"] or report["score"] / 100,
            risk=risk, reasons=[report["summary"], report["action"], _rust_sentence(rust)], source=source,
            coverage_pct=rust["coverage_pct"], image_jpeg=encode_jpeg(annotated, 80), thumb_b64=_data_url(annotated, 480),
        )
        code = inc["incident_code"]

    store.add_inspection({"kind": "photo", "source": source, "engine": engine, "score": report["score"], "status": report["status"],
                          "defects": [d["type"] for d in report["defects"]], "rust_coverage_pct": rust["coverage_pct"],
                          "rust_areas": rust["count"], "summary": report["summary"], "report_code": code})
    return {**report, "engine": engine, "report_code": code, "rust": public(rust), "annotated_image": _data_url(annotated, 1024, 80)}


def detect_frame(data: bytes, camera_id: str | None = None, threshold: float | None = None, record: bool = False, annotate: bool = False) -> dict:
    img = decode_image(data, max_side=960)
    rust = segmenter.predict(img, threshold=threshold)
    out = public(rust)
    if annotate:
        out["annotated_image"] = _data_url(segmenter.annotate(img, rust), 960, 75)
    cam = store.get_camera(camera_id) if camera_id else None
    if record and cam and rust["count"] and rust["risk_level"] in ("MEDIUM", "HIGH", "CRITICAL") and store.auto_incident_allowed(cam["camera_id"]):
        ann = segmenter.annotate(img, rust)
        inc = store.add_incident(
            camera_id=cam["camera_id"], camera_name=cam["name"], sector=cam["sector"], kind="Rust / corrosion", object_type="rust",
            confidence=rust["max_score"], risk=rust["risk_level"], reasons=[_rust_sentence(rust), "Found on the live feed"],
            source="camera", coverage_pct=rust["coverage_pct"], image_jpeg=encode_jpeg(ann, 80), thumb_b64=_data_url(ann, 480),
        )
        out["report_code"] = inc["incident_code"]
    return out


def analyze_video(path: str, filename: str, samples: int = config.VIDEO_SAMPLE_FRAMES) -> dict:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        raise ValueError("Could not open the video. Use MP4, MOV, AVI or WebM.")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    duration = total / fps if total else 0
    if total <= 0:
        raise ValueError("The video has no readable frames.")

    idxs = np.linspace(total * 0.02, total * 0.98 - 1, num=min(samples, total)).astype(int)
    timeline, frames = [], []
    for i in idxs:
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(i))
        ok, frame = cap.read()
        if not ok:
            continue
        h, w = frame.shape[:2]
        s = min(1.0, 960 / max(h, w))
        if s < 1:
            frame = cv2.resize(frame, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
        r = segmenter.predict(frame)
        t = round(float(i) / fps, 2)
        timeline.append({"t": t, "count": r["count"], "coverage_pct": r["coverage_pct"], "max_score": r["max_score"], "risk_level": r["risk_level"]})
        frames.append((r["coverage_pct"], t, frame, r))
    cap.release()
    if not timeline:
        raise ValueError("Could not read frames from the video.")

    hit = [x for x in timeline if x["count"]]
    peak = max(timeline, key=lambda x: x["coverage_pct"])
    top = sorted(frames, key=lambda f: -f[0])[:4] if hit else frames[:: max(1, len(frames) // 4)][:4]
    keyframes = [{"t": t, "coverage_pct": cov, "count": r["count"], "image": _data_url(segmenter.annotate(fr, r) if r["count"] else fr, 640, 70)}
                 for cov, t, fr, r in sorted(top, key=lambda f: f[1])]
    risk = peak["risk_level"] if hit else "LOW"
    stats = {"frames_checked": len(timeline), "frames_with_rust": len(hit), "peak_coverage_pct": peak["coverage_pct"],
             "peak_time_s": peak["t"], "duration_s": round(duration, 1), "risk_level": risk}
    summary = _video_summary(filename, stats, [f[2] for f in top[:3]])

    code = None
    if hit:
        best = max(frames, key=lambda f: f[0])
        ann = segmenter.annotate(best[2], best[3])
        inc = store.add_incident(
            camera_id="UPLOAD", camera_name=f"Video upload: {filename[:40]}", sector="Uploads", kind="Rust / corrosion", object_type="rust",
            confidence=max(x["max_score"] for x in hit), risk=risk,
            reasons=[f"Rust in {len(hit)} of {len(timeline)} sampled frames", f"Peak coverage {peak['coverage_pct']}% at {peak['t']}s", summary],
            source="video", coverage_pct=peak["coverage_pct"], image_jpeg=encode_jpeg(ann, 80), thumb_b64=_data_url(ann, 480),
        )
        code = inc["incident_code"]
    store.add_inspection({"kind": "video", "source": "dashboard", "file": filename, **stats, "summary": summary, "report_code": code})
    return {"file": filename, **stats, "summary": summary, "timeline": timeline, "keyframes": keyframes, "report_code": code,
            "engine": "model+gemini" if agent.configured else "model"}


def _video_summary(filename: str, stats: dict, frames: list[np.ndarray]) -> str:
    base = (f"Checked {stats['frames_checked']} frames across {stats['duration_s']} s. "
            + (f"Rust appeared in {stats['frames_with_rust']} of them, peaking at {stats['peak_coverage_pct']}% of the frame "
               f"around {stats['peak_time_s']} s (risk: {stats['risk_level'].lower()})."
               if stats["frames_with_rust"] else "The rust model found no rust or corrosion."))
    if not agent.configured:
        return base
    try:
        from google.genai import types

        parts = [types.Part.from_bytes(data=encode_jpeg(f, 75), mime_type="image/jpeg") for f in frames]
        prompt = (f"These are frames from a weld inspection video ({filename}). Automatic rust model results: {json.dumps(stats)}. "
                  "In 3-4 plain sentences, describe what the video shows (setting, weld or metal, any visible defects) and "
                  "whether the rust result looks plausible. No hype, no lists, don't invent measurements.")
        cfg = dict(temperature=0.3, max_output_tokens=400)
        if "flash" in config.GEMINI_MODEL:
            cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
        resp = agent.client.models.generate_content(model=config.GEMINI_MODEL, contents=parts + [prompt], config=types.GenerateContentConfig(**cfg))
        text = (resp.text or "").strip()
        return f"{base} {text}" if text else base
    except Exception:
        log.exception("Gemini video summary failed")
        return base
