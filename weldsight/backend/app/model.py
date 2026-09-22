"""
Rust segmentation model (rust_seg_unity.onnx).

What the file contains (checked by inspecting the graph):
  input   images  float32 [1, 3, 384, 384]   RGB, values 0..1
  outputs dets    [1, 100, 4]   boxes as (cx, cy, w, h), normalised 0..1
          labels  [1, 100, 2]   class logits; index 0 = rust, index 1 is unused
          masks   [1, 100, 96, 96] mask logits for each box

The graph starts with its own ImageNet mean/std normalisation
(nodes "imagenet_mean" -> "norm_sub" -> "imagenet_std" -> "norm_div"),
so we must NOT normalise again here: just RGB, resize, divide by 255.
The architecture and outputs match an RF-DETR segmentation export.
"""
from __future__ import annotations

import logging
import threading
import time
import urllib.request
from pathlib import Path

import cv2
import numpy as np

from . import config

log = logging.getLogger("weldsight.model")

INPUT_SIZE = 384
CLASS_NAMES = {0: "rust"}  # index 1 never fires in this model


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(x, -50, 50)))


def risk_from_result(coverage_pct: float, max_score: float, count: int) -> str:
    """Turn model output into a risk level.

    These thresholds are a starting point, not a standard. Tune them with
    real inspection data before relying on them.
    """
    if count == 0:
        return "LOW"
    if coverage_pct >= 30:
        return "CRITICAL"
    if coverage_pct >= 12 or (max_score >= 0.9 and coverage_pct >= 5):
        return "HIGH"
    if coverage_pct >= 3:
        return "MEDIUM"
    return "LOW"


class RustSegmenter:
    def __init__(self, path: Path = config.MODEL_PATH, threshold: float = config.DETECTION_THRESHOLD):
        self.path = Path(path)
        self.threshold = threshold
        self.session = None
        self.error: str | None = None
        self._lock = threading.Lock()  # one inference at a time keeps CPU hosts responsive
        self._load_lock = threading.Lock()

    # ── lifecycle ─────────────────────────────────────────────────────
    def ensure_file(self) -> None:
        if self.path.exists() or not config.MODEL_URL:
            return
        log.info("Model file missing, downloading from MODEL_URL ...")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".part")
        urllib.request.urlretrieve(config.MODEL_URL, tmp)
        tmp.rename(self.path)
        log.info("Model downloaded (%.1f MB)", self.path.stat().st_size / 1e6)

    def load(self) -> bool:
        with self._load_lock:
            return self._load()

    def _load(self) -> bool:
        if self.session is not None:
            return True
        try:
            import onnxruntime as ort

            self.ensure_file()
            if not self.path.exists():
                raise FileNotFoundError(f"Model not found at {self.path} (set MODEL_PATH or MODEL_URL)")
            opts = ort.SessionOptions()
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            if config.ORT_THREADS > 0:
                opts.intra_op_num_threads = config.ORT_THREADS
            providers = [p for p in ("CUDAExecutionProvider", "CPUExecutionProvider") if p in ort.get_available_providers()]
            t = time.time()
            self.session = ort.InferenceSession(str(self.path), sess_options=opts, providers=providers)
            self._check_io()
            self.predict(np.full((INPUT_SIZE, INPUT_SIZE, 3), 127, np.uint8))  # warm-up
            log.info("Model loaded in %.1fs using %s", time.time() - t, self.session.get_providers()[0])
            self.error = None
            return True
        except Exception as e:  # keep the API up even if the model can't load
            self.session = None
            self.error = str(e)
            log.exception("Model failed to load")
            return False

    def _check_io(self) -> None:
        ins = {i.name: i.shape for i in self.session.get_inputs()}
        outs = [o.name for o in self.session.get_outputs()]
        if "images" not in ins or outs[:3] != ["dets", "labels", "masks"]:
            raise RuntimeError(f"Unexpected model inputs/outputs: {ins} -> {outs}")

    @property
    def loaded(self) -> bool:
        return self.session is not None

    def info(self) -> dict:
        return {
            "name": self.path.name,
            "loaded": self.loaded,
            "error": self.error,
            "task": "rust / corrosion segmentation",
            "input_size": INPUT_SIZE,
            "classes": list(CLASS_NAMES.values()),
            "threshold": self.threshold,
            "provider": self.session.get_providers()[0] if self.session else None,
        }

    # ── inference ─────────────────────────────────────────────────────
    @staticmethod
    def preprocess(bgr: np.ndarray) -> np.ndarray:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        x = cv2.resize(rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR).astype(np.float32) / 255.0
        return np.ascontiguousarray(x.transpose(2, 0, 1)[None])

    def predict(self, bgr: np.ndarray, threshold: float | None = None, max_detections: int = config.MAX_DETECTIONS) -> dict:
        if self.session is None and not self.load():
            raise RuntimeError(self.error or "Model not loaded")
        thr = self.threshold if threshold is None else float(threshold)
        h, w = bgr.shape[:2]

        t0 = time.perf_counter()
        with self._lock:
            dets, logits, masks = self.session.run(None, {"images": self.preprocess(bgr)})
        infer_ms = (time.perf_counter() - t0) * 1000

        probs = _sigmoid(logits[0])
        cls = probs.argmax(axis=1)
        score = probs.max(axis=1)
        order = [i for i in np.argsort(-score) if score[i] >= thr and int(cls[i]) in CLASS_NAMES][: max_detections * 2]

        detections, kept_masks = [], []
        union = np.zeros((h, w), bool)
        for q in order:
            mask = cv2.resize(_sigmoid(masks[0, q]), (w, h), interpolation=cv2.INTER_LINEAR) > 0.5
            area = int(mask.sum())
            if area < 0.0005 * w * h:  # ignore specks
                continue
            # skip near-duplicate masks (DETR models rarely need this, but it's cheap)
            if any((mask & m).sum() / max(1, (mask | m).sum()) > 0.7 for m in kept_masks):
                continue
            kept_masks.append(mask)
            union |= mask

            cx, cy, bw, bh = dets[0, q]
            x0, y0 = max(0.0, cx - bw / 2), max(0.0, cy - bh / 2)
            x1, y1 = min(1.0, cx + bw / 2), min(1.0, cy + bh / 2)
            detections.append(
                {
                    "id": f"R-{len(detections) + 1:02d}",
                    "label": CLASS_NAMES[int(cls[q])],
                    "score": round(float(score[q]), 3),
                    "box": [round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)],
                    "box_norm": [round(float(v), 4) for v in (x0, y0, x1, y1)],
                    "area_pct": round(100 * area / (w * h), 2),
                    "polygons": self._polygons(mask, w, h),
                }
            )
            if len(detections) >= max_detections:
                break

        coverage = round(100 * float(union.sum()) / (w * h), 2)
        max_score = max((d["score"] for d in detections), default=0.0)
        return {
            "model": self.path.name,
            "threshold": thr,
            "image": {"width": w, "height": h},
            "inference_ms": round(infer_ms, 1),
            "count": len(detections),
            "coverage_pct": coverage,
            "max_score": max_score,
            "risk_level": risk_from_result(coverage, max_score, len(detections)),
            "detections": detections,
            "_masks": kept_masks,  # stripped before sending to clients
        }

    @staticmethod
    def _polygons(mask: np.ndarray, w: int, h: int, max_points: int = 60) -> list:
        """Mask outline as normalised polygons, handy for drawing SVG overlays."""
        s = min(1.0, 320 / max(w, h))
        small = cv2.resize(mask.astype(np.uint8), (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_NEAREST)
        sh, sw = small.shape[:2]
        contours, _ = cv2.findContours(small, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polys = []
        for c in sorted(contours, key=cv2.contourArea, reverse=True)[:3]:
            if cv2.contourArea(c) < 4:
                continue
            eps = 0.004 * cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, eps, True)[:, 0, :]
            if len(approx) > max_points:
                approx = approx[:: int(np.ceil(len(approx) / max_points))]
            polys.append([[round(float(x) / sw, 4), round(float(y) / sh, 4)] for x, y in approx])
        return polys

    @staticmethod
    def annotate(bgr: np.ndarray, result: dict) -> np.ndarray:
        """Draw masks, boxes and scores onto a copy of the image."""
        out = bgr.copy()
        overlay = out.copy()
        for mask in result.get("_masks", []):
            overlay[mask] = (40, 60, 230)
        out = cv2.addWeighted(overlay, 0.45, out, 0.55, 0)
        t = max(1, round(min(out.shape[:2]) / 400))
        for d in result["detections"]:
            x0, y0, x1, y1 = d["box"]
            cv2.rectangle(out, (x0, y0), (x1, y1), (0, 200, 255), 2 * t, cv2.LINE_AA)
            label = f"{d['label']} {d['score']:.0%}"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5 * t, t)
            cv2.rectangle(out, (x0, max(0, y0 - th - 8)), (x0 + tw + 8, y0), (0, 200, 255), -1)
            cv2.putText(out, label, (x0 + 4, y0 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5 * t, (20, 20, 20), t, cv2.LINE_AA)
        return out


def public(result: dict) -> dict:
    """Result without the raw numpy masks (safe to return as JSON)."""
    return {k: v for k, v in result.items() if not k.startswith("_")}


def decode_image(data: bytes, max_side: int = 1280) -> np.ndarray:
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not read the image. Use JPG, PNG or WebP.")
    h, w = img.shape[:2]
    scale = max_side / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def encode_jpeg(img: np.ndarray, quality: int = 85) -> bytes:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("Could not encode image")
    return buf.tobytes()


segmenter = RustSegmenter()
