# WeldSight

5G-connected weld inspection, built at Delhi Technological University.

```
               ┌──────────────────────────┐
  website  ───►│                          │◄─── dashboard
 (Vercel)      │  backend (Hugging Face)  │     (Vercel)
               │  · rust segmentation     │
               │  · Gemini assistant      │
               │  · defect reports        │
               └──────────────────────────┘
```

Both apps use the same backend, so a photo checked on the website appears in the dashboard's defect reports, and the assistant in either app sees the same data.

| Folder | What |
|---|---|
| `backend/` | FastAPI: `rust_seg_unity.onnx` model, Gemini agent with tools, reports, cameras, streams |
| `backend/knowledge/` | What the assistant knows about WeldSight (Markdown, edit freely) |
| `website/` | Project website (React, Three.js, GSAP) with the photo inspector and assistant |
| `dashboard/` | Inspection dashboard (React, TypeScript, Tailwind) |
| `extras/` | Optional Hyperledger chain gateway and chaincode from the earlier project (not deployed) |

## Run locally

You need Python 3.11+, Node 20+, and the model file.

```bash
# 1. backend  (http://localhost:8000/docs)
cd backend
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # add GEMINI_API_KEY
cp /path/to/rust_seg_unity.onnx model/
python -m tests.smoke_test                             # should print PASS
uvicorn app.main:app --reload --port 8000

# 2. website  (http://localhost:5173), in a new terminal
cd website && npm install && npm run dev

# 3. dashboard  (http://localhost:8443), in a new terminal
cd dashboard && npm install && npm run dev
```

In local dev both frontends forward `/api` to `localhost:8000`, so no URLs need setting.

## Deploy

See **[DEPLOY.md](DEPLOY.md)**.

## About the model

`rust_seg_unity.onnx` is an RF-DETR-style segmentation model that outlines rust and corrosion. It takes a 384×384 RGB image with values from 0 to 1; ImageNet normalisation is built into the graph, so don't normalise again. Findings below 70% confidence are ignored by default (`DETECTION_THRESHOLD`). In testing, real rust scored above 90%. Orange cables and skin sometimes scored 50–73%, so more "not rust" training images would help. It only detects rust; the photo inspector uses Gemini for other defect types.
