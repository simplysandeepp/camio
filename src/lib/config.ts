/**
 * Central Camio configuration.
 *
 * Reads environment variables once and derives everything the rest of the app
 * needs — most importantly the per-OS ffmpeg capture arguments, so the SAME
 * codebase runs on a Mac (development) and on Ubuntu (production) by changing
 * only `CAMERA_SOURCE` in the environment.
 */

export type CameraSource = "mac" | "linux";

function env(name: string, fallback: string): string {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

const source = env("CAMERA_SOURCE", "mac") as CameraSource;

export const config = {
  source,

  device: env("CAMERA_DEVICE", source === "linux" ? "/dev/video0" : "0"),
  resolution: env("CAMERA_RESOLUTION", "1280x720"),
  fps: env("CAMERA_FPS", "25"),

  ports: {
    app: Number(env("APP_PORT", "3000")),
    rtsp: Number(env("RTSP_PORT", "8554")),
    webrtc: Number(env("WEBRTC_PORT", "8889")),
    hls: Number(env("HLS_PORT", "8888")),
    // MediaMTX control API (localhost only) — camera status/uptime.
    api: Number(env("MEDIAMTX_API_PORT", "9997")),
  },

  streamName: env("STREAM_NAME", "cam"),
} as const;

/**
 * Build the ffmpeg input arguments for capturing the local camera on this OS.
 * These feed ffmpeg, which then publishes to MediaMTX over RTSP.
 *
 * Returned as an argv array (no shell quoting headaches).
 */
export function ffmpegInputArgs(): string[] {
  const { device, resolution, fps } = config;

  if (config.source === "linux") {
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
