import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChartColumn, ChevronLeft, ChevronRight, Clapperboard, Download, ExternalLink, FileText, LayoutDashboard, LogOut,
  Map, MessageSquare, Settings, Shapes, ShieldCheck, TriangleAlert, Video,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useHealth } from "../hooks/useBackend";
import { SITE_URL } from "../lib/api";
import { OPEN_ASSISTANT_EVENT } from "../lib/assistant";
import AssistantPanel from "./AssistantPanel";
import { logoBase64 as logoUrl } from "../logoBase64";

const NAV_ITEMS = [
  { path: "/", label: "Overview", icon: LayoutDashboard, exact: true },
  { path: "/surveillance", label: "Live feeds", icon: Video },
  { path: "/incidents", label: "Defect reports", icon: TriangleAlert },
  { path: "/video-analysis", label: "Video analysis", icon: Clapperboard },
  { path: "/map", label: "Facility map", icon: Map },
  { path: "/analytics", label: "Analytics", icon: ChartColumn },
  { path: "/evidence", label: "Inspection records", icon: ShieldCheck },
  { path: "/zones", label: "Weld zones", icon: Shapes },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/settings", label: "Settings", icon: Settings },
];

function ConnectionStatus() {
  const { connection, health } = useHealth();
  const label =
    connection === "checking"
      ? "Connecting…"
      : connection === "offline"
        ? "Backend offline"
        : health && !health.model.loaded
          ? "Connected, model loading"
          : "Connected";
  const dot = connection === "online" ? (health?.model.loaded ? "bg-emerald-500" : "bg-amber-500") : connection === "offline" ? "bg-red-500" : "bg-slate-400";
  const title =
    connection === "online" && health
      ? `Model: ${health.model.name} (${health.model.loaded ? "loaded" : "loading"}) · Assistant: ${health.gemini.configured ? "Gemini" : "offline mode"}`
      : "The dashboard is using demo data until the backend is reachable.";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600" title={title}>
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="text-sm font-bold text-slate-700">{now.toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>;
}

export default function Layout() {
  const { user, signOut, isDemo } = useAuth();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const open = () => setAssistantOpen(true);
    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    nav("/login");
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="flex flex-col border-r border-slate-200 bg-white transition-all duration-200 flex-shrink-0" style={{ width: collapsed ? 80 : 280 }}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-200 min-h-[80px]">
          <button onClick={() => collapsed && setCollapsed(false)} className="flex-shrink-0 outline-none cursor-pointer" title={collapsed ? "Expand sidebar" : ""}>
            <img src={logoUrl} alt="WeldSight" className={`object-contain transition-all duration-200 ${collapsed ? "w-10 h-10 hover:scale-105" : "w-12 h-12 md:w-16 md:h-16"}`} />
          </button>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold text-slate-900 leading-tight">WeldSight</div>
              <div className="text-sm text-slate-500 leading-tight">Industry inspection</div>
            </div>
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="ml-auto text-slate-400 hover:text-slate-700 p-1 bg-slate-100 rounded-full hover:bg-slate-200" aria-label="Collapse sidebar">
              <ChevronLeft size={20} />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => (
            <NavLink
              key={path}
              to={path}
              end={exact}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 my-0.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-emerald-50 text-emerald-800 font-medium" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-2 space-y-1">
          {deferredPrompt && (
            <button
              onClick={handleInstallClick}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-emerald-700 hover:bg-emerald-50`}
              title={collapsed ? "Install app" : undefined}
            >
              <Download size={17} className="flex-shrink-0" />
              {!collapsed && "Install app"}
            </button>
          )}
          <button
            onClick={() => setAssistantOpen((o) => !o)}
            className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm ${assistantOpen ? "bg-emerald-600 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            title={collapsed ? "AI assistant" : undefined}
          >
            <MessageSquare size={17} className="flex-shrink-0" />
            {!collapsed && "AI assistant"}
          </button>
          {SITE_URL && (
            <a href={SITE_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-2.5 py-2 rounded-md text-sm text-slate-600 hover:bg-slate-100" title={collapsed ? "Project website" : undefined}>
              <ExternalLink size={17} className="flex-shrink-0" />
              {!collapsed && "Project website"}
            </a>
          )}
          <div className="flex items-center gap-2 px-2.5 pt-2">
            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
              {(user?.full_name?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-slate-800 truncate">{user?.full_name || user?.email}</div>
                  <div className="text-xs text-slate-500">{isDemo ? "Demo account" : user?.role?.toLowerCase()}</div>
                </div>
                <button onClick={handleSignOut} className="text-slate-400 hover:text-red-600" aria-label="Sign out" title="Sign out">
                  <LogOut size={16} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 h-14 border-b border-slate-200 bg-white flex-shrink-0">
          <ConnectionStatus />
          <div className="flex items-center gap-4">
            {isDemo && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800">Demo account</span>}
            <Clock />
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
          {assistantOpen && <AssistantPanel onClose={() => setAssistantOpen(false)} />}
        </main>
      </div>
    </div>
  );
}
