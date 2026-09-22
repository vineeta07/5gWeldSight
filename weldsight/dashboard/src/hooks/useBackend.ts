import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export interface Health {
  status: string;
  version: string;
  model: { name: string; loaded: boolean; error?: string | null; threshold: number; input_size: number; provider?: string | null };
  gemini: { configured: boolean; model: string };
  knowledge_chunks: number;
  uptime_s: number;
}

export type Connection = "checking" | "online" | "offline";

/** Polls /api/health so the UI can show whether the backend is reachable. */
export function useHealth(intervalMs = 30000) {
  const [connection, setConnection] = useState<Connection>("checking");
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const h = await api<Health>("/api/health", {}, 8000);
        if (alive) {
          setHealth(h);
          setConnection("online");
        }
      } catch {
        if (alive) setConnection("offline");
      }
    };
    check();
    const t = window.setInterval(check, intervalMs);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [intervalMs]);

  return { connection, health };
}

/**
 * Loads data from the backend and refreshes it periodically.
 * Falls back to demo data when the backend can't be reached (live = false).
 */
export function useLiveData<T>(path: string, fallback: T, intervalMs = 15000) {
  const [data, setData] = useState<T>(fallback);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const fallbackRef = useRef(fallback);

  const refresh = useCallback(async () => {
    try {
      const d = await api<T>(path, {}, 12000);
      setData(d);
      setLive(true);
    } catch {
      setLive((wasLive) => {
        if (!wasLive) setData(fallbackRef.current);
        return false;
      });
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    refresh();
    if (!intervalMs) return;
    const t = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(t);
  }, [refresh, intervalMs]);

  return { data, setData, live, loading, refresh };
}
