/**
 * Stream URLs.
 *
 * Browser-facing URLs are **same-origin proxy paths** on the Camio app, so the
 * video is only reachable through the authenticated session — the raw MediaMTX
 * ports stay bound to localhost. Upstream URLs (localhost MediaMTX) are used
 * server-side by the proxy routes.
 *
 * The default (first-configured) camera keeps the short, un-parameterized
 * paths for backward compatibility; additional cameras get `/:id` paths.
 */

import { config } from "@/lib/config";

export interface StreamUrls {
  whep: string; // POST SDP here (proxied to MediaMTX WHEP)
  hls: string; // HLS playlist (proxied)
}

function isDefaultCamera(cameraId: string): boolean {
  return cameraId === config.cameras[0].id;
}

export function streamUrls(cameraId: string = config.streamName): StreamUrls {
  return {
    whep: isDefaultCamera(cameraId) ? "/api/stream/whep" : `/api/stream/whep/${cameraId}`,
    hls: `/api/stream/hls/${cameraId}/index.m3u8`,
  };
}

/** Auth-guarded status endpoint path for a camera (used by the dashboard). */
export function statusUrl(cameraId: string = config.streamName): string {
  return isDefaultCamera(cameraId) ? "/api/stream/status" : `/api/stream/status/${cameraId}`;
}

const LOCAL = "127.0.0.1";

/** MediaMTX WHEP endpoint on localhost (server-side proxy target). */
export function upstreamWhepUrl(cameraId: string = config.streamName): string {
  return `http://${LOCAL}:${config.ports.webrtc}/${cameraId}/whep`;
}

/** MediaMTX HLS URL on localhost for a given sub-path (server-side proxy). */
export function upstreamHlsUrl(subPath: string): string {
  const clean = subPath.replace(/^\/+/, "");
  return `http://${LOCAL}:${config.ports.hls}/${clean}`;
}

/** MediaMTX control API base — localhost, server-side only. */
export function mediamtxApiBase(): string {
  return `http://${LOCAL}:${config.ports.api}`;
}
