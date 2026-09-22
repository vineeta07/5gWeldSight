"""
WeldSight assistant: Gemini with tools.

Flow for each message:
  1. Build a system prompt: who the assistant is, core facts, which app and
     page the user is on, and any page context (e.g. the analysis on screen).
  2. Give Gemini tools to search the WeldSight notes and read live data.
     The google-genai SDK runs the tool calls automatically and returns the
     final answer.
  3. Return the answer with the notes it used as sources.

If Gemini isn't configured or the call fails, we answer from the notes and
the database directly, so the chat never just breaks.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import datetime

from . import config
from .knowledge import kb
from .model import segmenter
from .store import store

log = logging.getLogger("weldsight.agent")

CORE_FACTS = """\
- WeldSight is a 5G-connected weld inspection system built by students at Delhi Technological University (DTU), New Delhi.
- A portable camera unit (Raspberry Pi, 5G modem with four antennas, pan-tilt camera, 3D-printed chassis, battery base) streams weld video over 5G.
- A vision model (rust_seg_unity.onnx, RF-DETR-style segmentation) finds rust/corrosion and outlines it; it does not detect other weld defects by itself.
- Inspectors review results in the web dashboard or in VR (Unity). The public website has a photo inspector and links to the dashboard.
- Both apps share one backend, so website inspections appear in the dashboard's defect reports."""

APP_BRIEF = {
    "website": "The user is a visitor on the public WeldSight website (students, judges, industry people). Explain clearly and briefly; avoid jargon unless asked.",
    "dashboard": "The user is an inspector using the WeldSight dashboard. Be precise and practical. Use the data tools for anything about reports, cameras or inspections.",
}

RULES = """\
How to answer:
- For facts about WeldSight (hardware, model, pages, team, exhibition), call search_weldsight_docs first. For live data (defect reports, cameras, stats, latest inspections, model settings), call the matching tool. Never make up numbers, report codes, results or specifications.
- If the notes and tools don't cover it, say you don't know rather than guessing. You may use general welding knowledge, and say when you are doing so.
- Write plainly, like a knowledgeable colleague. Short paragraphs, no hype, no emojis. Use a short list only when it genuinely helps.
- Keep answers under about 150 words unless the user asks for detail.
- WeldSight results are a screening aid. When asked whether to accept or reject a weld, say the final decision belongs to a qualified inspector using the applicable standard.
- Refer to report codes (e.g. DEF-2026-0004) and camera IDs exactly as the tools return them.
- Politely decline requests unrelated to WeldSight, welding, inspection, 5G streaming or the project's technology.
- Reply in the same language the user writes in."""

DATA_WORDS = re.compile(r"\b(reports?|defects?|incidents?|critical|open|cameras?|online)\b", re.I)


def _trim(obj, limit: int = 3500) -> str:
    s = json.dumps(obj, ensure_ascii=False, default=str)
    return s if len(s) <= limit else s[:limit] + "…"


def _compact_report(r: dict) -> dict:
    return {
        "code": r["incident_code"], "camera": r["camera_id"], "camera_name": r.get("camera_name"), "type": r["threat_type"],
        "risk": r["risk_level"], "status": r["status"], "confidence_pct": r["confidence"], "time": r["timestamp"],
        "source": r.get("source"), "coverage_pct": r.get("coverage_pct"),
    }


class WeldSightAgent:
    def __init__(self):
        self.client = None
        if config.GEMINI_API_KEY:
            try:
                from google import genai

                self.client = genai.Client(api_key=config.GEMINI_API_KEY)
            except Exception:
                log.exception("Could not create Gemini client")

    @property
    def configured(self) -> bool:
        return self.client is not None

    # ── tools (docstrings and type hints become the tool descriptions) ─
    def _make_tools(self, trace: dict):
        def search_weldsight_docs(query: str) -> dict:
            """Search the WeldSight project notes: hardware, how it works, the vision model and its limits,
            weld defects with causes and fixes, dashboard pages, the website, the team and the exhibition.

            Args:
                query: What to look for, in a few keywords, e.g. "pan tilt camera" or "porosity causes".
            """
            hits = kb.search(query, k=4)
            known = {s["id"] for s in trace["sources"]}
            for h in hits:
                if h["id"] not in known:
                    trace["sources"].append({"id": h["id"], "title": h["title"], "source": h["source"]})
            trace["tools"].append("search_weldsight_docs")
            return {"results": [{"title": h["title"], "text": h["text"][:1800]} for h in hits] or "No matching notes."}

        def list_defect_reports(status: str = "", risk_level: str = "", camera_id: str = "", limit: int = 10) -> dict:
            """List defect reports, newest first.

            Args:
                status: Optional filter: NEW, ACKNOWLEDGED, INVESTIGATING, RESOLVED or FALSE_POSITIVE.
                risk_level: Optional filter: LOW, MEDIUM, HIGH or CRITICAL.
                camera_id: Optional filter, e.g. CAM-01.
                limit: How many to return (max 25).
            """
            trace["tools"].append("list_defect_reports")
            rows = store.list_incidents(status or None, risk_level or None, camera_id or None, min(int(limit or 10), 25))
            return {"count": len(rows), "reports": [_compact_report(r) for r in rows]}

        def get_defect_report(incident_code: str) -> dict:
            """Get the full details of one defect report, including reasons, notes and timeline.

            Args:
                incident_code: The report code, e.g. DEF-2026-0004 or WEB-2026-0007.
            """
            trace["tools"].append("get_defect_report")
            r = store.get_incident(incident_code.strip())
            if not r:
                return {"error": f"No report called {incident_code}"}
            r.pop("image", None)
            return r

        def get_camera_status() -> dict:
            """List all cameras with their status, location and whether rust detection is on."""
            trace["tools"].append("get_camera_status")
            return {"cameras": [
                {k: c[k] for k in ("camera_id", "name", "sector", "type", "location", "status", "detection_enabled")}
                for c in store.list_cameras()
            ]}

        def get_overview_stats() -> dict:
            """Get overview numbers: cameras online, open reports, critical reports, counts by risk, status and camera."""
            trace["tools"].append("get_overview_stats")
            return store.stats()

        def get_latest_inspections(limit: int = 3) -> dict:
            """Get the most recent inspections from the website photo inspector, dashboard video uploads and live feeds.

            Args:
                limit: How many to return (max 10).
            """
            trace["tools"].append("get_latest_inspections")
            return {"inspections": store.latest_inspections(min(int(limit or 3), 10))}

        def get_model_info() -> dict:
            """Get details of the rust segmentation model: name, input size, confidence threshold, whether it is loaded,
            and the rules used to turn its output into risk levels."""
            trace["tools"].append("get_model_info")
            return {
                **segmenter.info(),
                "risk_rules": "CRITICAL >=30% coverage; HIGH >=12% coverage or >=90% confidence with >=5% coverage; "
                              "MEDIUM >=3% coverage; otherwise LOW. Team-chosen starting points, not a standard.",
            }

        return [search_weldsight_docs, list_defect_reports, get_defect_report, get_camera_status,
                get_overview_stats, get_latest_inspections, get_model_info]

    # ── prompt ─────────────────────────────────────────────────────────
    def _system_prompt(self, app: str, page: str | None, context) -> str:
        parts = [
            "You are the WeldSight assistant, built into the WeldSight website and inspection dashboard.",
            f"Today is {datetime.now().strftime('%d %B %Y')}.",
            "Core facts:\n" + CORE_FACTS,
            APP_BRIEF.get(app, APP_BRIEF["website"]),
        ]
        if page:
            parts.append(f"The user is currently on this page: {page}.")
        if context:
            parts.append("What the user is looking at right now (JSON from the app; use it to answer questions about 'this', "
                         "'the result' or 'this video'):\n" + _trim(context))
        links = []
        if config.SITE_URL:
            links.append(f"website: {config.SITE_URL}")
        if config.DASHBOARD_URL:
            links.append(f"dashboard: {config.DASHBOARD_URL}")
        if links:
            parts.append("Links you may share: " + ", ".join(links))
        parts.append(RULES)
        return "\n\n".join(parts)

    # ── main entry ─────────────────────────────────────────────────────
    def reply(self, messages: list[dict], app: str = "website", page: str | None = None, context=None) -> dict:
        messages = [m for m in messages if m.get("content", "").strip()][-16:]
        if not messages or messages[-1]["role"] != "user":
            return {"reply": "Ask me anything about WeldSight.", "sources": [], "tools_used": [], "mode": "none"}
        if not self.configured:
            return self._offline(messages[-1]["content"], "The Gemini API key isn't set on the server.")

        from google.genai import types

        trace = {"sources": [], "tools": []}
        contents = [
            types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"][:4000])])
            for m in messages
        ]
        cfg = dict(
            system_instruction=self._system_prompt(app, page, context),
            tools=self._make_tools(trace),
            temperature=0.3,
            max_output_tokens=1500,
            automatic_function_calling=types.AutomaticFunctionCallingConfig(maximum_remote_calls=6),
        )
        if "flash" in config.GEMINI_MODEL:
            cfg["thinking_config"] = types.ThinkingConfig(thinking_budget=0)  # faster, cheaper answers
        try:
            try:
                resp = self.client.models.generate_content(model=config.GEMINI_MODEL, contents=contents, config=types.GenerateContentConfig(**cfg))
            except Exception as e:
                if "thinking" in str(e).lower() and "thinking_config" in cfg:
                    cfg.pop("thinking_config")
                    resp = self.client.models.generate_content(model=config.GEMINI_MODEL, contents=contents, config=types.GenerateContentConfig(**cfg))
                else:
                    raise
            text = (resp.text or "").strip()
            if not text:
                raise RuntimeError("Empty response from Gemini")
            return {"reply": text, "sources": trace["sources"], "tools_used": sorted(set(trace["tools"])), "mode": "gemini"}
        except Exception as e:
            log.exception("Gemini chat failed")
            return self._offline(messages[-1]["content"], f"The AI service didn't respond ({type(e).__name__}).")

    def _offline(self, question: str, reason: str) -> dict:
        """Answer without Gemini: numbers from the database, or the closest note."""
        if DATA_WORDS.search(question):
            s = store.stats()
            text = (f"Right now there are {s['open_reports']} open defect reports, {s['critical_open']} of them critical, "
                    f"and {s['cameras_online']} of {s['cameras_total']} cameras are online.\n\n"
                    f"({reason} This answer comes straight from the database.)")
            return {"reply": text, "sources": [], "tools_used": [], "mode": "offline"}

        hits = kb.search(question, k=1)
        if hits:
            h = hits[0]
            body = re.sub(r"\*\*|__|`", "", re.sub(r"\s+", " ", h["text"]))[:700]
            text = f"{reason} Here is the closest match from the WeldSight notes.\n\n{h['title']}: {body}"
            sources = [{"id": h["id"], "title": h["title"], "source": h["source"]}]
        else:
            text = f"{reason} I couldn't find this in the WeldSight notes either."
            sources = []
        return {"reply": text, "sources": sources, "tools_used": [], "mode": "offline"}


agent = WeldSightAgent()
