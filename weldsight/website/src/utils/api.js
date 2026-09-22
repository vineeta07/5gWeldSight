// Where the WeldSight backend lives.
// - Local dev: leave VITE_API_URL empty; Vite forwards /api to localhost:8000.
// - Production: set VITE_API_URL to the backend URL, e.g. https://you-weldsight-api.hf.space
export const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const apiUrl = (path) => `${API_BASE}${path}`;

// The inspection dashboard (a separate app)
export const DASHBOARD_URL = (import.meta.env.VITE_DASHBOARD_URL || "http://localhost:8443").replace(/\/$/, "");
