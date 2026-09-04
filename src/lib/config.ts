/**
 * Central Camio configuration.
 *
 * Reads environment variables once and derives everything the rest of the app
 * needs — most importantly the list of cameras and the per-OS ffmpeg capture
 * arguments, so the SAME codebase runs on a Mac (development) and on Ubuntu
 * (production) by changing only `CAMERA_SOURCE` in the environment.
 */

export type CameraSource = "mac" | "linux";

export interface Camera {
  id: string;
  label: string;
  device: string;
  resolution: string;
  fps: string;
}

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const source = env("CAMERA_SOURCE", "mac") as CameraSource;

interface CameraDefaults {
  streamName: string;
  device: string;
  resolution: string;
  fps: string;
}

function singleDefaultCamera(defaults: CameraDefaults): Camera[] {
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
 * Resolve the list of cameras to serve.
 *
 * `CAMERAS` env (optional): JSON array of { id, label?, device?, resolution?, fps? }.
 * Any field omitted on an entry falls back to the global defaults. If `CAMERAS`
 * is unset (or invalid), a single camera is synthesized from those defaults —
 * existing single-camera `.env.local` files behave identically.
 */
function resolveCameras(defaults: CameraDefaults): Camera[] {
  const raw = process.env.CAMERAS;
  if (!raw) return singleDefaultCamera(defaults);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    console.error(`[camio] CAMERAS is not valid JSON (${err.message}); using a single default camera.`);
    return singleDefaultCamera(defaults);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    console.error("[camio] CAMERAS must be a non-empty JSON array; using a single default camera.");
    return singleDefaultCamera(defaults);
  }

  const seen = new Set<string>();
  return parsed.map((c: Record<string, unknown>, i: number) => {
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

const defaults: CameraDefaults = {
  streamName: env("STREAM_NAME", "cam"),
  device: env("CAMERA_DEVICE", source === "linux" ? "/dev/video0" : "0"),
  resolution: env("CAMERA_RESOLUTION", "1280x720"),
  fps: env("CAMERA_FPS", "25"),
};

const cameras = resolveCameras(defaults);

export const config = {
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
    // MediaMTX control API (localhost only) — camera status/uptime.
    api: Number(env("MEDIAMTX_API_PORT", "9997")),
  },
} as const;

/** Look up a configured camera by id — returns undefined if unknown. */
export function getCamera(id: string): Camera | undefined {
  return config.cameras.find((c) => c.id === id);
}

/**
 * Build the ffmpeg input arguments for capturing the local camera on this OS.
 * These feed ffmpeg, which then publishes to MediaMTX over RTSP.
 *
 * Returned as an argv array (no shell quoting headaches).
 */
export function ffmpegInputArgs(
  camConfig: { source: CameraSource; device: string; resolution: string; fps: string } = config
): string[] {
  const { device, resolution, fps } = camConfig;

  if (camConfig.source === "linux") {
    // Video4Linux2 — the standard Linux webcam interface (/dev/videoN).
    return [
      "-f", "v4l2",
      "-framerate", fps,
      "-video_size", resolution,
      "-i", device,
    ];
  }

  // macOS — AVFoundation. Device is an index like "0"; ":" prefix means
  // "video-only, no audio". `-video_size`/`-framerate` request a matching mode.
  return [
    "-f", "avfoundation",
    "-framerate", fps,
    "-video_size", resolution,
    "-i", `${device}:none`,
  ];
}

/** The RTSP URL ffmpeg publishes to (MediaMTX ingests here). */
export function rtspPublishUrl(): string {
  return `rtsp://localhost:${config.ports.rtsp}/${config.streamName}`;
}
