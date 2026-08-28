import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";
import { hasSession } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The list of configured cameras (id + label only — no device paths). */
export async function GET(req: NextRequest) {
  if (!(await hasSession(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(config.cameras.map((c) => ({ id: c.id, label: c.label })));
}
