import { NextRequest, NextResponse } from "next/server";
import { upstreamWhepUrl } from "@/lib/stream";
import { hasSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SDP offers are small; reject anything absurd to avoid memory pressure.
const MAX_OFFER_BYTES = 64 * 1024;

/**
 * Auth-guarded WebRTC (WHEP) signaling proxy.
 *
 * The browser POSTs its SDP offer here; we relay it to MediaMTX on localhost
 * and return the SDP answer. Only the signaling is proxied — the WebRTC media
 * itself is peer-to-peer (see docs). Middleware requires a session to reach it.
 */
export async function POST(req: NextRequest) {
  if (!(await hasSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const offer = await req.text();
  if (offer.length > MAX_OFFER_BYTES) {
    return NextResponse.json({ error: "Offer too large" }, { status: 413 });
  }

  try {
    const upstream = await fetch(upstreamWhepUrl(), {
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
