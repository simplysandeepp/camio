# 📹 Camio

![CI](https://github.com/simplysandeepp/camio/actions/workflows/ci.yml/badge.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20.12-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js&logoColor=white)
![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

A self-hosted, multi-camera, multi-user security-camera application. It turns
any machine with a webcam into a private live-streaming camera reachable over
a WireGuard-based mesh (Tailscale) — no cloud hosting, no public ports, no
recurring cost.

> [!TIP]
> **Want to just install and run it without using the terminal?**
> 👉 **[Download the Camio Desktop Installer (Linux & macOS)](https://github.com/simplysandeepp/camio-desktop/releases/latest)**

```
camera(s) ──ffmpeg──▶ MediaMTX ──▶ WebRTC (WHEP) + HLS
                                         │
                    Next.js app: auth-guarded proxy + dashboard
                                         │
                         Tailscale private network (WireGuard)
                                         │
                            browser, anywhere, any network
```

---

## Contents

- [Architecture](#architecture)
- [Stack](#stack)
- [Security model](#security-model)
- [Project layout](#project-layout)
- [Quick start](#quick-start-macos-dev)
- [Production deploy](#production-deploy-ubuntu-247)
- [Configuration reference](#configuration-reference)
- [API routes](#api-routes)
- [Scripts](#scripts)
- [Testing & CI](#testing--ci)

---

## Architecture

Three processes, each with one job:

| Process | Runtime | Responsibility |
|---|---|---|
| **ffmpeg** (N instances) | native binary | Grabs frames from a local camera (`avfoundation` on macOS, `v4l2` on Linux), encodes H.264, publishes RTSP to MediaMTX. One process per configured camera, supervised independently with exponential backoff. |
| **MediaMTX** | native binary | Media server. Ingests the RTSP feed(s) and re-serves them as WebRTC (WHEP, sub-second latency) and HLS (a few seconds, universally compatible). Bound to `127.0.0.1` by default — never reachable off-box directly. |
| **Camio** | Next.js 15 (App Router, Node runtime) | Auth, session management, and a same-origin reverse proxy in front of MediaMTX. This is the *only* thing exposed on the network; the media server is invisible behind it. |

Two independent processes (`npm run camera`, `npm start`) coordinate purely
through environment variables (`.env.local`) — there is no IPC or shared
state, so either can be restarted without affecting the other. `systemd`
supervises both in production (see [Production deploy](#production-deploy-ubuntu-247)).

### Why proxy the stream instead of exposing MediaMTX directly?

Because then the video would only be one login-bypass away from public. By
keeping MediaMTX on loopback and having every video byte pass through the
authenticated Next.js routes, a network-level compromise of MediaMTX's ports
is a non-issue — they're not reachable from outside the host in the first
place. See [Security model](#security-model) for the full rationale,
including the one exception (WebRTC media is peer-to-peer and can't be
proxied — HLS is the guaranteed-guarded path).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Web framework | Next.js 15 / React 19 | App Router route handlers double as a lightweight API + reverse proxy; no separate backend process. |
| Media server | [MediaMTX](https://github.com/bluenviron/mediamtx) | Single static binary, WHEP + HLS out of the box, a localhost control API for real status/uptime. Auto-downloaded per-OS into `./bin`. |
| Capture | ffmpeg | Auto-downloaded (macOS) or `apt`-installed (Linux) into `./bin`; never a hard system dependency. |
| Auth | `node:crypto` scrypt + [`jose`](https://github.com/panva/jose) HS256 JWT | No native deps (no bcrypt), no external auth service. JWT verification is Edge-safe and runs in `middleware.ts`; scrypt stays Node-only. |
| Client playback | Native `RTCPeerConnection` (WHEP) + [`hls.js`](https://github.com/video-dev/hls.js) fallback | Real-time first, resilient always. |
| Remote network | [Tailscale](https://tailscale.com) | Private WireGuard mesh — the host never opens a router port or touches public DNS. |
| Lint | [Biome](https://biomejs.dev) | Single dependency, non-interactive (replaces the now-deprecated, interactive `next lint`). |
| Tests | `node:test` + `tsx` | Zero extra runtime deps; covers password hashing, rate limiting, and MediaMTX config generation. |
| CI | GitHub Actions | Lint + typecheck + test + build on Node 20 and 22. |

## Security model

Two independent layers, plus a proxy boundary:

1. **Network** — Tailscale. The host is invisible to the public internet;
   only devices signed into the same tailnet can reach it at all.
2. **Application** — every route requires a signed session cookie
   (`src/middleware.ts`), checked a *second* time inside the stream/status
   route handlers themselves (`src/lib/guard.ts`) so a middleware regression
   alone can't leak video.

Specifics:

- Passwords: **scrypt** (`node:crypto`, no native dependency), random salt
  per hash, `timingSafeEqual` comparison. Stored as `scrypt:<salt>:<hash>`
  (`:`-delimited on purpose — Next's `dotenv-expand` treats `$` as variable
  interpolation and will silently corrupt a `$`-delimited hash).
- Sessions: HS256 JWT in an `httpOnly`, `sameSite=lax` cookie. Unknown
  usernames still run a full scrypt verify against a dummy hash, so login
  response time doesn't leak which accounts exist.
- Login rate limiting is **keyed on the account**, not `X-Forwarded-For`
  (that header is client-spoofable unless `TRUSTED_PROXY=true` is explicitly
  set) — 10 attempts / 15 min, with a size-capped, self-pruning bucket map.
- MediaMTX binds RTSP / HLS / WebRTC / its control API to `127.0.0.1` by
  default (`MEDIAMTX_LOCALHOST_ONLY=true`). HLS and WHEP-signaling are
  reverse-proxied through auth-guarded Next.js routes with strict path
  validation (rejects traversal, unknown camera ids, non-media suffixes).
  WebRTC *media* itself is peer-to-peer and cannot be proxied — remote
  viewers automatically fall back to the guarded HLS path; opting into
  direct WebRTC exposure over the tailnet is a deliberate, documented env flag.
- Response headers: `X-Frame-Options: DENY`, a restrictive CSP
  (`frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`.
- `/api/health` is the only unauthenticated route, and returns nothing
  beyond a liveness flag — no ports, stream names, or camera ids.

## Project layout

```
scripts/
  camera.mjs           # orchestrates MediaMTX + one ffmpeg per camera, with
                        # independent crash-restart/backoff per camera
  lib/config.mjs        # Node-side env → config (mirrors src/lib/config.ts)
  setup-mediamtx.mjs     setup-ffmpeg.mjs    list-cameras.mjs
  hash-password.mjs     # single-user credentials, or --add-to for multi-user

src/
  app/
    page.tsx             # dashboard: a grid of <CameraPlayer>+<StatusPanel>
    login/page.tsx
    api/
      auth/{login,logout}/route.ts
      cameras/route.ts                        # list configured cameras
      stream/whep/route.ts                    # WHEP proxy, default camera
      stream/whep/[camera]/route.ts           # WHEP proxy, named camera
      stream/status/route.ts                  # status, default camera
      stream/status/[camera]/route.ts         # status, named camera
      stream/hls/[...path]/route.ts           # HLS playlist + segment proxy
      health/route.ts
  components/
    CameraPlayer.tsx     # WHEP-first, hls.js fallback, idempotent recovery
    StatusPanel.tsx       LogoutButton.tsx
  lib/
    config.ts            # camera list resolution (env-driven, TS side)
    auth.ts    password.ts    users.ts    rate-limit.ts    guard.ts
    stream.ts             stream-proxy.ts
  middleware.ts           # route guard (Edge runtime)

deploy/systemd/           # camio-camera.service, camio-app.service, install.sh
test/                      # node:test suite
.github/workflows/ci.yml
```

## Quick start (macOS, dev)

```bash
npm install
npm run camera:setup         # fetches MediaMTX + ffmpeg into ./bin (no system install)

cp .env.example .env.local
npm run auth:setup           # prints CAMIO_PASSWORD_HASH + SESSION_SECRET — paste into .env.local

# terminal 1
npm run camera                # MediaMTX + ffmpeg capture
# terminal 2
npm run dev                   # Next.js dev server, binds 0.0.0.0
```

Open `http://localhost:3000`, log in. `npm run camera:list` prints the
`avfoundation` device index to set as `CAMERA_DEVICE`.

## Production deploy (Ubuntu, 24/7)

```bash
git clone https://github.com/simplysandeepp/camio.git && cd camio
npm ci
npm run camera:setup                        # or: sudo apt install -y ffmpeg
npm run camera:list                         # find /dev/videoN

cp .env.example .env.local
npm run auth:setup                          # or --add-to users.json for multiple accounts
# set CAMERA_SOURCE=linux, CAMERA_DEVICE=/dev/videoN in .env.local

npm run build
curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up

sudo bash deploy/systemd/install.sh          # installs + enables camio-camera + camio-app,
                                              # Restart=always, starts on boot
```

Watch from any device on the same tailnet: `http://<tailscale-hostname>:3000`.
`journalctl -u camio-camera -f` / `-u camio-app -f` for logs.

## Configuration reference

All variables live in `.env.local` (see `.env.example` for the annotated,
copy-pasteable version).

| Variable | Default | Purpose |
|---|---|---|
| `CAMERA_SOURCE` | `mac` | `mac` → `avfoundation`, `linux` → `v4l2`. The one switch that makes the same code run on both OSes. |
| `CAMERA_DEVICE` | `0` (mac) / `/dev/video0` (linux) | Capture device for the default camera. |
| `CAMERA_RESOLUTION`, `CAMERA_FPS` | `1280x720`, `25` | Capture settings; lower = less CPU/heat for 24/7 operation. |
| `CAMERAS` | *(unset)* | JSON array `[{id,label?,device?,resolution?,fps?}]` for multiple cameras. Unset → a single camera is synthesized from the vars above; every existing single-camera setup keeps working unchanged. |
| `STREAM_NAME` | `cam` | MediaMTX path name for the default/single camera. |
| `APP_PORT` | `3000` | Next.js app port. |
| `RTSP_PORT` / `WEBRTC_PORT` / `HLS_PORT` / `MEDIAMTX_API_PORT` | `8554` / `8889` / `8888` / `9997` | MediaMTX ports — all loopback-bound by default. |
| `MEDIAMTX_LOCALHOST_ONLY` | `true` | Lockdown switch. `false` exposes only the WebRTC port beyond loopback (for real-time playback over the tailnet). |
| `WEBRTC_ADDITIONAL_HOSTS` | *(unset)* | Extra ICE candidate host (e.g. the machine's Tailscale IP) — required if `MEDIAMTX_LOCALHOST_ONLY=false`. |
| `CAMIO_USER` / `CAMIO_PASSWORD_HASH` | `admin` / *(unset)* | Single-user login. Generate the hash with `npm run auth:setup`. |
| `CAMIO_USERS` / `CAMIO_USERS_FILE` | *(unset)* | Multi-user login: inline JSON or a path to a JSON file (`[{username,hash,role?}]`). Takes priority over the single-user vars; unset → falls back to them. |
| `SESSION_SECRET` | *(unset)* | HS256 signing key for session JWTs. Generated by `auth:setup`. |
| `SESSION_TTL_HOURS` | `168` | Session lifetime. |
| `SESSION_COOKIE_SECURE` | `false` | Set `true` only behind HTTPS/TLS; plain-HTTP Tailscale/LAN needs `false`. |
| `TRUSTED_PROXY` | `false` | Set `true` only if a real reverse proxy sits in front and sets `X-Forwarded-For` — otherwise that header is ignored (spoofable). |

## API routes

All routes below require a valid session cookie **except** `/api/health` and
`/api/auth/login`. Each stream/status/cameras route re-verifies the session
independently of `middleware.ts` (defense in depth).

| Route | Method | Purpose |
|---|---|---|
| `/api/health` | `GET` | Unauthenticated liveness probe. |
| `/api/auth/login` | `POST` | `{username,password}` → sets session cookie. Rate-limited per account. |
| `/api/auth/logout` | `POST` | Clears the session cookie. |
| `/api/cameras` | `GET` | Lists configured `{id,label}` pairs. |
| `/api/stream/whep`, `/api/stream/whep/[camera]` | `POST` | Proxies a WebRTC SDP offer to MediaMTX's WHEP endpoint for the (default / named) camera; body capped at 64 KB. |
| `/api/stream/status`, `/api/stream/status/[camera]` | `GET` | Reads MediaMTX's control API for real `online`/`uptime`/`readers`. |
| `/api/stream/hls/[...path]` | `GET` | Proxies HLS playlists and segments; validates the path against configured camera ids and allowed extensions (`.m3u8`/`.ts`/`.mp4`/`.m4s`), rejects traversal. |

## Scripts

| Command | Description |
|---|---|
| `npm run camera:setup` | Download MediaMTX + ffmpeg into `./bin`. |
| `npm run camera:list` | List available camera devices. |
| `npm run camera` | Run the camera pipeline (MediaMTX + one supervised ffmpeg per camera). |
| `npm run auth:setup` | Generate single-user credentials, or `-- --user <name> --add-to <file>` to manage a multi-user `users.json`. |
| `npm run dev` | Next.js dev server (`0.0.0.0`). |
| `npm run build` / `npm start` | Production build / start (`scripts/start.mjs`, binds `APP_PORT` on all interfaces). |
| `npm run lint` | Biome. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | `node:test` suite. |

## Testing & CI

`npm test` runs a `node:test` suite covering password hashing (round-trip,
malformed-hash rejection), the rate limiter (cap, reset, per-key isolation),
and MediaMTX config generation (per-OS ffmpeg args, localhost binding,
multi-camera path rendering). GitHub Actions (`.github/workflows/ci.yml`)
runs lint, typecheck, tests, and a production build on Node 20 and 22 for
every push and pull request against `main`.

## License

All Rights Reserved — source is public for reference, no reuse or
redistribution without written permission. See [`LICENSE`](./LICENSE).
