"use client";

import { useEffect, useState } from "react";

interface Status {
  online: boolean;
  uptimeSec?: number | null;
  readers?: number;
  reason?: string;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StatusPanel({ url }: { url: string }) {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();
        if (alive) setStatus(data);
      } catch {
        if (alive) setStatus({ online: false, reason: "unreachable" });
      }
    }
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url]);

  const online = status?.online ?? false;

  return (
    <div className="status">
      <div className="status-row">
        <span className={`dot ${online ? "on" : "off"}`} />
        <span>{online ? "Camera online" : "Camera offline"}</span>
      </div>
      <dl className="status-grid">
        <dt>Uptime</dt>
        <dd>
          {online && status?.uptimeSec != null ? fmtUptime(status.uptimeSec) : "—"}
        </dd>
        <dt>Viewers</dt>
        <dd>{online ? status?.readers ?? 0 : "—"}</dd>
      </dl>
      {!online && status?.reason && (
        <p className="muted hint">
          {status.reason === "camera-server-down" || status.reason === "unreachable"
            ? "Start the camera:  npm run camera"
            : status.reason === "no-publisher"
            ? "Waiting for the camera feed…"
            : status.reason}
        </p>
      )}
    </div>
  );
}
