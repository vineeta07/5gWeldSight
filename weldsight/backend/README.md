---
title: WeldSight API
emoji: 🔩
colorFrom: gray
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# WeldSight API

One backend for the WeldSight website and the inspection dashboard.

- `POST /api/analyze` photo inspector (rust model + Gemini review)
- `POST /api/detect` rust model on one frame (live feeds)
- `POST /api/video/analyze` video upload analysis
- `POST /api/chat` assistant (Gemini + WeldSight notes + live data)
- `GET/PATCH /api/incidents`, `GET/POST/DELETE /api/cameras`, `GET /api/stats`, `GET /api/camera-stream/{id}`
- `GET /api/health`, interactive docs at `/docs`

## Run locally

    python -m venv .venv && source .venv/bin/activate    # Windows: .venv\Scripts\activate
    pip install -r requirements.txt
    cp .env.example .env                                 # add your Gemini key
    # put rust_seg_unity.onnx in model/
    python -m tests.smoke_test                           # checks the model works
    uvicorn app.main:app --reload --port 8000

## Knowledge

The assistant's project knowledge lives in `knowledge/*.md`. Each `# Heading` is one searchable section.
Edit the files and restart to update what it knows.
