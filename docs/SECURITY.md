# Security model

Camio has two independent locks, and the raw camera stream is never exposed.

## Layer 1 — network (Tailscale)
Nothing is published to the public internet. The machine joins your private
Tailscale network; only devices signed into *your* Tailscale account can reach
Camio at all. No router ports are opened, no DNS is changed.

## Layer 2 — application login
Every route requires a valid session cookie (see `docs/` / Step 3):
- Password hashed with scrypt, never stored in plaintext.
- Signed JWT session cookie, `httpOnly`.
- Per-IP login rate limiting.

## The stream itself is proxied, not exposed
MediaMTX (the media server) binds **all** its ports to `127.0.0.1` by default
(`MEDIAMTX_LOCALHOST_ONLY=true`). It is not reachable from any other machine.

The Camio app is the only thing that talks to it, and it does so behind the
login:

| Path | Route | Guard |
|------|-------|-------|
| HLS playlist + segments | `/api/stream/hls/*` → MediaMTX `127.0.0.1:8888` | session required |
| WebRTC signaling (WHEP) | `/api/stream/whep` → MediaMTX `127.0.0.1:8889` | session required |
| Camera status | `/api/stream/status` → MediaMTX API `127.0.0.1:9997` | session required |

So **HLS playback is fully guarded** — every byte passes through the
authenticated app. Verified: the raw ports listen only on `127.0.0.1`, and the
proxy paths return `401` without a session.

## WebRTC real-time: the one caveat
WebRTC media is peer-to-peer — the app can proxy the *signaling* but not the
media packets. With the default lockdown, remote WebRTC media can't be
established (its ICE candidates are localhost), so **remote viewers
automatically fall back to the guarded HLS path** (a few seconds of latency).
Local viewers (same machine) get real-time WebRTC.

If you want real-time WebRTC from your phone over Tailscale, opt in:

```env
MEDIAMTX_LOCALHOST_ONLY=false
WEBRTC_ADDITIONAL_HOSTS=100.x.x.x   # your machine's Tailscale IP
```

This exposes only the WebRTC port, and only on the **Tailscale network** (still
private to your devices). HLS and the control API stay locked to localhost.
