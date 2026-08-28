import { NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "camio",
    cameraSource: config.source,
    streamName: config.streamName,
    ports: config.ports,
  });
}
