/**
 * Stream URLs.
 *
 * Browser-facing URLs are **same-origin proxy paths** on the Camio app, so the
 * video is only reachable through the authenticated session — the raw MediaMTX
 * ports stay bound to localhost. Upstream URLs (localhost MediaMTX) are used
 * server-side by the proxy routes.
 */

import { config } from "@/lib/config";

/** What the browser/player uses — all behind the app's auth middleware. */
export interface StreamUrls {
  whep: string; // POST SDP here (proxied to MediaMTX WHEP)
  hls: string; // HLS playlist (proxied)
}

export function streamUrls(): StreamUrls {
  const name = config.streamName;
  return {
    whep: "/api/stream/whep",
    hls: `/api/stream/hls/${name}/index.m3u8`,
  };
}

const LOCAL = "127.0.0.1";

/** MediaMTX WHEP endpoint on localhost (server-side proxy target). */
export function upstreamWhepUrl(): string {
  return `http://${LOCAL}:${config.ports.webrtc}/${config.streamName}/whep`;
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
