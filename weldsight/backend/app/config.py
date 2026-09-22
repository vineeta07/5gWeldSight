"""All settings come from environment variables (or a local .env file)."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, default))
    except ValueError:
        return default


def _int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, default))
    except ValueError:
        return default


def _list(name: str) -> list[str]:
    return [v.strip().rstrip("/") for v in os.getenv(name, "").split(",") if v.strip()]


# ── Model ─────────────────────────────────────────────────────────────
MODEL_PATH = Path(os.getenv("MODEL_PATH", BASE_DIR / "model" / "rust_seg_unity.onnx"))
MODEL_URL = os.getenv("MODEL_URL", "")  # optional: download the model at startup if the file is missing
DETECTION_THRESHOLD = _float("DETECTION_THRESHOLD", 0.7)  # real rust scored 0.93+, false positives 0.5-0.73 in testing
MAX_DETECTIONS = _int("MAX_DETECTIONS", 20)
ORT_THREADS = _int("ORT_THREADS", 0)  # 0 = let onnxruntime decide

# ── Gemini ────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# ── Web ───────────────────────────────────────────────────────────────
# Comma-separated list of frontend URLs allowed to call this API,
# e.g. "https://weldsight.vercel.app,https://weldsight-dashboard.vercel.app"
ALLOWED_ORIGINS = _list("ALLOWED_ORIGINS") or [
    "http://localhost:5173",
    "http://localhost:4173",
    "http://localhost:8443",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8443",
]
# Optional regex, e.g. r"https://weldsight-.*\.vercel\.app" to allow Vercel preview deployments
ALLOWED_ORIGIN_REGEX = os.getenv("ALLOWED_ORIGIN_REGEX", "") or None

SITE_URL = os.getenv("SITE_URL", "")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")

# ── Storage ───────────────────────────────────────────────────────────
DATA_DIR = Path(os.getenv("DATA_DIR", BASE_DIR / "data"))
KNOWLEDGE_DIR = Path(os.getenv("KNOWLEDGE_DIR", BASE_DIR / "knowledge"))

# ── Limits ────────────────────────────────────────────────────────────
MAX_IMAGE_MB = _float("MAX_IMAGE_MB", 10)
MAX_VIDEO_MB = _float("MAX_VIDEO_MB", 60)
VIDEO_SAMPLE_FRAMES = _int("VIDEO_SAMPLE_FRAMES", 16)

VERSION = "1.0.0"
