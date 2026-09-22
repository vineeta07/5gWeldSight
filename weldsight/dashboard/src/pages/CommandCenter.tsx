import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DEMO_CAMERAS, DEMO_INCIDENTS } from "../services/demoData";
import type { Camera, Incident } from "../types";
import { useLiveData } from "../hooks/useBackend";
import FeedPlayer from "../components/FeedPlayer";
import { Card, DemoNotice, PageHeader, RiskBadge, SOURCE_LABEL, StatusBadge, Toggle, timeAgo } from "../components/ui";

interface Stats {
  cameras_online: number;
  cameras_total: number;
  open_reports: number;
  critical_open: number;
  reports_today: number;
  avg_confidence: number;
}
interface Inspection {
  time: string;
  kind: "photo" | "video";
  source: string;
  status?: string;
  score?: number;
  risk_level?: string;
  summary?: string;
  file?: string;
  report_code?: string | null;
}

function Stat({ label, value, hint, tone = "text-slate-900" }: { label: string; value: string | number; hint?: string; tone?: string }) {
  return (
    <div className="glass-panel p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export default function CommandCenter() {
  const nav = useNavigate();
  const cameras = useLiveData<Camera[]>("/api/cameras", DEMO_CAMERAS, 30000);
  const incidents = useLiveData<Incident[]>("/api/incidents?limit=50", DEMO_INCIDENTS, 15000);
  const stats = useLiveData<Stats | null>("/api/stats", null, 15000);
  const inspections = useLiveData<Inspection[]>("/api/inspections?limit=5", [], 15000);
  const [detect, setDetect] = useState(true);

  const s = useMemo<Stats>(() => {
    if (stats.data) return stats.data;
    const open = incidents.data.filter((i) => i.status !== "RESOLVED" && i.status !== "FALSE_POSITIVE");
    return {
      cameras_online: cameras.data.filter((c) => c.status === "ONLINE").length,
      cameras_total: cameras.data.length,
      open_reports: open.length,
      critical_open: open.filter((i) => i.risk_level === "CRITICAL").length,
      reports_today: incidents.data.length,
      avg_confidence: 0,
    };
  }, [stats.data, incidents.data, cameras.data]);

  const mainCamera = cameras.data.find((c) => c.status === "ONLINE" && (c.video_source || c.stream_url)) ?? cameras.data[0] ?? null;

  return (
    <div className="p-5 max-w-7xl">
      <PageHeader title="Overview" description="What needs attention across your cameras and inspections." />
      <DemoNotice live={incidents.live} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Cameras online" value={`${s.cameras_online} of ${s.cameras_total}`} />
        <Stat label="Open reports" value={s.open_reports} hint="Not yet resolved" />
        <Stat label="Critical, still open" value={s.critical_open} tone={s.critical_open ? "text-red-600" : "text-slate-900"} />
        <Stat label="New reports today" value={s.reports_today} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card
          className="xl:col-span-3"
          title={mainCamera ? `Main feed: ${mainCamera.name}` : "Main feed"}
          actions={
            <div className="flex items-center gap-4">
              <Toggle checked={detect} onChange={setDetect} label="Defect detection" />
              <Link to="/surveillance" className="text-sm text-emerald-700 hover:underline">
                All feeds
              </Link>
            </div>
          }
        >
          <div className="p-4">
            <FeedPlayer camera={mainCamera} detect={detect && incidents.live} />
            {!incidents.live && <p className="mt-2 text-xs text-slate-500">Defect detection needs the backend.</p>}
          </div>
        </Card>

        <Card
          className="xl:col-span-2"
          title="Latest reports"
          actions={
            <Link to="/incidents" className="text-sm text-emerald-700 hover:underline">
              View all
            </Link>
          }
        >
          <ul className="divide-y divide-slate-100">
            {incidents.data.slice(0, 7).map((i) => (
              <li key={i.id}>
                <button onClick={() => nav(`/incidents?code=${i.incident_code}`)} className="w-full text-left px-4 py-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800 truncate">{i.threat_type}</span>
                    <RiskBadge risk={i.risk_level} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono">{i.incident_code}</span>
                    <span>·</span>
                    <span className="truncate">{i.camera_name || i.camera_id}</span>
                    <span>·</span>
                    <span>{timeAgo(i.timestamp)}</span>
                    <span className="ml-auto">
                      <StatusBadge status={i.status} />
                    </span>
                  </div>
                </button>
              </li>
            ))}
            {incidents.data.length === 0 && <li className="px-4 py-6 text-sm text-slate-500">No reports yet.</li>}
          </ul>
        </Card>
      </div>

      <Card className="mt-4" title="Recent inspections">
        {inspections.data.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">
            Photos checked on the website and videos analysed here will appear in this list.{" "}
            <Link to="/video-analysis" className="text-emerald-700 hover:underline">
              Analyse a video
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {inspections.data.map((x, n) => (
              <li key={n} className="px-4 py-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-slate-800">{x.kind === "video" ? `Video: ${x.file ?? "upload"}` : SOURCE_LABEL[x.source] ?? "Photo"}</span>
                <span className="text-slate-500 truncate max-w-xl">{x.summary}</span>
                <span className="ml-auto text-xs text-slate-400">{timeAgo(x.time)}</span>
                {x.report_code && (
                  <button onClick={() => nav(`/incidents?code=${x.report_code}`)} className="text-xs text-emerald-700 hover:underline">
                    {x.report_code}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
