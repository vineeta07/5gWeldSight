"""
Shared data for both apps: cameras, defect reports and recent inspections.

Kept in memory and saved to DATA_DIR/store.json after each change. On free
hosting the disk is wiped on restart, so the demo data is re-seeded then.
For production, swap this class for a real database (Postgres/Supabase);
the rest of the backend only uses the methods below.
"""
from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from datetime import datetime, timedelta, timezone

from . import config

log = logging.getLogger("weldsight.store")

STATUSES = {"NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"}
RISK_SCORE = {"LOW": 25, "MEDIUM": 50, "HIGH": 75, "CRITICAL": 92}


def now_iso(minutes_ago: float = 0) -> str:
    return (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat(timespec="seconds")


def _seed_cameras() -> list[dict]:
    feeds = "/weldsight-inspection-feeds"
    rows = [
        ("CAM-01", "Weld bay 1: main seam", "Bay A", "RGB", "Main welding bay", f"{feeds}/cam01_weld_bay_live_arc.mp4", "ONLINE", 30, "1280x720"),
        ("CAM-02", "Seam scanner", "Bay B", "RGB macro", "Post-weld inspection", f"{feeds}/cam02_seam_scanner.mp4", "ONLINE", 30, "1280x720"),
        ("CAM-03", "Thermal camera", "Bay A", "Thermal", "Cooling profile", f"{feeds}/cam03_thermal_cooling.mp4", "ONLINE", 30, "1280x720"),
        ("CAM-04", "Pipeline P-12 crawler", "Yard", "RGB", "Girth weld crawler", f"{feeds}/cam04_pipeline_girth_weld.mp4", "ONLINE", 30, "1280x720"),
        ("CAM-05", "WeldSight prototype", "Lab", "RGB (5G)", "Prototype camera unit", "", "OFFLINE", 0, "-"),
    ]
    return [
        {
            "id": str(i + 1), "camera_id": cid, "name": name, "sector": sector, "type": typ, "location": loc,
            "video_source": src, "stream_url": "", "status": status, "fps": fps, "resolution": res,
            "detection_enabled": status == "ONLINE", "last_heartbeat": now_iso(0 if status == "ONLINE" else 600),
            "lat": 28.75, "lng": 77.11 + i * 0.01,
        }
        for i, (cid, name, sector, typ, loc, src, status, fps, res) in enumerate(rows)
    ]


def _seed_incidents() -> list[dict]:
    """Demo reports that match the simulated camera feeds."""
    seeds = [
        ("CAM-02", "Seam scanner", "Bay B", "crack", "D-102", 95, "Transverse crack", "CRITICAL", "NEW", 6,
         ["Crack running across the weld bead", "Cracks are rejectable at every quality level"], "camera"),
        ("CAM-04", "Pipeline P-12 crawler", "Yard", "burn_through", "D-301", 94, "Burn-through", "CRITICAL", "ACKNOWLEDGED", 14,
         ["Hole through the root at the 6 o'clock position", "Pressure test should wait until repaired"], "camera"),
        ("CAM-01", "Weld bay 1: main seam", "Bay A", "porosity", "D-001", 91, "Porosity", "HIGH", "INVESTIGATING", 25,
         ["Cluster of gas pores in the bead", "Check shielding gas flow and nozzle"], "camera"),
        ("CAM-03", "Thermal camera", "Bay A", "heat_anomaly", "D-201", 82, "Uneven cooling", "HIGH", "NEW", 31,
         ["One section cooled about three times faster than its neighbours", "Possible lack of fusion; check with UT"], "camera"),
        ("CAM-04", "Pipeline P-12 crawler", "Yard", "rust", "D-302", 93, "External corrosion", "MEDIUM", "NEW", 40,
         ["Corrosion patch about 12 mm from the weld toe", "Found by the rust model"], "camera"),
        ("CAM-01", "Weld bay 1: main seam", "Bay A", "undercut", "D-002", 84, "Undercut", "MEDIUM", "RESOLVED", 55,
         ["Groove along the top toe, about 9 mm long", "Repair pass added and re-inspected"], "camera"),
    ]
    out = []
    for n, (cam, cname, sector, obj, track, conf, kind, risk, status, mins, reasons, source) in enumerate(seeds):
        code = f"DEF-2026-{len(seeds) - n:04d}"
        ts = now_iso(mins)
        out.append({
            "id": code.lower(), "incident_code": code, "camera_id": cam, "camera_name": cname, "sector": sector,
            "timestamp": ts, "created_at": ts, "object_type": obj, "tracking_id": track, "confidence": conf,
            "threat_type": kind, "risk_score": RISK_SCORE[risk], "risk_level": risk, "status": status,
            "operator": "", "notes": "", "ai_reasons": reasons, "source": source, "coverage_pct": None,
            "evidence_hash": hashlib.sha256(f"{code}|{cam}|{ts}|{kind}".encode()).hexdigest(),
            "image": None,
            "timeline": [{"time": ts, "event": f"{kind} found by {cam}", "status": "done"}],
        })
    return out


class Store:
    def __init__(self):
        self._lock = threading.RLock()
        self.path = config.DATA_DIR / "store.json"
        self.cameras: list[dict] = []
        self.incidents: list[dict] = []
        self.inspections: list[dict] = []  # latest analyses from any app, newest first
        self.started = time.time()
        self._last_auto: dict[str, float] = {}
        self._load()

    # ── persistence ───────────────────────────────────────────────────
    def _load(self) -> None:
        try:
            data = json.loads(self.path.read_text())
            self.cameras, self.incidents = data["cameras"], data["incidents"]
            self.inspections = data.get("inspections", [])
            log.info("Loaded %d reports from %s", len(self.incidents), self.path)
        except Exception:
            self.cameras, self.incidents, self.inspections = _seed_cameras(), _seed_incidents(), []

    def _save(self) -> None:
        try:
            config.DATA_DIR.mkdir(parents=True, exist_ok=True)
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps({"cameras": self.cameras, "incidents": self.incidents[:300], "inspections": self.inspections[:50]}))
            tmp.replace(self.path)
        except Exception as e:
            log.warning("Could not save store: %s", e)

    # ── cameras ───────────────────────────────────────────────────────
    def list_cameras(self) -> list[dict]:
        with self._lock:
            return [dict(c) for c in self.cameras]

    def get_camera(self, key: str) -> dict | None:
        with self._lock:
            return next((dict(c) for c in self.cameras if key in (c["id"], c["camera_id"])), None)

    def add_camera(self, data: dict) -> dict:
        with self._lock:
            n = max([int(c["id"]) for c in self.cameras if c["id"].isdigit()] + [0]) + 1
            cam = {
                "id": str(n), "camera_id": data.get("camera_id") or f"CAM-{n:02d}", "name": data.get("name") or f"Camera {n}",
                "sector": data.get("sector") or "Unassigned", "type": data.get("type") or "RGB", "location": data.get("location") or "",
                "video_source": data.get("video_source") or "", "stream_url": data.get("stream_url") or "",
                "status": "ONLINE" if (data.get("stream_url") or data.get("video_source")) else "OFFLINE",
                "fps": 0, "resolution": "-", "detection_enabled": True, "last_heartbeat": now_iso(), "lat": 28.75, "lng": 77.11,
            }
            self.cameras.append(cam)
            self._save()
            return dict(cam)

    def delete_camera(self, key: str) -> bool:
        with self._lock:
            before = len(self.cameras)
            self.cameras = [c for c in self.cameras if key not in (c["id"], c["camera_id"])]
            self._save()
            return len(self.cameras) < before

    # ── defect reports ────────────────────────────────────────────────
    def list_incidents(self, status: str | None = None, risk: str | None = None, camera: str | None = None, limit: int = 100) -> list[dict]:
        with self._lock:
            rows = self.incidents
            if status:
                rows = [r for r in rows if r["status"] == status.upper()]
            if risk:
                rows = [r for r in rows if r["risk_level"] == risk.upper()]
            if camera:
                rows = [r for r in rows if r["camera_id"] == camera.upper()]
            return [dict(r) for r in rows[:limit]]

    def get_incident(self, code: str) -> dict | None:
        with self._lock:
            return next((dict(r) for r in self.incidents if code.lower() in (r["id"], r["incident_code"].lower())), None)

    def update_incident(self, code: str, status: str | None = None, notes: str | None = None, operator: str | None = None) -> dict | None:
        with self._lock:
            for r in self.incidents:
                if code.lower() in (r["id"], r["incident_code"].lower()):
                    if status:
                        status = status.upper()
                        if status not in STATUSES:
                            raise ValueError(f"Status must be one of {sorted(STATUSES)}")
                        r["status"] = status
                        r["timeline"].append({"time": now_iso(), "event": f"Status changed to {status.replace('_', ' ').lower()}", "status": "done"})
                    if notes is not None:
                        r["notes"] = notes[:2000]
                    if operator:
                        r["operator"] = operator[:80]
                    self._save()
                    return dict(r)
        return None

    def add_incident(self, *, camera_id: str, camera_name: str, sector: str, kind: str, object_type: str, confidence: float,
                     risk: str, reasons: list[str], source: str, coverage_pct: float | None = None,
                     image_jpeg: bytes | None = None, thumb_b64: str | None = None) -> dict:
        with self._lock:
            n = len(self.incidents) + 1
            prefix = {"website": "WEB", "video": "VID"}.get(source, "DEF")
            code = f"{prefix}-{datetime.now().year}-{n:04d}"
            ts = now_iso()
            digest = hashlib.sha256((image_jpeg or b"") + f"|{code}|{camera_id}|{ts}|{kind}|{confidence}".encode()).hexdigest()
            inc = {
                "id": code.lower(), "incident_code": code, "camera_id": camera_id, "camera_name": camera_name, "sector": sector,
                "timestamp": ts, "created_at": ts, "object_type": object_type, "tracking_id": f"R-{n:03d}",
                "confidence": round(confidence * 100) if confidence <= 1 else round(confidence),
                "threat_type": kind, "risk_score": RISK_SCORE.get(risk, 25), "risk_level": risk, "status": "NEW",
                "operator": "", "notes": "", "ai_reasons": reasons[:6], "source": source, "coverage_pct": coverage_pct,
                "evidence_hash": digest, "image": thumb_b64,
                "timeline": [{"time": ts, "event": f"Created from {source} inspection", "status": "done"}],
            }
            self.incidents.insert(0, inc)
            self._save()
            return dict(inc)

    def auto_incident_allowed(self, camera_id: str, every_s: float = 90) -> bool:
        """Live feeds send frames every few seconds; only file one report per camera per interval."""
        with self._lock:
            last = self._last_auto.get(camera_id, 0)
            if time.time() - last < every_s:
                return False
            self._last_auto[camera_id] = time.time()
            return True

    # ── inspections (for the assistant's "latest analysis") ──────────
    def add_inspection(self, record: dict) -> None:
        with self._lock:
            self.inspections.insert(0, {"time": now_iso(), **record})
            del self.inspections[50:]
            self._save()

    def latest_inspections(self, limit: int = 3) -> list[dict]:
        with self._lock:
            return [dict(r) for r in self.inspections[:limit]]

    # ── overview numbers ──────────────────────────────────────────────
    def stats(self) -> dict:
        with self._lock:
            open_rows = [r for r in self.incidents if r["status"] not in ("RESOLVED", "FALSE_POSITIVE")]
            today = datetime.now(timezone.utc).date().isoformat()
            return {
                "cameras_online": sum(c["status"] == "ONLINE" for c in self.cameras),
                "cameras_total": len(self.cameras),
                "open_reports": len(open_rows),
                "critical_open": sum(r["risk_level"] == "CRITICAL" for r in open_rows),
                "reports_today": sum(r["timestamp"][:10] == today for r in self.incidents),
                "total_reports": len(self.incidents),
                "by_risk": {k: sum(r["risk_level"] == k for r in self.incidents) for k in RISK_SCORE},
                "by_status": {k: sum(r["status"] == k for r in self.incidents) for k in sorted(STATUSES)},
                "by_camera": {c["camera_id"]: sum(r["camera_id"] == c["camera_id"] for r in self.incidents) for c in self.cameras},
                "avg_confidence": round(sum(r["confidence"] for r in self.incidents) / max(1, len(self.incidents)), 1),
                "uptime_s": round(time.time() - self.started),
            }


store = Store()
