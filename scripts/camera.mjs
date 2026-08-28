/**
 * Camio camera pipeline launcher.
 *
 *   camera ──ffmpeg──► MediaMTX ──► WebRTC (real-time) + HLS (fallback)
 *
 * Starts MediaMTX (the media server) and then ffmpeg (which captures the local
 * camera and publishes it to MediaMTX over RTSP). Works on macOS (avfoundation)
 * and Ubuntu (v4l2) purely from env — see .env.local / .env.example.
 *
 *   npm run camera:setup   # once: download the MediaMTX binary
 *   npm run camera         # start the pipeline
 */

import { spawn, spawnSync } from "node:child_process";
import { writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  readConfig,
  ffmpegInputArgs,
  rtspPublishUrl,
  renderMediamtxConfig,
} from "./lib/config.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MEDIAMTX = path.join(ROOT, "bin", "mediamtx");
const GENERATED_YML = path.join(ROOT, "bin", "mediamtx.generated.yml");

// Load .env.local if present (Node 20.12+ / 24 built-in, no dependency).
try {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
} catch {
  /* no .env.local — fall back to process env / defaults */
}

const cfg = readConfig();

function has(cmd) {
  return spawnSync(cmd, ["-version"], { stdio: "ignore" }).status === 0;
}
async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}

function preflightOrExit(mediamtxPresent, ffmpegPresent) {
  const problems = [];
  if (!ffmpegPresent) {
    problems.push(
      "ffmpeg not found.\n" +
        (cfg.source === "linux"
          ? "    Install:  sudo apt update && sudo apt install -y ffmpeg"
          : "    Install:  brew install ffmpeg")
    );
  }
  if (!mediamtxPresent) {
    problems.push("MediaMTX not found.\n    Install:  npm run camera:setup");
  }
  if (problems.length) {
    console.error("\n✖ Camio camera pipeline can't start:\n");
    for (const p of problems) console.error("  • " + p + "\n");
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n• Shutting down camera pipeline …");
  for (const c of children) {
    try { c.kill("SIGTERM"); } catch { /* already gone */ }
  }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  const mediamtxPresent = await exists(MEDIAMTX);
  const ffmpegPresent = has("ffmpeg");
  preflightOrExit(mediamtxPresent, ffmpegPresent);

  await writeFile(GENERATED_YML, renderMediamtxConfig(cfg), "utf8");

  console.log("📹 Camio camera pipeline");
  console.log(`   source     : ${cfg.source}  (device ${cfg.device})`);
  console.log(`   capture    : ${cfg.resolution} @ ${cfg.fps}fps`);
  console.log(`   WebRTC     : http://localhost:${cfg.ports.webrtc}/${cfg.streamName}`);
  console.log(`   HLS        : http://localhost:${cfg.ports.hls}/${cfg.streamName}/index.m3u8`);
  console.log("");

  // 1) MediaMTX
  const mtx = spawn(MEDIAMTX, [GENERATED_YML], { stdio: "inherit" });
  children.push(mtx);
  mtx.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`✖ MediaMTX exited (code ${code}).`);
      shutdown(1);
    }
  });

  // 2) ffmpeg — give MediaMTX a moment to bind its RTSP port first.
  await new Promise((r) => setTimeout(r, 1200));

  const ffArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    ...ffmpegInputArgs(cfg),
    // Encode to H.264 for WebRTC/HLS; tuned for low latency + steady 24/7 use.
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-g", String(Number(cfg.fps) * 2),
    "-f", "rtsp",
    "-rtsp_transport", "tcp",
    rtspPublishUrl(cfg),
  ];

  console.log("• Starting ffmpeg capture → " + rtspPublishUrl(cfg));
  if (cfg.source === "mac") {
    console.log("  (macOS may prompt for camera permission the first time.)");
  }
  const ff = spawn("ffmpeg", ffArgs, { stdio: "inherit" });
  children.push(ff);
  ff.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`✖ ffmpeg exited (code ${code}). Check the camera device/permission.`);
      shutdown(1);
    }
  });

  console.log("\n✔ Pipeline running. Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error("✖ camera pipeline error:", err.message);
  shutdown(1);
});
