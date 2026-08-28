/**
 * Node-runtime mirror of src/lib/config.ts.
 *
 * The scripts (camera launcher, setup) run under plain Node and can't import
 * the app's TypeScript, so this file re-implements the same env-driven config.
 * Keep the two in sync — they intentionally share variable names and defaults.
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PKG_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

/**
 * ffmpeg to use: a project-local ./bin/ffmpeg if present (so nothing needs to
 * be installed system-wide), otherwise whatever `ffmpeg` is on PATH.
 */
export function ffmpegBin() {
  const name = process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg";
  const local = path.join(PKG_ROOT, "bin", name);
  return existsSync(local) ? local : "ffmpeg";
}

export { PKG_ROOT };

function singleDefaultCamera(defaults) {
  return [
    {
      id: defaults.streamName,
      label: defaults.streamName,
      device: defaults.device,
      resolution: defaults.resolution,
      fps: defaults.fps,
    },
  ];
}

/**
 * Resolve the list of cameras to run.
 *
 * CAMERAS env (optional): JSON array of { id, label?, device?, resolution?, fps? }.
 * Any field omitted on an entry falls back to the global CAMERA_ / STREAM_NAME
 * defaults. If CAMERAS is unset (or invalid), a single camera is synthesized
 * from those defaults — existing single-camera .env.local files are unaffected.
 */
function resolveCameras(defaults) {
  const raw = process.env.CAMERAS;
  if (!raw) return singleDefaultCamera(defaults);

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`[camio] CAMERAS is not valid JSON (${err.message}); using a single default camera.`);
    return singleDefaultCamera(defaults);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("[camio] CAMERAS must be a non-empty JSON array; using a single default camera.");
    return singleDefaultCamera(defaults);
  }

  const seen = new Set();
  return parsed.map((c, i) => {
    const id = String(c.id ?? `cam${i}`);
    if (seen.has(id)) {
      throw new Error(`[camio] duplicate camera id "${id}" in CAMERAS`);
    }
    seen.add(id);
    return {
      id,
      label: String(c.label ?? id),
      device: String(c.device ?? defaults.device),
      resolution: String(c.resolution ?? defaults.resolution),
      fps: String(c.fps ?? defaults.fps),
    };
  });
}

export function readConfig() {
  const source = env("CAMERA_SOURCE", "mac");
  const defaults = {
    streamName: env("STREAM_NAME", "cam"),
    device: env("CAMERA_DEVICE", source === "linux" ? "/dev/video0" : "0"),
    resolution: env("CAMERA_RESOLUTION", "1280x720"),
    fps: env("CAMERA_FPS", "25"),
  };
  const cameras = resolveCameras(defaults);

  return {
    source,
    cameras,
    // Back-compat single-camera fields — always the first/default camera.
    streamName: cameras[0].id,
    device: cameras[0].device,
    resolution: cameras[0].resolution,
    fps: cameras[0].fps,
    ports: {
      app: Number(env("APP_PORT", "3000")),
      rtsp: Number(env("RTSP_PORT", "8554")),
      webrtc: Number(env("WEBRTC_PORT", "8889")),
      hls: Number(env("HLS_PORT", "8888")),
      api: Number(env("MEDIAMTX_API_PORT", "9997")),
    },
    // Comma-separated extra hosts advertised in WebRTC ICE candidates.
    // On Ubuntu behind Tailscale, set this to the machine's 100.x.x.x address.
    webrtcAdditionalHosts: env("WEBRTC_ADDITIONAL_HOSTS", ""),
    // Lockdown (default): bind every MediaMTX port to 127.0.0.1 so the raw
    // stream is NOT reachable off-box — the app proxies it behind auth. Set to
    // "false" to expose the WebRTC port on the tailnet for remote real-time.
    localhostOnly: env("MEDIAMTX_LOCALHOST_ONLY", "true").toLowerCase() !== "false",
  };
}

/**
 * ffmpeg input argv for capturing a local camera on this OS. `cam` is a
 * camera-like object: { source, device, resolution, fps }.
 */
export function ffmpegInputArgs(cam) {
  const { device, resolution, fps } = cam;
  if (cam.source === "linux") {
    return [
      "-f", "v4l2",
      "-framerate", fps,
      "-video_size", resolution,
      "-i", device,
    ];
  }
  // macOS AVFoundation. "<index>:none" = that video device, no audio.
  return [
    "-f", "avfoundation",
    "-framerate", fps,
    "-video_size", resolution,
    "-i", `${device}:none`,
  ];
}

/** The RTSP URL ffmpeg publishes to (MediaMTX ingests here) for a given camera. */
export function rtspPublishUrl(cfg, cameraId = cfg.streamName) {
  return `rtsp://localhost:${cfg.ports.rtsp}/${cameraId}`;
}

/** Render a MediaMTX YAML config — one `paths:` entry per configured camera. */
export function renderMediamtxConfig(cfg) {
  const extraHosts = cfg.webrtcAdditionalHosts
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  // In lockdown, HTTP-facing services bind to loopback only. RTSP (ffmpeg
  // publishes from localhost) and the API (app reads it from localhost) are
  // ALWAYS loopback. WebRTC can optionally listen on all interfaces so a
  // Tailscale viewer can get real-time media (its P2P leg can't be proxied).
  const lo = "127.0.0.1";
  const webrtcBind = cfg.localhostOnly ? lo : "";

  const lines = [
    "# AUTO-GENERATED by Camio (scripts/camera.mjs) — do not edit by hand.",
    "logLevel: info",
    "api: yes",
    `apiAddress: ${lo}:${cfg.ports.api}`,
    "metrics: no",
    "playback: no",
    "rtmp: no",
    "srt: no",
    "moq: no",
    "",
    "rtsp: yes",
    `rtspAddress: ${lo}:${cfg.ports.rtsp}`,
    "rtspTransports: [tcp]",
    "",
    "hls: yes",
    `hlsAddress: ${lo}:${cfg.ports.hls}`,
    "hlsVariant: mpegts",
    "hlsAlwaysRemux: yes",
    "",
    "webrtc: yes",
    `webrtcAddress: ${webrtcBind}:${cfg.ports.webrtc}`,
    "webrtcLocalUDPAddress: :8189",
  ];
  if (extraHosts.length) {
    lines.push(`webrtcAdditionalHosts: [${extraHosts.join(", ")}]`);
  }

  lines.push("", "paths:");
  const cameras = cfg.cameras?.length ? cfg.cameras : [{ id: cfg.streamName }];
  for (const cam of cameras) {
    lines.push(`  ${cam.id}:`, "    source: publisher");
  }
  lines.push("");

  return lines.join("\n");
}
