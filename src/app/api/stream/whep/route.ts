import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { proxyWhep } from "@/lib/stream-proxy";
import { hasSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Auth-guarded WebRTC (WHEP) signaling proxy for the default (first-configured)
 * camera. Additional cameras use /api/stream/whep/[camera].
 *
 * The browser POSTs its SDP offer here; we relay it to MediaMTX on localhost
 * and return the SDP answer. Only the signaling is proxied — the WebRTC media
 * itself is peer-to-peer (see docs).
 */
export async function POST(req: NextRequest) {
  if (!(await hasSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return proxyWhep(req, config.streamName);
}
