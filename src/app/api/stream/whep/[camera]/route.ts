import { NextRequest, NextResponse } from "next/server";
import { getCamera } from "@/lib/config";
import { proxyWhep } from "@/lib/stream-proxy";
import { hasSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Auth-guarded WHEP signaling proxy for a specific, non-default camera. */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ camera: string }> }
) {
  if (!(await hasSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { camera } = await ctx.params;
  if (!getCamera(camera)) {
    return NextResponse.json({ error: "Unknown camera" }, { status: 404 });
  }
  return proxyWhep(req, camera);
}
