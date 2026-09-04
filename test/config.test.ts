import { test } from "node:test";
import assert from "node:assert/strict";
import { ffmpegInputArgs, config } from "../src/lib/config.ts";

test("ffmpegInputArgs supports passing explicit camera configs instead of global default", () => {
  const customConfig = {
    source: "mac" as const,
    device: "1",
    resolution: "1920x1080",
    fps: "60"
  };
  
  const args = ffmpegInputArgs(customConfig);
  assert.ok(args.includes("1:none"));
  assert.ok(args.includes("1920x1080"));
  assert.ok(args.includes("60"));
  
  // also fallback works
  const fallbackArgs = ffmpegInputArgs();
  assert.ok(fallbackArgs.includes(config.device === "0" ? "0:none" : config.device));
});
