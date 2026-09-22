import type { ReactNode } from "react";
import type { IncidentStatus, RiskLevel } from "../types";

export const RISK_STYLE: Record<RiskLevel, string> = {
  CRITICAL: "bg-red-50 text-red-700 border-red-200",
  HIGH: "bg-orange-50 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  LOW: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export const STATUS_LABEL: Record<IncidentStatus, string> = {
  NEW: "New",
  ACKNOWLEDGED: "Acknowledged",
  INVESTIGATING: "Investigating",
  RESOLVED: "Resolved",
  FALSE_POSITIVE: "False positive",
};

export const SOURCE_LABEL: Record<string, string> = {
  camera: "Camera",
  video: "Video upload",
  website: "Website photo",
  dashboard: "Dashboard photo",
};

export function riskLabel(r: RiskLevel) {
  return r.charAt(0) + r.slice(1).toLowerCase();
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${RISK_STYLE[risk]}`}>{riskLabel(risk)}</span>;
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const style =
    status === "NEW"
      ? "bg-blue-50 text-blue-700"
      : status === "RESOLVED"
        ? "bg-slate-100 text-slate-600"
        : status === "FALSE_POSITIVE"
          ? "bg-slate-100 text-slate-500 line-through"
          : "bg-violet-50 text-violet-700";
  return <span className={`inline-flex px-2 py-0.5 rounded text-xs ${style}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`glass-panel ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function DemoNotice({ live }: { live: boolean }) {
  if (live) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      Showing demo data because the backend isn't reachable. Changes won't be saved.
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors ${checked ? "bg-emerald-600" : "bg-slate-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </button>
      {label}
    </label>
  );
}
