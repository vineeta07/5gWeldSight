import { useCallback, useEffect, useRef, useState } from "react";
import type { Camera, RiskLevel } from "../types";
import { api, apiUrl } from "../lib/api";

export interface DetectResult {
  count: number;
  coverage_pct: number;
  max_score: number;
  risk_level: RiskLevel;
  inference_ms: number;
  threshold: number;
  detections: { id: string; score: number; area_pct: number; box_norm: number[]; polygons: number[][][] }[];
  report_code?: string;
}

interface Props {
  camera: Camera | null;
  detect?: boolean; // send frames to the rust model
  threshold?: number;
  record?: boolean; // let the backend file a report when rust is found
  intervalMs?: number;
  compact?: boolean;
  onResult?: (r: DetectResult | null) => void;
}

type Box = { left: number; top: number; width: number; height: number };

/**
 * Plays a camera feed and, when `detect` is on, sends a frame to the rust model
 * every few seconds and draws the returned outlines on top of the video.
 *
 * - Cameras with a `stream_url` (RTSP/HTTP) are streamed by the backend, which
 *   draws detections itself (MJPEG).
 * - Cameras with a `video_source` play in the browser; frames are captured
 *   from the <video> element.
 */
export default function FeedPlayer({ camera, detect = false, threshold, record = false, intervalMs = 2500, compact = false, onResult }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const busy = useRef(false);
  const [box, setBox] = useState<Box | null>(null);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);

  const streamMode = Boolean(camera?.stream_url);
  const hasVideo = Boolean(camera?.video_source);

  // Work out where the video picture actually sits inside the box (object-contain letterboxing)
  const measure = useCallback(() => {
    const v = videoRef.current;
    const w = wrapRef.current;
    if (!v || !w || !v.videoWidth) return;
    const cw = w.clientWidth;
    const ch = w.clientHeight;
    const s = Math.min(cw / v.videoWidth, ch / v.videoHeight);
    const width = v.videoWidth * s;
    const height = v.videoHeight * s;
    setBox({ left: (cw - width) / 2, top: (ch - height) / 2, width, height });
  }, []);

  useEffect(() => {
    const w = wrapRef.current;
    if (!w) return;
    const ro = new ResizeObserver(measure);
    ro.observe(w);
    return () => ro.disconnect();
  }, [measure]);

  useEffect(() => {
    setResult(null);
    setError(null);
    setVideoFailed(false);
    onResult?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera?.camera_id]);

  // Detection loop for browser-played videos
  useEffect(() => {
    if (!detect || streamMode || !hasVideo || !camera) {
      setResult(null);
      return;
    }
    let alive = true;
    const tick = async () => {
      const v = videoRef.current;
      if (!v || busy.current || v.readyState < 2 || v.paused) return;
      busy.current = true;
      try {
        const canvas = canvasRef.current ?? (canvasRef.current = document.createElement("canvas"));
        const scale = Math.min(1, 640 / v.videoWidth);
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        canvas.getContext("2d")!.drawImage(v, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>((res) => {
          try {
            canvas.toBlob(res, "image/jpeg", 0.8);
          } catch {
            res(null);
          }
        });
        if (!blob) throw new Error("This video source doesn't allow frame capture. Add it as a stream URL instead.");
        const fd = new FormData();
        fd.append("file", blob, "frame.jpg");
        fd.append("camera_id", camera.camera_id);
        fd.append("record", String(record));
        if (threshold) fd.append("threshold", String(threshold));
        const r = await api<DetectResult>("/api/detect", { method: "POST", body: fd }, 15000);
        if (alive) {
          setResult(r);
          setError(null);
          onResult?.(r);
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        busy.current = false;
      }
    };
    tick();
    const t = window.setInterval(tick, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detect, streamMode, hasVideo, camera?.camera_id, threshold, record, intervalMs]);

  if (!camera) {
    return <div className="aspect-video w-full rounded-md bg-slate-900 flex items-center justify-center text-sm text-slate-400">No camera selected</div>;
  }

  const offline = camera.status === "OFFLINE" || (!streamMode && !hasVideo);

  return (
    <div className="w-full">
      <div ref={wrapRef} className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
        {offline || videoFailed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-400">
            <span className="text-sm">{videoFailed ? "Video couldn't be loaded" : "Camera offline"}</span>
            {!videoFailed && camera.last_heartbeat && <span className="text-xs text-slate-500">Last seen {new Date(camera.last_heartbeat).toLocaleString()}</span>}
          </div>
        ) : streamMode ? (
          <img
            src={apiUrl(`/api/camera-stream/${camera.camera_id}?detect=${detect ? "true" : "false"}`)}
            alt={`${camera.name} live stream`}
            className="absolute inset-0 w-full h-full object-contain"
            onError={() => setVideoFailed(true)}
          />
        ) : (
          <video
            ref={videoRef}
            src={camera.video_source}
            className="absolute inset-0 w-full h-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            controls
            onLoadedMetadata={measure}
            onError={() => setVideoFailed(true)}
          />
        )}

        {/* Defect outlines from the model */}
        {box && result && result.count > 0 && !streamMode && (
          <div className="absolute pointer-events-none" style={box}>
            <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
              {result.detections.map((d) =>
                d.polygons.map((poly, i) => (
                  <polygon
                    key={`${d.id}-${i}`}
                    points={poly.map(([x, y]) => `${x},${y}`).join(" ")}
                    fill="rgba(239,68,68,0.28)"
                    stroke="#ef4444"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                  />
                )),
              )}
            </svg>
            {result.detections.map((d) => (
              <div
                key={d.id}
                className="absolute border-2 border-amber-400"
                style={{
                  left: `${d.box_norm[0] * 100}%`,
                  top: `${d.box_norm[1] * 100}%`,
                  width: `${(d.box_norm[2] - d.box_norm[0]) * 100}%`,
                  height: `${(d.box_norm[3] - d.box_norm[1]) * 100}%`,
                }}
              >
                <span className="absolute -top-5 left-0 whitespace-nowrap bg-amber-400 px-1 text-[11px] font-medium text-slate-900">
                  {d.label || "Crack"} {Math.round(d.score * 100)}%
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="absolute top-2 left-2 flex items-center gap-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
          {!offline && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
          <span className="font-medium">{camera.camera_id}</span>
          {!compact && <span className="text-white/80">{camera.name}</span>}
        </div>
      </div>

      {!compact && detect && !offline && (
        <p className="mt-2 text-xs text-slate-500">
          {error
            ? `Defect detection paused: ${error}`
            : streamMode
              ? "Defect detection runs on the server for this stream."
              : !result
                ? "Defect detection on. Waiting for the first result…"
                : result.count
                  ? `Defect(s) found: ${result.count} ${result.count === 1 ? "area" : "areas"}, ${result.coverage_pct}% of the frame (highest confidence ${Math.round(result.max_score * 100)}%). Checked in ${Math.round(result.inference_ms)} ms.`
                  : `No defects in the latest frame. Checked in ${Math.round(result.inference_ms)} ms.`}
          {result?.report_code && ` Report ${result.report_code} was filed.`}
        </p>
      )}
    </div>
  );
}
