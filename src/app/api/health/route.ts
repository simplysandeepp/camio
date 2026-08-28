import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public, unauthenticated liveness probe — intentionally minimal so it doesn't
// disclose internal topology (ports, stream names) to anonymous callers.
export function GET() {
  return NextResponse.json({ status: "ok", app: "camio" });
}
