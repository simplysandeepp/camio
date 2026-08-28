/**
 * Builds the browser-facing stream URLs.
 *
 * The web app is served on APP_PORT, but the video is served by MediaMTX on its
 * own WebRTC/HLS ports. Given the host the browser used to reach us, we point it
 * at the same host on those media ports.
 *
 * (Step 5 will move these behind same-origin, auth-guarded proxy paths.)
 */

import { config } from "@/lib/config";

/** Strip any port from a Host header value, keeping IPv6 brackets intact. */
function hostname(hostHeader: string): string {
  const h = hostHeader.trim();
  if (h.startsWith("[")) {
    // IPv6 literal like [::1]:3000
    return h.slice(0, h.indexOf("]") + 1);
  }
  const colon = h.lastIndexOf(":");
  return colon === -1 ? h : h.slice(0, colon);
}

export interface StreamUrls {
  whep: string; // WebRTC (WHEP) endpoint
  hls: string; // HLS playlist
}

export function streamUrls(hostHeader: string): StreamUrls {
  const host = hostname(hostHeader || "localhost");
  const { webrtc, hls } = config.ports;
  const name = config.streamName;
  return {
    whep: `http://${host}:${webrtc}/${name}/whep`,
    hls: `http://${host}:${hls}/${name}/index.m3u8`,
  };
}

/** MediaMTX control API base — always localhost, server-side only. */
export function mediamtxApiBase(): string {
  return `http://127.0.0.1:${config.ports.api}`;
}
