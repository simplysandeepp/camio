/**
 * Camio camera pipeline launcher.
 *
 *   camera(s) ──ffmpeg──► MediaMTX ──► WebRTC (real-time) + HLS (fallback)
 *
 * Starts MediaMTX (the media server) and then one ffmpeg process per configured
 * camera (see CAMERAS in .env.local; defaults to a single camera). Works on
 * macOS (avfoundation) and Ubuntu (v4l2) purely from env.
 *
 *   npm run camera:setup   # once: download MediaMTX + ffmpeg
 *   npm run camera         # start the pipeline
 *
 * Each camera's ffmpeg is supervised independently with backoff — one flaky
 * USB camera restarts on its own without taking the others down. Only MediaMTX
 * dying brings down the whole pipeline (there's nothing to serve without it).
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
  ffmpegBin,
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
const FFMPEG = ffmpegBin();

const MAX_RESTARTS = 5;
const RESTART_WINDOW_MS = 60_000;

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
      `ffmpeg not found.\n${cfg.source === "linux"
          ? "    Install:  sudo apt update && sudo apt install -y ffmpeg\n" +
            "    (or run:  npm run camera:setup)"
          : "    Install:  npm run camera:setup   (fetches ffmpeg into ./bin)"}`
    );
  }
  if (!mediamtxPresent) {
    problems.push("MediaMTX not found.\n    Install:  npm run camera:setup");
  }
  if (problems.length) {
    console.error("\n✖ Camio camera pipeline can't start:\n");
    for (const p of problems) console.error(`  • ${p}\n`);
    process.exit(1);
  }
}

let shuttingDown = false;
let mtxProc = null;
const ffState = new Map(); // cameraId -> { proc, restarts, windowStart, timer }

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n• Shutting down camera pipeline …");
  for (const state of ffState.values()) {
    if (state.timer) clearTimeout(state.timer);
    try { state.proc?.kill("SIGTERM"); } catch { /* already gone */ }
  }
  try { mtxProc?.kill("SIGTERM"); } catch { /* already gone */ }
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

function spawnFfmpegFor(camera) {
  const state = ffState.get(camera.id) ?? { restarts: 0, windowStart: Date.now() };
  ffState.set(camera.id, state);

  const publishUrl = rtspPublishUrl(cfg, camera.id);
  const ffArgs = [
    "-hide_banner",
    "-loglevel", "warning",
    ...ffmpegInputArgs({
      source: cfg.source,
      device: camera.device,
      resolution: camera.resolution,
      fps: camera.fps,
    }),
    // Encode to H.264 for WebRTC/HLS; tuned for low latency + steady 24/7 use.
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-g", String(Number(camera.fps) * 2),
    "-f", "rtsp",
    "-rtsp_transport", "tcp",
    publishUrl,
  ];

  console.log(`• [${camera.id}] starting ffmpeg capture → ${publishUrl}`);
  const proc = spawn(FFMPEG, ffArgs, { stdio: "inherit" });
  state.proc = proc;

  proc.on("exit", (code) => {
    if (shuttingDown) return;
    console.error(`✖ [${camera.id}] ffmpeg exited (code ${code}).`);

    const now = Date.now();
    if (now - state.windowStart > RESTART_WINDOW_MS) {
      state.restarts = 0;
      state.windowStart = now;
    }
    state.restarts += 1;

    if (state.restarts > MAX_RESTARTS) {
      console.error(
        `✖ [${camera.id}] crashed ${state.restarts} times in the last minute — giving up on this camera. Check its device/permission. Other cameras keep running.`
      );
      return;
    }
    const delay = Math.min(1000 * 2 ** (state.restarts - 1), 15_000);
    console.error(`  [${camera.id}] restarting in ${Math.round(delay / 1000)}s…`);
    state.timer = setTimeout(() => spawnFfmpegFor(camera), delay);
  });
}

async function main() {
  const mediamtxPresent = await exists(MEDIAMTX);
  const ffmpegPresent = has(FFMPEG);
  preflightOrExit(mediamtxPresent, ffmpegPresent);

  await writeFile(GENERATED_YML, renderMediamtxConfig(cfg), "utf8");

  console.log("📹 Camio camera pipeline");
  console.log(`   source     : ${cfg.source}`);
  for (const cam of cfg.cameras) {
    console.log(`   camera "${cam.id}" (${cam.label}) — device ${cam.device}, ${cam.resolution}@${cam.fps}fps`);
    console.log(`     WebRTC   : http://localhost:${cfg.ports.webrtc}/${cam.id}`);
    console.log(`     HLS      : http://localhost:${cfg.ports.hls}/${cam.id}/index.m3u8`);
  }
  console.log("");

  // 1) MediaMTX
  mtxProc = spawn(MEDIAMTX, [GENERATED_YML], { stdio: "inherit" });
  mtxProc.on("exit", (code) => {
    if (!shuttingDown) {
      console.error(`✖ MediaMTX exited (code ${code}).`);
      shutdown(1);
    }
  });

  // 2) ffmpeg — give MediaMTX a moment to bind its RTSP port first.
  await new Promise((r) => setTimeout(r, 1200));

  if (cfg.source === "mac") {
    console.log("  (macOS may prompt for camera permission the first time.)");
  }
  for (const cam of cfg.cameras) {
    spawnFfmpegFor(cam);
  }

  console.log("\n✔ Pipeline running. Press Ctrl+C to stop.\n");
}

main().catch((err) => {
  console.error("✖ camera pipeline error:", err.message);
  shutdown(1);
});
