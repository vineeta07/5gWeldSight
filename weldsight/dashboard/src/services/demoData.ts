import type { Camera, Alert, Incident, Evidence, TrackedObject, Zone, KPIData, SystemHealth } from "../types";

export const DEMO_CAMERAS: Camera[] = [
  { id: "1", camera_id: "CAM-01", name: "Weld bay 1: main seam", sector: "Bay A", type: "RGB", location: "Main welding bay", video_source: "/weldsight-inspection-feeds/cam01_weld_bay_live_arc.mp4", status: "ONLINE", fps: 30, resolution: "1280x720", ai_status: "ACTIVE", reliability_score: 98, alerts_today: 3, last_heartbeat: new Date().toISOString(), lat: 28.75, lng: 77.11 },
  { id: "2", camera_id: "CAM-02", name: "Seam scanner", sector: "Bay B", type: "RGB macro", location: "Post-weld inspection", video_source: "/weldsight-inspection-feeds/cam02_seam_scanner.mp4", status: "ONLINE", fps: 30, resolution: "1280x720", ai_status: "ACTIVE", reliability_score: 94, alerts_today: 2, last_heartbeat: new Date().toISOString(), lat: 28.75, lng: 77.12 },
  { id: "3", camera_id: "CAM-03", name: "Thermal camera", sector: "Bay A", type: "Thermal", location: "Cooling profile", video_source: "/weldsight-inspection-feeds/cam03_thermal_cooling.mp4", status: "ONLINE", fps: 30, resolution: "1280x720", ai_status: "ACTIVE", reliability_score: 92, alerts_today: 1, last_heartbeat: new Date().toISOString(), lat: 28.75, lng: 77.13 },
  { id: "4", camera_id: "CAM-04", name: "Pipeline P-12 crawler", sector: "Yard", type: "RGB", location: "Girth weld crawler", video_source: "/weldsight-inspection-feeds/cam04_pipeline_girth_weld.mp4", status: "ONLINE", fps: 30, resolution: "1280x720", ai_status: "ACTIVE", reliability_score: 97, alerts_today: 2, last_heartbeat: new Date().toISOString(), lat: 28.75, lng: 77.14 },
  { id: "5", camera_id: "CAM-05", name: "WeldSight prototype", sector: "Lab", type: "RGB (5G)", location: "Prototype camera unit", video_source: "", status: "OFFLINE", fps: 0, resolution: "-", ai_status: "INACTIVE", reliability_score: 0, alerts_today: 0, last_heartbeat: "2026-09-21T10:10:00Z", lat: 28.75, lng: 77.15 },
];

const now = new Date();
const ts = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60000).toISOString();

export const DEMO_ALERTS: Alert[] = [
  { id: "a1", camera_id: "CAM-01", severity: "CRITICAL", title: "Crack in weld seam", description: "Longitudinal crack found in the main seam weld. Inspect before continuing.", status: "ACTIVE", acknowledged: false, tracking_id: "D-021", risk_level: "CRITICAL", sector: "Bay-A", confidence: 96, timestamp: ts(2) },
  { id: "a2", camera_id: "CAM-04", severity: "HIGH", title: "Uneven cooling", description: "One section is cooling much faster than the rest. Check for lack of fusion.", status: "ACTIVE", acknowledged: false, tracking_id: "T-001", risk_level: "HIGH", sector: "Bay-A", confidence: 88, timestamp: ts(8) },
  { id: "a3", camera_id: "CAM-02", severity: "MEDIUM", title: "Porosity", description: "Several gas pores in the weld bead. Check shielding gas flow.", status: "ACKNOWLEDGED", acknowledged: true, tracking_id: "D-019", risk_level: "MEDIUM", sector: "Bay-B", confidence: 79, timestamp: ts(15) },
  { id: "a4", camera_id: "CAM-03", severity: "HIGH", title: "Undercut", description: "Groove along the weld toe. Depth may exceed the limit.", status: "ACTIVE", acknowledged: false, tracking_id: "D-006", risk_level: "HIGH", sector: "Bay-C", confidence: 93, timestamp: ts(22) },
  { id: "a5", camera_id: "CAM-05", severity: "LOW", title: "Spatter", description: "Light spatter beside the weld. Within acceptable limits.", status: "RESOLVED", acknowledged: true, tracking_id: "D-015", risk_level: "LOW", sector: "Bay-D", confidence: 71, timestamp: ts(45) },
];

export const DEMO_INCIDENTS: Incident[] = [
  {
    id: "inc1", incident_code: "DEF-2026-0003", camera_id: "CAM-01", camera_name: "Weld bay 1: main seam", sector: "Bay-A",
    timestamp: ts(2), object_type: "crack", tracking_id: "D-021", confidence: 96,
    threat_type: "Longitudinal crack", risk_score: 92, risk_level: "CRITICAL", status: "NEW",
    operator: "—", notes: "",
    ai_reasons: ["Crack pattern detected in weld seam", "Length exceeds 5mm threshold", "Located at weld root", "High contrast edge detected", "Confidence above critical threshold (96%)"],
    timeline: [
      { time: ts(4), event: "Defect found by CAM-01", status: "done" },
      { time: ts(3.5), event: "Defect tracking initiated — D-021", status: "done" },
      { time: ts(3), event: "Defect classified as CRACK", status: "done" },
      { time: ts(2.5), event: "Severity assessed as CRITICAL", status: "done" },
      { time: ts(2), event: "Critical alert sent", status: "done" },
      { time: ts(2), event: "Inspector review pending", status: "active" },
    ],
    created_at: ts(2),
  },
  {
    id: "inc2", incident_code: "DEF-2026-0002", camera_id: "CAM-04", camera_name: "Thermal camera", sector: "Bay-A",
    timestamp: ts(8), object_type: "heat_anomaly", tracking_id: "T-001", confidence: 88,
    threat_type: "Uneven cooling", risk_score: 75, risk_level: "HIGH", status: "INVESTIGATING",
    operator: "INS-Sharma", notes: "Heat zone confirmed. Welding parameters being adjusted.",
    ai_reasons: ["Thermal anomaly exceeding safe limits", "Potential burn-through zone", "Temperature gradient abnormal"],
    timeline: [
      { time: ts(10), event: "Thermal anomaly detected", status: "done" },
      { time: ts(9), event: "Heat zone T-001 tracked", status: "done" },
      { time: ts(8), event: "Alert generated", status: "done" },
      { time: ts(7), event: "Inspector acknowledged", status: "done" },
      { time: ts(5), event: "Investigation initiated", status: "active" },
    ],
    created_at: ts(8),
  },
  {
    id: "inc3", incident_code: "DEF-2026-0001", camera_id: "CAM-02", camera_name: "Seam scanner", sector: "Bay-B",
    timestamp: ts(45), object_type: "porosity", tracking_id: "D-019", confidence: 79,
    threat_type: "Surface defect", risk_score: 62, risk_level: "LOW", status: "RESOLVED",
    operator: "INS-Sharma", notes: "Minor surface defect, cleaned and smoothed.",
    ai_reasons: ["Defect detected on surface", "Area coverage 1.4%"],
    timeline: [
      { time: ts(120), event: "Surface defect detected by crawler", status: "done" },
      { time: ts(48), event: "Defect pattern flagged", status: "done" },
      { time: ts(45), event: "Alert generated", status: "done" },
      { time: ts(40), event: "Inspector reviewed and adjusted gas flow", status: "done" },
      { time: ts(35), event: "Resolved — within tolerance after fix", status: "done" },
    ],
    created_at: ts(45),
  },
];

export const DEMO_EVIDENCE: Evidence[] = [
  { id: "ev1", evidence_id: "INS-2026-0003", incident_id: "DEF-2026-0003", camera_id: "CAM-01", timestamp: ts(2), object_class: "crack", tracking_id: "D-021", confidence: 96, threat_score: 92, hash: "sha256:a3f8d2c1b7e4f093...", operator_status: "PENDING", sector: "Bay-A", risk_level: "CRITICAL" },
  { id: "ev2", evidence_id: "INS-2026-0002", incident_id: "DEF-2026-0002", camera_id: "CAM-04", timestamp: ts(8), object_class: "heat_anomaly", tracking_id: "T-001", confidence: 88, threat_score: 75, hash: "sha256:b5c9e1a4d6f2801c...", operator_status: "VERIFIED", sector: "Bay-A", risk_level: "HIGH" },
  { id: "ev3", evidence_id: "INS-2026-0001", incident_id: "DEF-2026-0001", camera_id: "CAM-02", timestamp: ts(45), object_class: "porosity", tracking_id: "D-019", confidence: 79, threat_score: 48, hash: "sha256:c7a2f4b8e3d1509e...", operator_status: "VERIFIED", sector: "Bay-B", risk_level: "MEDIUM" },
];

export const DEMO_TRACKED_OBJECTS: TrackedObject[] = [
  { tracking_id: "D-021", object_type: "crack", camera_id: "CAM-01", zone: "CRITICAL", confidence: 96, risk_level: "CRITICAL", status: "ACTIVE", first_seen: ts(4), last_seen: ts(0.5), duration_seconds: 210, face_analyzed: true, face_status: "UNKNOWN", threat_score: 92 },
  { tracking_id: "T-001", object_type: "heat_anomaly", camera_id: "CAM-04", zone: "WARNING", confidence: 88, risk_level: "HIGH", status: "ACTIVE", first_seen: ts(10), last_seen: ts(1), duration_seconds: 540, face_analyzed: false, threat_score: 75 },
  { tracking_id: "D-006", object_type: "undercut", camera_id: "CAM-03", zone: "WARNING", confidence: 93, risk_level: "HIGH", status: "ACTIVE", first_seen: ts(25), last_seen: ts(2), duration_seconds: 1380, threat_score: 68 },
  { tracking_id: "D-019", object_type: "porosity", camera_id: "CAM-02", zone: "SAFE", confidence: 71, risk_level: "LOW", status: "LOST", first_seen: ts(60), last_seen: ts(35), duration_seconds: 1500, face_analyzed: true, face_status: "AUTHORIZED", face_identity: "Inspector Sharma", threat_score: 20 },
];

export const DEMO_ZONES: Zone[] = [
  { id: "z1", name: "Acceptable", type: "SAFE", camera_id: "CAM-01", sector: "Bay-A", risk_weight: 1, active: true, points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 100 }, { x: 0, y: 100 }] },
  { id: "z2", name: "Review", type: "WARNING", camera_id: "CAM-01", sector: "Bay-A", risk_weight: 3, active: true, points: [{ x: 30, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 100 }, { x: 30, y: 100 }] },
  { id: "z3", name: "Critical", type: "RESTRICTED", camera_id: "CAM-01", sector: "Bay-A", risk_weight: 8, active: true, points: [{ x: 60, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 60, y: 100 }] },
];

export const DEMO_KPI: KPIData = {
  live_cameras: 5,
  active_tracks: 3,
  alerts_today: 7,
  critical_threats: 1,
  uptime_pct: 99.7,
  avg_confidence: 89,
};

export const DEMO_SYSTEM_HEALTH: SystemHealth = {
  ai_engine: "ONLINE",
  api_server: "ONLINE",
  database: "ONLINE",
  websocket: "CONNECTED",
  cameras_online: 5,
  cameras_total: 6,
  ai_fps: 24,
  avg_latency_ms: 83,
  memory_usage: 67,
  cpu_usage: 42,
  gpu_usage: 58,
};

export const DEMO_IDENTITIES = [
  { id: "INS-001", name: "Inspector Sharma", confidence: 94, authorized: true },
  { id: "INS-002", name: "Inspector Verma", confidence: 91, authorized: true },
  { id: "INS-003", name: "Welding Tech Mehta", confidence: 87, authorized: true },
];

export function generateDemoDetections(cameraId: string) {
  const objects = ["defect", "crack", "porosity"] as const;
  const zones = ["SAFE", "WARNING", "RESTRICTED"];
  const risks = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const count = Math.floor(Math.random() * 3) + 1;
  return Array.from({ length: count }, (_, i) => ({
    id: `det-${Date.now()}-${i}`,
    camera_id: cameraId,
    object_type: objects[Math.floor(Math.random() * objects.length)],
    confidence: Math.floor(Math.random() * 25) + 72,
    tracking_id: `D-0${Math.floor(Math.random() * 90) + 10}`,
    bounding_box: {
      x: Math.floor(Math.random() * 60) + 5,
      y: Math.floor(Math.random() * 40) + 10,
      width: Math.floor(Math.random() * 15) + 8,
      height: Math.floor(Math.random() * 20) + 15,
    },
    zone: zones[Math.floor(Math.random() * zones.length)],
    risk_level: risks[Math.floor(Math.random() * risks.length)],
    timestamp: new Date().toISOString(),
  }));
}
