import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, Copy, Trash2 } from "lucide-react";
import { DEMO_INCIDENTS } from "../services/demoData";
import type { Incident, IncidentStatus, RiskLevel } from "../types";
import { api } from "../lib/api";
import { setAssistantContext } from "../lib/assistant";
import { useLiveData } from "../hooks/useBackend";
import { Card, DemoNotice, PageHeader, RiskBadge, SOURCE_LABEL, STATUS_LABEL, StatusBadge, timeAgo } from "../components/ui";

const STATUSES: IncidentStatus[] = ["NEW", "ACKNOWLEDGED", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"];
const RISKS: RiskLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function Detail({ inc, live, onChange, onDelete }: { inc: Incident; live: boolean; onChange: (i: Incident) => void, onDelete: (id: string) => void }) {
  const [notes, setNotes] = useState(inc.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNotes(inc.notes ?? "");
    setError("");
  }, [inc.id, inc.notes]);

  const update = async (patch: { status?: IncidentStatus; notes?: string }) => {
    setError("");
    if (!live) {
      onChange({ ...inc, ...patch });
      return;
    }
    setSaving(true);
    try {
      onChange(await api<Incident>(`/api/incidents/${inc.incident_code}`, { method: "PATCH", body: JSON.stringify(patch) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyHash = async () => {
    if (!inc.evidence_hash) return;
    await navigator.clipboard.writeText(inc.evidence_hash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const remove = async () => {
    if (!window.confirm("Delete this report?")) return;
    if (!live) {
      onDelete(inc.id);
      return;
    }
    setSaving(true);
    try {
      await api(`/api/incidents/${inc.incident_code}`, { method: "DELETE" });
      onDelete(inc.id);
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  return (
    <div className="p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-slate-900">
            {inc.threat_type.replace(/Defect|AI defect detection/gi, "Rust / corrosion")}
          </div>
          <div className="font-mono text-xs text-slate-500">{inc.incident_code}</div>
        </div>
        <RiskBadge risk={inc.risk_level} />
      </div>

      {inc.image && <img src={inc.image} alt="Frame with the finding outlined" className="mt-3 w-full rounded-md" />}

      <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
        <dt className="text-slate-500">Camera</dt>
        <dd className="text-slate-800">{inc.camera_name || inc.camera_id}</dd>
        <dt className="text-slate-500">Found</dt>
        <dd className="text-slate-800">{new Date(inc.timestamp).toLocaleString()}</dd>
        <dt className="text-slate-500">Source</dt>
        <dd className="text-slate-800">{SOURCE_LABEL[inc.source ?? "camera"] ?? inc.source}</dd>
        <dt className="text-slate-500">Model confidence</dt>
        <dd className="text-slate-800">{inc.confidence}%</dd>
        {inc.coverage_pct != null && (
          <>
            <dt className="text-slate-500">Defect coverage</dt>
            <dd className="text-slate-800">{inc.coverage_pct}% of the image</dd>
          </>
        )}
      </dl>

      {inc.ai_reasons && inc.ai_reasons.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold text-slate-700">Why it was flagged</h3>
          <ul className="mt-1 list-disc pl-5 space-y-0.5 text-slate-700">
            {inc.ai_reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mt-4 text-xs font-semibold text-slate-700">Status</h3>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            disabled={saving || inc.status === s}
            onClick={() => update({ status: s })}
            className={`rounded-md border px-2 py-1 text-xs ${inc.status === s ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <h3 className="mt-4 text-xs font-semibold text-slate-700">Notes</h3>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="What you checked, what was done…" className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
      <button onClick={() => update({ notes })} disabled={saving || notes === (inc.notes ?? "")} className="mt-1 rounded-md bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-40">
        Save notes
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <button onClick={remove} disabled={saving} className="mt-3 flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 disabled:opacity-40">
        <Trash2 size={14} /> Delete report
      </button>

      {inc.timeline && inc.timeline.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold text-slate-700">History</h3>
          <ol className="mt-1 space-y-1 text-xs text-slate-600">
            {inc.timeline.map((t, i) => (
              <li key={i}>
                <span className="text-slate-400">{new Date(t.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> {t.event}
              </li>
            ))}
          </ol>
        </>
      )}

      {inc.evidence_hash && (
        <>
          <h3 className="mt-4 text-xs font-semibold text-slate-700">Fingerprint (SHA-256)</h3>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">{inc.evidence_hash}</code>
            <button onClick={copyHash} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Copy fingerprint">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Recomputing this from the saved record shows whether it has been changed.</p>
        </>
      )}
      {!live && <p className="mt-3 text-xs text-amber-700">Demo data: changes aren't saved.</p>}
    </div>
  );
}

export default function Incidents() {
  const [params, setParams] = useSearchParams();
  const incidents = useLiveData<Incident[]>("/api/incidents?limit=300", DEMO_INCIDENTS, 15000);
  const [status, setStatus] = useState("");
  const [risk, setRisk] = useState("");
  const [source, setSource] = useState("");
  const [query, setQuery] = useState("");
  const selectedCode = params.get("code");

  const rows = useMemo(
    () =>
      incidents.data.filter(
        (i) =>
          (!status || i.status === status) &&
          (!risk || i.risk_level === risk) &&
          (!source || (i.source ?? "camera") === source) &&
          (!query || `${i.incident_code} ${i.threat_type} ${i.camera_name ?? ""} ${i.camera_id}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [incidents.data, status, risk, source, query],
  );
  const selected = incidents.data.find((i) => i.incident_code === selectedCode) ?? null;

  useEffect(() => {
    if (selected) {
      const { image, timeline, ...rest } = selected; // eslint-disable-line @typescript-eslint/no-unused-vars
      setAssistantContext({ selected_report: rest });
    } else setAssistantContext(null);
  }, [selected]);
  useEffect(() => () => setAssistantContext(null), []);

  const select = (code: string | null) => setParams(code ? { code } : {});
  const replace = (updated: Incident) => incidents.setData((all) => all.map((i) => (i.id === updated.id ? updated : i)));
  const openCount = incidents.data.filter((i) => i.status !== "RESOLVED" && i.status !== "FALSE_POSITIVE").length;

  return (
    <div className="p-5 max-w-7xl">
      <PageHeader title="Defect reports" description={`${openCount} open of ${incidents.data.length}. Reports come from cameras, video uploads and the website photo inspector.`} />
      <DemoNotice live={incidents.live} />

      <div className="mb-3 flex flex-wrap gap-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code, defect or camera" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm w-64" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Status">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={risk} onChange={(e) => setRisk(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Risk">
          <option value="">Any risk</option>
          {RISKS.map((r) => (
            <option key={r} value={r}>
              {r.charAt(0) + r.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm" aria-label="Source">
          <option value="">Any source</option>
          {Object.entries(SOURCE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <Card className="xl:col-span-3 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Report</th>
                  <th className="px-4 py-2 font-medium">Defect</th>
                  <th className="px-4 py-2 font-medium">Camera</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Found</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((i) => (
                  <tr key={i.id} onClick={() => select(i.incident_code)} className={`cursor-pointer hover:bg-slate-50 ${selected?.id === i.id ? "bg-emerald-50" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs text-slate-600">{i.incident_code}</td>
                    <td className="px-4 py-2 text-slate-800">
                      {i.threat_type.replace(/Defect|AI defect detection/gi, "Rust / corrosion")}
                    </td>
                    <td className="px-4 py-2 text-slate-600 truncate max-w-[10rem]">{i.camera_name || i.camera_id}</td>
                    <td className="px-4 py-2">
                      <RiskBadge risk={i.risk_level} />
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={i.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{timeAgo(i.timestamp)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No reports match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="xl:col-span-2" title={selected ? "Report details" : undefined}>
          {selected ? (
            <Detail
              inc={selected}
              live={incidents.live}
              onChange={(u) => incidents.setData((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
              onDelete={(id) => {
                incidents.setData((prev) => prev.filter((x) => x.id !== id));
                setParams({});
              }}
            />
          ) : (
            <p className="p-4 text-sm text-slate-500">Select a report to see details and update its status.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
