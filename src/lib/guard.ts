/**
 * Per-route session guard — defense-in-depth on top of middleware.
 *
 * The middleware already gates every route, but the live camera feed is the
 * crown-jewel asset, so the stream/status routes verify the session again
 * themselves. A middleware regression or bypass then still can't expose video.
 */

import { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

export async function hasSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return (await verifySessionToken(token)) !== null;
}
