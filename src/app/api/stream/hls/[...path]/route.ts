import { NextRequest, NextResponse } from "next/server";
import { upstreamHlsUrl } from "@/lib/stream";
import { getCamera } from "@/lib/config";
import { hasSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Only allow HLS artifacts for a configured camera: <cameraId>/<name>.(m3u8|ts|mp4).
function allowedHlsPath(segments: string[]): boolean {
  if (segments.length < 2) return false;
  if (!getCamera(segments[0])) return false;
  if (segments.some((s) => s.includes("..") || s.includes("/") || s.includes("\\"))) {
    return false;
  }
  const last = segments[segments.length - 1];
  return /\.(m3u8|ts|mp4|m4s)$/i.test(last);
}

/**
 * Auth-guarded HLS proxy.
 *
 * Streams the MediaMTX HLS playlist and segments (bound to localhost) through
 * the app. Because playlists reference segments relatively, they resolve back
 * under this same proxied path — so every byte flows through the session. This
 * is the guaranteed guarded playback path (works from anywhere).
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  if (!(await hasSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const segments = path ?? [];
  if (!allowedHlsPath(segments)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sub = segments.join("/");
  const qs = req.nextUrl.search; // preserve MediaMTX query params on segments
  const target = upstreamHlsUrl(sub) + qs;

  try {
    const upstream = await fetch(target, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `hls upstream ${upstream.status}` },
        { status: upstream.status === 404 ? 404 : 502 }
      );
    }

    const headers = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) headers.set("Content-Type", ct);
    // Playlists must never be cached; segments are immutable-ish but short-lived.
    headers.set("Cache-Control", "no-store");

    return new NextResponse(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json({ error: "camera server unreachable" }, { status: 502 });
  }
}
