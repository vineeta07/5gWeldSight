import type { ReactNode } from "react";
import { useEffect } from "react";
import logoUrl from "../../logo.png";

interface Props {
  children: ReactNode;
}

export default function AuthLayout({ children }: Props) {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* LEFT — WeldSight industrial visual */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-10" style={{ background: "linear-gradient(135deg, #0c1a2e 0%, #132744 50%, #0a1628 100%)" }}>
        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none' stroke='%23ffffff' stroke-width='0.5'/%3E%3C/svg%3E\")" }} />

        {/* Welding sparks illustration */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg viewBox="0 0 400 300" className="w-4/5 opacity-20" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Welding torch */}
            <rect x="160" y="80" width="8" height="80" rx="2" stroke="#60a5fa" strokeWidth="0.8" transform="rotate(-15 164 120)" />
            <polygon points="164,160 155,180 173,180" stroke="#60a5fa" strokeWidth="0.8" fill="#60a5fa" fillOpacity="0.15" transform="rotate(-15 164 170)" />
            {/* Weld seam on workpiece */}
            <rect x="80" y="185" width="240" height="30" stroke="#94a3b8" strokeWidth="0.8" />
            <rect x="80" y="215" width="240" height="30" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="80" y1="215" x2="320" y2="215" stroke="#f97316" strokeWidth="1.5" strokeDasharray="4,3" />
            {/* Sparks from weld point */}
            {[[-20,-30],[15,-45],[-35,-15],[25,-20],[0,-50],[-10,-40],[30,-35],[-25,-25],[10,-55],[5,-10]].map(([dx,dy], i) => (
              <line key={i} x1="200" y1="215" x2={200+dx*2} y2={215+dy*2} stroke="#fbbf24" strokeWidth="0.5" opacity="0.7" />
            ))}
            {/* Camera on tripod watching the weld */}
            <rect x="330" y="150" width="18" height="12" rx="2" stroke="#60a5fa" strokeWidth="0.8" />
            <circle cx="339" cy="156" r="4" stroke="#60a5fa" strokeWidth="0.5" />
            <line x1="335" y1="162" x2="330" y2="190" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="343" y1="162" x2="348" y2="190" stroke="#94a3b8" strokeWidth="0.5" />
            <line x1="339" y1="162" x2="339" y2="195" stroke="#94a3b8" strokeWidth="0.5" />
            {/* 5G signal waves */}
            {[12, 20, 28].map((r, i) => (
              <path key={i} d={`M ${360+r} 140 A ${r} ${r} 0 0 1 ${360+r} ${140+r*1.5}`} stroke="#60a5fa" strokeWidth="0.4" opacity={0.6 - i*0.15} />
            ))}
            {/* Workbench / base */}
            <line x1="60" y1="245" x2="340" y2="245" stroke="#94a3b8" strokeWidth="0.3" />
          </svg>
        </div>

        {/* Scanning line animation */}
        <div className="absolute left-0 right-0 h-px opacity-30 animate-scan" style={{ background: "linear-gradient(90deg, transparent, #60a5fa, transparent)", top: 0 }} />

        {/* Corner brackets — HUD feel */}
        <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue-400/50" />
        <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue-400/50" />
        <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue-400/50" />
        <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue-400/50" />

        {/* Content — branding */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <img src={logoUrl} alt="WeldSight" className="w-24 h-24 md:w-32 md:h-32 object-contain shrink-0" />
            <div>
              <div className="text-blue-300 font-bold text-xl tracking-[0.3em] mt-1" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>WeldSight</div>
              <div className="text-blue-200/40 font-mono text-[10px]">Industry inspection</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <p className="text-blue-100/70 text-sm leading-relaxed max-w-sm" style={{ fontFamily: "Inter, sans-serif" }}>
              Watch weld cameras, review defect reports, and check photos and videos for defects.</p>
          </div>

          <div className="space-y-2.5">
            {["Real-time Weld Defect Detection", "5G Live Weld Streaming", "AI Quality Scoring & Analysis", "VR Weld Inspection Review"].map((item) => (
              <div key={item} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                <span className="text-blue-200/60 text-xs font-mono tracking-wide">{item}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-blue-900/50 pt-4">
            <div className="text-blue-200/30 font-mono text-xs space-y-1">
              <div className="font-bold">WeldSight Team</div>
              <div>Delhi Technological University</div>
              <div className="text-blue-400/60">5G-connected inspection</div>
            </div>
          </div>
        </div>

        {/* Status indicators */}
        <div className="absolute top-8 right-8 space-y-1.5">
          {[["SYSTEM", "#60a5fa"], ["5G LINK", "#60a5fa"], ["AI ENGINE", "#60a5fa"]].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: color as string }} />
              <span className="font-mono text-[10px]" style={{ color: color as string }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — form area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>
    </div>
  );
}
