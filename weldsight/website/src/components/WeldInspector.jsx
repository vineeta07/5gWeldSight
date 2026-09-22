import { useRef, useState } from "react";
import SectionHeader from "./SectionHeader";
import { useReveal } from "../hooks/useReveal";
import { openChat, setLastInspection } from "../utils/chat";
import { apiUrl, DASHBOARD_URL } from "../utils/api";

// Same green/amber/red idea as the summarising agent, applied to welds.
const STATUS = {
  GREEN: { label: "Acceptable", text: "text-[#1DB954]", ring: "border-[#1DB954]/50", dot: "bg-[#1DB954]" },
  AMBER: { label: "Needs review", text: "text-[#F5A623]", ring: "border-[#F5A623]/50", dot: "bg-[#F5A623]" },
  RED: { label: "Reject or repair", text: "text-[#E53935]", ring: "border-[#E53935]/50", dot: "bg-[#E53935]" },
};

const MAX_BYTES = 10 * 1024 * 1024;

// Shrink the photo in the browser before upload: faster and cheaper.
const toCompressedBase64 = (file, maxSide = 1280) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image."));
    };
    img.src = url;
  });

const WeldInspector = () => {
  const sectionRef = useRef(null);
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useReveal(sectionRef);

  const pick = (f) => {
    setResult(null);
    setError("");
    if (!f) return;
    if (!f.type.startsWith("image/")) return setError("Choose an image file (JPG, PNG or WebP).");
    if (f.size > MAX_BYTES) return setError("That image is over 10 MB. Choose a smaller one.");
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const analyze = async () => {
    if (!file || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const image = await toCompressedBase64(file);
      const res = await fetch(apiUrl("/api/analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Bypass-Tunnel-Reminder": "true",
        },
        body: JSON.stringify({ image, mime_type: "image/jpeg" }),
      });
      if (!res.ok) throw new Error(`Server replied ${res.status}`);
      const data = await res.json();
      setResult(data);
      setLastInspection(data);
    } catch (err) {
      console.error(err);
      setError("The analysis service didn't respond. Check that the backend is running, then try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const status = result?.is_weld ? STATUS[result.status] || STATUS.AMBER : null;

  return (
    <section id="inspector" ref={sectionRef} className="w-full bg-black section-pad">
      <div className="screen-max-width page-gutter">
        <SectionHeader
          title="Try the AI inspector."
          subtitle="Upload a photo of a weld and get a quality score, the defects spotted and what to do next."
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Upload */}
          <div data-reveal className="glass-card p-5 md:p-6">
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                pick(e.dataTransfer.files?.[0]);
              }}
              className={`relative flex-center flex-col aspect-[4/3] rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden transition-colors ${
                dragOver ? "border-blue bg-blue/5" : "border-white/15 hover:border-blue/50"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              {preview ? (
                <img src={result?.annotated_image || preview} alt={result?.annotated_image ? "Weld photo with defects outlined" : "Weld photo to analyse"} className="absolute inset-0 w-full h-full object-contain bg-black/40" />
              ) : (
                <div className="text-center px-6">
                  <svg className="mx-auto mb-3 text-blue" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3M12 4v12M7 9l5-5 5 5" />
                  </svg>
                  <p className="text-white font-medium">Drop a weld photo here</p>
                  <p className="text-gray text-sm mt-1">or click to choose one. JPG, PNG or WebP, up to 10 MB.</p>
                </div>
              )}
            </label>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button onClick={analyze} disabled={!file || loading} className="btn disabled:opacity-40 disabled:pointer-events-none">
                {loading ? "Analysing…" : "Analyse weld"}
              </button>
              {file && !loading && (
                <button onClick={reset} className="text-sm text-gray hover:text-white underline-offset-4 hover:underline">
                  Choose a different photo
                </button>
              )}
            </div>
            {error && <p className="mt-4 text-sm text-weld" role="alert">{error}</p>}
          </div>

          {/* Result */}
          <div data-reveal data-reveal-delay="0.1" className="glass-card p-5 md:p-6 min-h-[300px]" aria-live="polite">
            {!result && !loading && (
              <div className="h-full min-h-[260px] flex flex-col justify-center">
                <p className="text-white font-medium">Your report appears here.</p>
                <p className="text-gray text-sm mt-2 max-w-sm">
                  You&apos;ll get a 0–100 quality score, a traffic-light status, the defects found
                  and one recommended action.
                </p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[260px] flex-center flex-col gap-4">
                <div className="w-10 h-10 border-2 border-blue border-t-transparent rounded-full animate-spin" />
                <p className="text-gray text-sm">Checking porosity, cracks, undercut and more…</p>
              </div>
            )}

            {result && !result.is_weld && (
              <div className="min-h-[260px] flex flex-col justify-center">
                <p className="text-white font-medium">This doesn&apos;t look like a weld.</p>
                <p className="text-gray text-sm mt-2">
                  {result.summary || "Try a close-up photo of a weld bead in good light."}
                </p>
              </div>
            )}

            {result?.is_weld && status && (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`flex items-center gap-2 font-semibold ${status.text}`}>
                      <span className={`w-2.5 h-2.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </p>
                    <p className="text-gray text-sm mt-1">Weld quality score</p>
                  </div>
                  <p className={`font-outfit font-bold text-5xl leading-none ${status.text}`}>
                    {result.score}
                    <span className="text-lg text-gray font-normal">/100</span>
                  </p>
                </div>

                <div className="mt-6">
                  <p className="text-sm text-gray mb-4">
                    {result.rust?.count
                      ? `AI model: ${result.rust.count} ${result.rust.count === 1 ? "area" : "areas"} outlined on the photo, covering ${result.rust.coverage_pct}% (highest confidence ${Math.round(result.rust.max_score * 100)}%).`
                      : "AI model: no defects or anomalies found."}{" "}
                    {result.engine === "model+gemini" ? "Other defects were checked by Gemini." : "Gemini review unavailable, so only the primary model was used."}
                  </p>
                  <h3 className="text-white font-semibold mb-2">Defects found</h3>
                  {result.defects?.length ? (
                    <ul className="flex flex-col gap-2">
                      {result.defects.map((d, i) => (
                        <li key={i} className={`rounded-xl border ${status.ring} bg-white/[0.03] px-4 py-3`}>
                          <p className="text-white text-sm font-medium capitalize">
                            {d.type} <span className="text-gray font-normal">· {d.severity}</span>
                          </p>
                          {d.location && <p className="text-gray text-sm mt-0.5">{d.location}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray text-sm">No visible defects.</p>
                  )}
                </div>

                <div className="mt-6">
                  <h3 className="text-white font-semibold mb-1">Bottom line</h3>
                  <p className="text-gray text-sm leading-relaxed">{result.summary}</p>
                </div>

                <div className="mt-5 rounded-xl bg-blue/10 border border-blue/20 px-4 py-3">
                  <h3 className="text-blue text-sm font-semibold">Recommended action</h3>
                  <p className="text-white text-sm mt-1">{result.action}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                  <button onClick={openChat} className="text-blue hover:underline">
                    Ask the assistant about this result
                  </button>
                  {result.report_code && (
                    <a href={`${DASHBOARD_URL}/incidents`} target="_blank" rel="noopener noreferrer" className="text-blue hover:underline">
                      Saved to the dashboard as {result.report_code}
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-xs text-gray max-w-2xl">
          Photos are checked by WeldSight&apos;s AI defect detection model and reviewed by Google Gemini. Results are a screening aid, not a certified inspection.
        </p>
      </div>
    </section>
  );
};

export default WeldInspector;
