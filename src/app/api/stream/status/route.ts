import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { mediamtxApiBase } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Reports whether the camera is actually publishing, by asking the MediaMTX
 * control API (localhost). Guarded by middleware (requires a session).
 */
export async function GET() {
  const url = `${mediamtxApiBase()}/v3/paths/get/${config.streamName}`;

  try {
    const ctrl = AbortSignal.timeout(2000);
    const res = await fetch(url, { signal: ctrl, cache: "no-store" });

    if (res.status === 404) {
      // Path exists in config but no publisher yet.
      return NextResponse.json({ online: false, reason: "no-publisher" });
    }
    if (!res.ok) {
      return NextResponse.json({ online: false, reason: `api-${res.status}` });
    }

    const data = await res.json();
    const online = Boolean(data.ready);
    let uptimeSec: number | null = null;
    if (online && typeof data.readyTime === "string") {
      const started = Date.parse(data.readyTime);
      if (!Number.isNaN(started)) {
        uptimeSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
      }
    }

    return NextResponse.json({
      online,
      uptimeSec,
      tracks: Array.isArray(data.tracks) ? data.tracks : [],
      readers: Array.isArray(data.readers) ? data.readers.length : 0,
    });
  } catch {
    // MediaMTX not running / unreachable.
    return NextResponse.json({ online: false, reason: "camera-server-down" });
  }
}
