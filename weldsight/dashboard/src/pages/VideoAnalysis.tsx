import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Send, Upload } from "lucide-react";
import { api } from "../lib/api";
import { setAssistantContext } from "../lib/assistant";
import type { RiskLevel } from "../types";
import { Card, PageHeader, RiskBadge } from "../components/ui";

interface VideoResult {
  file: string;
  frames_checked: number;
  frames_with_rust: number;
  peak_coverage_pct: number;
  peak_time_s: number;
  duration_s: number;
  risk_level: RiskLevel;
  summary: string;
  timeline: { t: number; count: number; coverage_pct: number; max_score: number }[];
  keyframes: { t: number; coverage_pct: number; count: number; image: string }[];
  report_code: string | null;
  engine: string;
}
interface PhotoResult {
  score: number;
  status: "GREEN" | "AMBER" | "RED";
  is_weld: boolean;
  defects: { type: string; severity: string; location: string }[];
  summary: string;
  action: string;
  engine: string;
  report_code: string | null;
  annotated_image: string;
  rust: { count: number; coverage_pct: number; max_score: number };
}
interface Msg {
  role: "user" | "assistant";
  content: string;
}

const STATUS_TEXT = { GREEN: "Acceptable", AMBER: "Needs review", RED: "Reject or repair" };
const STATUS_STYLE = { GREEN: "text-emerald-700", AMBER: "text-amber-700", RED: "text-red-700" };

export default function VideoAnalysis() {
  const [mode, setMode] = useState<"video" | "photo">("video");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [video, setVideo] = useState<VideoResult | null>(null);
  const [photo, setPhoto] = useState<PhotoResult | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => () => setAssistantContext(null), []);

  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [busy]);

  const context = () => {
    if (video) {
      const { keyframes, timeline, ...rest } = video; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { video_analysis: { ...rest, timeline_brief: timeline.map((x) => `${x.t}s:${x.coverage_pct}%`).join(", ") } };
    }
    if (photo) {
      const { annotated_image, ...rest } = photo; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { photo_analysis: rest };
    }
    return null;
  };

  const pick = (f: File | null) => {
    setError("");
    setVideo(null);
    setPhoto(null);
    setMessages([]);
    setAssistantContext(null);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : "");
  };

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      if (mode === "video") {
        const r = await api<VideoResult>("/api/video/analyze", { method: "POST", body: fd }, 240000);
        setVideo(r);
        const { keyframes, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
        setAssistantContext({ video_analysis: rest });
      } else {
        fd.append("source", "dashboard");
        const r = await api<PhotoResult>("/api/analyze/upload", { method: "POST", body: fd }, 90000);
        setPhoto(r);
        const { annotated_image, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
        setAssistantContext({ photo_analysis: rest });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setQuestion("");
    setAsking(true);
    try {
      const r = await api<{ reply: string }>(
        "/api/chat",
        { method: "POST", body: JSON.stringify({ messages: next.slice(-10), app: "dashboard", page: "Video analysis", context: context() }) },
        60000,
      );
      setMessages([...next, { role: "assistant", content: r.reply }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", content: `Sorry, I couldn't answer that. ${(err as Error).message}` }]);
    } finally {
      setAsking(false);
    }
  };

  const seek = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = t;
      videoRef.current.pause();
    }
  };

  const hasResult = Boolean(video || photo);

  return (
    <div className="p-5 max-w-7xl">
      <PageHeader title="Video analysis" description="Upload a recorded weld video or a photo. The defect model checks it and the result is saved as a defect report." />

      <div className="mb-4 inline-flex rounded-md border border-slate-300 bg-white p-0.5">
        {(["video", "photo"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              pick(null);
            }}
            className={`px-4 py-1.5 text-sm rounded ${mode === m ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            {m === "video" ? "Video" : "Photo"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card title={mode === "video" ? "Your video" : "Your photo"}>
          <div className="p-4">
            <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 cursor-pointer aspect-video overflow-hidden">
              <input type="file" accept={mode === "video" ? "video/*" : "image/*"} className="sr-only" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
              {!preview ? (
                <>
                  <Upload className="text-slate-400" />
                  <span className="text-sm text-slate-700">Choose a {mode}</span>
                  <span className="text-xs text-slate-500">{mode === "video" ? "MP4, MOV or WebM, up to 60 MB" : "JPG, PNG or WebP, up to 10 MB"}</span>
                </>
              ) : mode === "video" ? (
                <video ref={videoRef} src={preview} controls className="w-full h-full object-contain bg-black" />
              ) : (
                <img src={photo?.annotated_image || preview} alt="Uploaded weld" className="w-full h-full object-contain bg-black" />
              )}
            </label>
            <div className="mt-3 flex items-center gap-3">
              <button onClick={run} disabled={!file || busy} className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white disabled:opacity-40">
                {busy ? `Analysing… ${elapsed}s` : mode === "video" ? "Analyse video" : "Analyse photo"}
              </button>
              {file && !busy && (
                <button onClick={() => pick(null)} className="text-sm text-slate-500 hover:text-slate-800">
                  Clear
                </button>
              )}
            </div>
            {busy && mode === "video" && <p className="mt-2 text-xs text-slate-500">This usually takes 10 to 40 seconds, depending on the server.</p>}
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </Card>

        <Card title="Result">
          <div className="p-4 text-sm">
            {!hasResult && <p className="text-slate-500">Results appear here after the analysis.</p>}

            {video && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-800 font-medium truncate">{video.file}</span>
                  <RiskBadge risk={video.risk_level} />
                </div>
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["Frames checked", video.frames_checked],
                    ["Frames with defects", video.frames_with_rust],
                    ["Peak coverage", `${video.peak_coverage_pct}%`],
                    ["Peak at", `${video.peak_time_s}s`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-md bg-slate-50 p-2">
                      <div className="text-xs text-slate-500">{k}</div>
                      <div className="text-base font-semibold text-slate-900">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-slate-700 leading-relaxed">{video.summary}</p>
                <div className="mt-4 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={video.timeline} onClick={(e) => e?.activeLabel != null && seek(Number(e.activeLabel))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="t" tickFormatter={(t) => `${t}s`} fontSize={11} />
                      <YAxis fontSize={11} unit="%" width={36} />
                      <Tooltip formatter={(v) => [`${v}%`, "Defect coverage"]} labelFormatter={(t) => `At ${t}s (click to jump)`} />
                      <Bar dataKey="coverage_pct" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {video.report_code && (
                  <p className="mt-2 text-xs text-slate-500">
                    Saved as{" "}
                    <Link to={`/incidents?code=${video.report_code}`} className="text-emerald-700 hover:underline">
                      {video.report_code}
                    </Link>
                    .
                  </p>
                )}
              </>
            )}

            {photo && (
              <>
                <div className="flex items-center justify-between">
                  <span className={`font-medium ${STATUS_STYLE[photo.status]}`}>{STATUS_TEXT[photo.status]}</span>
                  <span className="text-2xl font-semibold text-slate-900">
                    {photo.score}
                    <span className="text-sm font-normal text-slate-500">/100</span>
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {photo.rust.count ? `AI model: ${photo.rust.count} area(s), ${photo.rust.coverage_pct}% coverage.` : "AI model: no defects found."}{" "}
                  {photo.engine === "model+gemini" ? "Other defects reviewed by Gemini." : "Gemini review unavailable."}
                </p>
                <ul className="mt-3 space-y-1">
                  {photo.defects.map((d, i) => (
                    <li key={i} className="rounded-md bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-800 capitalize">{d.type}</span> <span className="text-slate-500">· {d.severity}</span>
                      <div className="text-xs text-slate-500">{d.location}</div>
                    </li>
                  ))}
                  {photo.defects.length === 0 && <li className="text-slate-500">No visible defects.</li>}
                </ul>
                <p className="mt-3 text-slate-700">{photo.summary}</p>
                <p className="mt-2 text-slate-800">
                  <span className="font-medium">Next step:</span> {photo.action}
                </p>
                {photo.report_code && (
                  <p className="mt-2 text-xs text-slate-500">
                    Saved as{" "}
                    <Link to={`/incidents?code=${photo.report_code}`} className="text-emerald-700 hover:underline">
                      {photo.report_code}
                    </Link>
                    .
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {video && video.keyframes.length > 0 && (
        <Card className="mt-4" title={video.frames_with_rust ? "Frames with the most defects" : "Sample frames"}>
          <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {video.keyframes.map((k) => (
              <button key={k.t} onClick={() => seek(k.t)} className="text-left">
                <img src={k.image} alt={`Frame at ${k.t} seconds`} className="w-full rounded-md" />
                <div className="mt-1 text-xs text-slate-500">
                  {k.t}s · {k.count ? `${k.coverage_pct}% defect` : "no defects"}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {hasResult && (
        <Card className="mt-4" title="Ask about this result">
          <div className="p-4">
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className={`text-sm rounded-md px-3 py-2 whitespace-pre-wrap ${m.role === "user" ? "bg-slate-900 text-white ml-12" : "bg-slate-100 text-slate-800 mr-12"}`}>
                  {m.content}
                </div>
              ))}
              {asking && <div className="text-sm text-slate-500">Thinking…</div>}
            </div>
            <form onSubmit={ask} className="mt-3 flex gap-2">
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={mode === "video" ? "e.g. When does the defect first appear?" : "e.g. What caused this?"}
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <button type="submit" disabled={asking || !question.trim()} className="rounded-md bg-emerald-600 px-3 text-white disabled:opacity-40" aria-label="Send">
                <Send size={16} />
              </button>
            </form>
          </div>
        </Card>
      )}
    </div>
  );
}
