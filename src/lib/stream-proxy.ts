/**
 * Shared proxy logic used by both the default-camera and per-camera-id stream
 * routes, so the two route variants stay identical in behavior.
 */

import { NextRequest, NextResponse } from "next/server";
import { upstreamWhepUrl, mediamtxApiBase } from "@/lib/stream";

// SDP offers are small; reject anything absurd to avoid memory pressure.
const MAX_OFFER_BYTES = 64 * 1024;

export async function proxyWhep(req: NextRequest, cameraId: string) {
  const offer = await req.text();
  if (offer.length > MAX_OFFER_BYTES) {
    return NextResponse.json({ error: "Offer too large" }, { status: 413 });
  }

  try {
    const upstream = await fetch(upstreamWhepUrl(cameraId), {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer,
      signal: AbortSignal.timeout(5000),
    });

    const answer = await upstream.text();
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `camera signaling failed (${upstream.status})` },
        { status: 502 }
      );
    }
    return new NextResponse(answer, {
      status: 201,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch {
    return NextResponse.json({ error: "camera server unreachable" }, { status: 502 });
  }
}

export interface StreamStatus {
  online: boolean;
  uptimeSec?: number | null;
  tracks?: string[];
  readers?: number;
  reason?: string;
}

export async function statusFor(cameraId: string): Promise<StreamStatus> {
  const url = `${mediamtxApiBase()}/v3/paths/get/${cameraId}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000), cache: "no-store" });

    if (res.status === 404) return { online: false, reason: "no-publisher" };
    if (!res.ok) return { online: false, reason: `api-${res.status}` };

    const data = await res.json();
    const online = Boolean(data.ready);
    let uptimeSec: number | null = null;
    if (online && typeof data.readyTime === "string") {
      const started = Date.parse(data.readyTime);
      if (!Number.isNaN(started)) {
        uptimeSec = Math.max(0, Math.floor((Date.now() - started) / 1000));
      }
    }

    return {
      online,
      uptimeSec,
      tracks: Array.isArray(data.tracks) ? data.tracks : [],
      readers: Array.isArray(data.readers) ? data.readers.length : 0,
    };
  } catch {
    return { online: false, reason: "camera-server-down" };
  }
}
