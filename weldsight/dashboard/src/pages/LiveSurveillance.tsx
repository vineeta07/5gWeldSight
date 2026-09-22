import { useMemo, useState, type FormEvent } from "react";
import { Grid2x2, Plus, Square, Trash2 } from "lucide-react";
import { DEMO_CAMERAS } from "../services/demoData";
import type { Camera } from "../types";
import { api } from "../lib/api";
import { useLiveData } from "../hooks/useBackend";
import FeedPlayer, { type DetectResult } from "../components/FeedPlayer";
import { Card, DemoNotice, PageHeader, RiskBadge, Toggle } from "../components/ui";

export default function LiveSurveillance() {
  const cameras = useLiveData<Camera[]>("/api/cameras", DEMO_CAMERAS, 30000);
  const [sector, setSector] = useState("All");
  const [view, setView] = useState<"grid" | "single">("grid");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detect, setDetect] = useState(true);
  const [record, setRecord] = useState(true);
  const [threshold, setThreshold] = useState(0.7);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", sector: "", stream_url: "" });
  const [formError, setFormError] = useState("");

  const sectors = useMemo(() => ["All", ...Array.from(new Set(cameras.data.map((c) => c.sector)))], [cameras.data]);
  const visible = cameras.data.filter((c) => sector === "All" || c.sector === sector);
  const selected = cameras.data.find((c) => c.camera_id === selectedId) ?? visible.find((c) => c.status === "ONLINE") ?? visible[0] ?? null;

  const addCamera = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    try {
      await api<Camera>("/api/cameras", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", sector: "", stream_url: "" });
      setShowAdd(false);
      cameras.refresh();
    } catch (err) {
      setFormError((err as Error).message);
    }
  };

  const removeCamera = async (c: Camera) => {
    if (!window.confirm(`Remove ${c.camera_id} (${c.name})?`)) return;
    try {
      await api(`/api/cameras/${c.camera_id}`, { method: "DELETE" });
      cameras.refresh();
    } catch (err) {
      window.alert((err as Error).message);
    }
  };

  return (
    <div className="p-5 max-w-7xl">
      <PageHeader
        title="Live feeds"
        description="Watch cameras and run the defect model on the selected feed."
        actions={
          <>
            <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Filter by area">
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s === "All" ? "All areas" : s}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border border-slate-300 bg-white">
              <button onClick={() => setView("single")} className={`p-1.5 ${view === "single" ? "bg-slate-100" : ""}`} aria-label="One camera" title="One camera">
                <Square size={16} />
              </button>
              <button onClick={() => setView("grid")} className={`p-1.5 ${view === "grid" ? "bg-slate-100" : ""}`} aria-label="All cameras" title="All cameras">
                <Grid2x2 size={16} />
              </button>
            </div>
            <button onClick={() => setShowAdd((s) => !s)} disabled={!cameras.live} className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40">
              <Plus size={15} /> Add camera
            </button>
          </>
        }
      />
      <DemoNotice live={cameras.live} />

      {showAdd && (
        <Card className="mb-4" title="Add a camera">
          <form onSubmit={addCamera} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <label className="text-sm text-slate-600">
              Name
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Bay C seam camera" />
            </label>
            <label className="text-sm text-slate-600">
              Area
              <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Bay C" />
            </label>
            <label className="text-sm text-slate-600 md:col-span-2">
              Stream URL
              <input required value={form.stream_url} onChange={(e) => setForm({ ...form, stream_url: e.target.value })} className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm font-mono" placeholder="rtsp://host:8554/cam" />
            </label>
            <p className="md:col-span-3 text-xs text-slate-500">
              The backend reads the stream (RTSP, HTTP MJPEG or HLS), runs the defect model and sends the annotated video to the browser. It must be reachable from the server.
            </p>
            <button type="submit" className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm text-white">
              Save camera
            </button>
            {formError && <p className="md:col-span-4 text-sm text-red-600">{formError}</p>}
          </form>
        </Card>
      )}

      {view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((c) => (
            <button
              key={c.camera_id}
              onClick={() => {
                setSelectedId(c.camera_id);
                setView("single");
              }}
              className="text-left glass-panel p-2 hover:ring-2 hover:ring-emerald-500"
            >
              <FeedPlayer camera={c} compact />
              <div className="px-1 pt-2 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-800 truncate">{c.name}</span>
                <span className={c.status === "ONLINE" ? "text-emerald-700" : "text-slate-400"}>{c.status === "ONLINE" ? "Online" : "Offline"}</span>
              </div>
            </button>
          ))}
          {visible.length === 0 && <p className="text-sm text-slate-500">No cameras in this area.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <Card className="xl:col-span-3">
            <div className="p-4">
              <FeedPlayer camera={selected} detect={detect && cameras.live} threshold={threshold} record={record} onResult={setResult} />
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Toggle checked={detect} onChange={setDetect} label="Defect detection" />
                <Toggle checked={record} onChange={setRecord} label="File a report when a defect is found" />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  Minimum confidence
                  <input type="range" min={0.3} max={0.95} step={0.05} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
                  <span className="w-10 tabular-nums">{Math.round(threshold * 100)}%</span>
                </label>
              </div>
              {!cameras.live && <p className="mt-2 text-xs text-slate-500">Defect detection needs the backend.</p>}
            </div>
          </Card>

          <div className="space-y-4">
            <Card title="Cameras">
              <ul className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {visible.map((c) => (
                  <li key={c.camera_id} className={`flex items-center ${selected?.camera_id === c.camera_id ? "bg-emerald-50" : ""}`}>
                    <button onClick={() => setSelectedId(c.camera_id)} className="flex-1 text-left px-3 py-2">
                      <div className="text-sm text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-500">
                        {c.camera_id} · {c.sector} · {c.status === "ONLINE" ? "Online" : "Offline"}
                      </div>
                    </button>
                    {cameras.live && (
                      <button onClick={() => removeCamera(c)} className="p-2 text-slate-300 hover:text-red-600" aria-label={`Remove ${c.name}`}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Latest check">
              <div className="p-4 text-sm">
                {!result ? (
                  <p className="text-slate-500">{detect ? "Waiting for the first frame…" : "Turn on defect detection to check this feed."}</p>
                ) : result.count === 0 ? (
                  <p className="text-slate-600">No defects in the latest frame.</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-700">
                        {result.count} {result.count === 1 ? "area" : "areas"}, {result.coverage_pct}% of frame
                      </span>
                      <RiskBadge risk={result.risk_level} />
                    </div>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      {result.detections.map((d) => (
                        <li key={d.id}>
                          {d.id}: {Math.round(d.score * 100)}% confidence, {d.area_pct}% of frame
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                {selected && (
                  <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
                    <dt>Type</dt>
                    <dd className="text-slate-700">{selected.type}</dd>
                    <dt>Location</dt>
                    <dd className="text-slate-700">{selected.location || "-"}</dd>
                    <dt>Resolution</dt>
                    <dd className="text-slate-700">{selected.resolution || "-"}</dd>
                  </dl>
                )}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
