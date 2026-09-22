// Connection settings for the WeldSight backend.
// Local dev: leave VITE_API_URL empty; Vite forwards /api to http://localhost:8000.
// Production: set VITE_API_URL to the backend URL, e.g. https://you-weldsight-api.hf.space
const env = import.meta.env as Record<string, string | undefined>;
const clean = (v?: string) => (v || "").replace(/\/$/, "");

export const API_BASE = clean(env.VITE_API_URL);
export const SITE_URL = clean(env.VITE_SITE_URL);
export const CHAIN_GATEWAY_URL = clean(env.VITE_CHAIN_GATEWAY_URL);

export const apiUrl = (path: string) => `${API_BASE}${path}`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** fetch + JSON with a timeout and readable error messages. */
export async function api<T>(path: string, init: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  try {
    const res = await fetch(apiUrl(path), {
      ...init,
      signal: ctrl.signal,
      headers: isForm || !init.body ? init.headers : { "Content-Type": "application/json", ...(init.headers || {}) },
    });
    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (typeof body?.detail === "string") message = body.detail;
      } catch {
        /* not JSON */
      }
      throw new ApiError(message, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if ((e as Error).name === "AbortError") throw new ApiError("The server took too long to respond.", 0);
    throw new ApiError("Can't reach the WeldSight backend.", 0);
  } finally {
    window.clearTimeout(timer);
  }
}
