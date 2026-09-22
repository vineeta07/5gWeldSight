# Deploying WeldSight

Three pieces, deployed separately and connected by URLs:

| Piece | What it is | Where | Cost |
|---|---|---|---|
| `backend/` | API: rust model, Gemini assistant, defect reports | Hugging Face Spaces (Docker) | Free (2 CPU, 16 GB RAM) |
| `website/` | Project website + photo inspector | Vercel | Free |
| `dashboard/` | Inspection dashboard | Vercel | Free |

Do them in this order: backend first (you need its URL), then the two frontends, then tell the backend the frontend URLs.

Before you start: create a **new** Gemini key at https://aistudio.google.com/apikey. The old key was inside the zip you shared, so delete it.

---

## 1. Backend on Hugging Face Spaces

1. Sign in at https://huggingface.co and click **New Space**.
   - Name: `weldsight-api` · SDK: **Docker** · Template: **Blank** · Hardware: **CPU basic (free)** · Public.
2. Put the backend code in the Space. Easiest is git (needs [Git LFS](https://git-lfs.com) installed once: `git lfs install`):

   ```bash
   git clone https://huggingface.co/spaces/<your-username>/weldsight-api
   cd weldsight-api
   cp -r /path/to/weldsight/backend/. .          # copies Dockerfile, app/, knowledge/, README.md, .gitattributes …
   cp /path/to/rust_seg_unity.onnx model/        # the 123 MB model (Git LFS handles it via .gitattributes)
   git add . && git commit -m "WeldSight API" && git push
   ```

   When git asks for a password, use a Hugging Face access token with write permission (Settings > Access Tokens).

   No git? On the Space page use **Files > Add file > Upload files** and drag in the contents of `backend/` plus `model/rust_seg_unity.onnx`.
3. In the Space, open **Settings > Variables and secrets** and add:
   - Secret `GEMINI_API_KEY` = your new key
   - Variable `ALLOWED_ORIGINS` = `http://localhost:5173,http://localhost:8443` for now (you'll add the Vercel URLs in step 4)
4. Wait for the build (3–5 minutes, watch **Logs**). When it says `Model loaded`, open
   `https://<your-username>-weldsight-api.hf.space/api/health`. You should see `"loaded": true` and `"configured": true`.
   Interactive API docs: `…hf.space/docs`.

Your backend URL is `https://<your-username>-weldsight-api.hf.space` (no trailing slash).

> Free Spaces go to sleep after about 48 hours without visits and take a minute to wake up. Open the health URL a few minutes before a demo.
> The free disk is wiped on restart, so reports created during a demo reset when the Space restarts (the demo reports come back automatically). For permanent storage, connect a database; only `backend/app/store.py` needs to change.

## 2. Push the project to GitHub

From the `weldsight/` folder:

```bash
git init && git add . && git commit -m "WeldSight"
git branch -M main
git remote add origin https://github.com/<you>/weldsight.git
git push -u origin main
```

`.gitignore` already keeps the model file and `.env` files out of GitHub.

## 3. Website and dashboard on Vercel

Do this twice, once per app. At https://vercel.com: **Add New > Project > import your GitHub repo**, then:

| Setting | Website | Dashboard |
|---|---|---|
| Project name | `weldsight` | `weldsight-dashboard` |
| Root Directory | `website` | `dashboard` |
| Framework | Vite (auto) | Vite (auto) |
| Environment variables | `VITE_API_URL` = backend URL<br>`VITE_DASHBOARD_URL` = dashboard URL | `VITE_API_URL` = backend URL<br>`VITE_SITE_URL` = website URL |

You won't know the other app's URL until it's deployed. Deploy both, then fill in the missing variable and click **Redeploy** (Vite bakes these values in at build time, so a redeploy is needed after any change).

Optional for the dashboard: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for real accounts. Without them it offers a demo sign-in.

## 4. Connect the backend to the frontends

Back in the Space settings, update:

- `ALLOWED_ORIGINS` = `https://weldsight.vercel.app,https://weldsight-dashboard.vercel.app` (your real URLs, comma-separated, no trailing slash)
- `SITE_URL` = website URL, `DASHBOARD_URL` = dashboard URL (the assistant uses these for links)
- Optional `ALLOWED_ORIGIN_REGEX` = `https://weldsight.*\.vercel\.app` so Vercel preview deployments work too

The Space restarts automatically.

## 5. Check everything is connected

1. **Dashboard:** the top bar says **Connected** (green). Amber means the model is still loading; red means check `VITE_API_URL` and `ALLOWED_ORIGINS`.
2. **Dashboard > Live feeds:** rust outlines appear on the pipeline feed (CAM-04) around 9 seconds into the clip.
3. **Website:** upload a photo in "Try the AI inspector". You get a score and outlines, plus "Saved to the dashboard as WEB-…".
4. **Dashboard > Defect reports:** that WEB report is at the top.
5. **Assistant** (either app): ask "Which reports are still open?" The answer should list real report codes.

## Automatic backend deploys (optional)

`.github/workflows/deploy-backend.yml` uploads `backend/` to your Space on every push to `main` that touches it (the model is skipped; it stays in the Space). In GitHub: **Settings > Secrets and variables > Actions**, add secret `HF_TOKEN` (write token) and variable `HF_SPACE` (`<your-username>/weldsight-api`).

## Other ways to deploy

- **Everything on Render:** `render.yaml` is a Blueprint for all three. The backend needs the Standard plan (the model needs about 1 GB RAM), and you must set `MODEL_URL` to a direct download link for the model, e.g. `https://huggingface.co/spaces/<you>/weldsight-api/resolve/main/model/rust_seg_unity.onnx`.
- **One machine / college server:** `docker compose up --build` runs all three (website on 5173, dashboard on 8443, API on 8000). Put the key in `backend/.env` and the model in `backend/model/` first.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Dashboard says "Backend offline" | Open the backend `/api/health` URL. If it works, the dashboard's `VITE_API_URL` is wrong or you didn't redeploy after setting it. |
| Browser console shows a CORS error | Add the exact frontend URL (with `https://`, no trailing slash) to `ALLOWED_ORIGINS`. |
| Health says `"loaded": false` | The model file is missing or a Git LFS pointer. Check `model/rust_seg_unity.onnx` is ~123 MB in the Space's Files tab. |
| Assistant says the Gemini key isn't set | Add the `GEMINI_API_KEY` secret in the Space and wait for the restart. |
| Live stream from a real camera doesn't show | The backend must be able to reach the stream URL. A camera on your LAN isn't reachable from Hugging Face; push it to a public relay (MediaMTX) or use Tailscale. |
