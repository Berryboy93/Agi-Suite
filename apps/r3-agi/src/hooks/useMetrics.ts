import { useCallback, useEffect, useRef, useState } from "react";

interface Metrics {
  activeUsers: number;
  totalSubscribers: number;
  totalSessions: number;
  totalSavedSeconds: number;
  avgSavedSeconds: number;
}

const SESSION_KEY = "r3-agi-session-id";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `agi-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metrics>({
    activeUsers: 0,
    totalSubscribers: 0,
    totalSessions: 0,
    totalSavedSeconds: 0,
    avgSavedSeconds: 0,
  });
  const [connected, setConnected] = useState(false);
  const sessionId = useRef(getSessionId());

  const heartbeat = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId.current }),
      });
      if (res.ok) setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []); // sessionId.current is a stable ref — safe empty deps

  useEffect(() => {
    void heartbeat();
    const hbInterval = setInterval(() => {
      void heartbeat();
    }, 30_000);

    const es = new EventSource("/api/metrics/stream");
    es.onopen = () => {
      setConnected(true);
    };
    es.onerror = () => {
      setConnected(false);
    };
    es.onmessage = (e) => {
      try {
        setMetrics(JSON.parse(e.data) as Metrics);
        setConnected(true);
      } catch {
        /* ignore malformed frame */
      }
    };

    return () => {
      clearInterval(hbInterval);
      es.close();
    };
  }, [heartbeat]);

  return { metrics, connected };
}
