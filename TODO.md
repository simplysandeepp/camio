# ✅ Camio — Build Roadmap

Each step = its own feature branch → Pull Request against `main` → reviewed & merged.

Status legend: ⬜ todo · 🟡 in progress · ✅ done

---

## Step 0 — Repo setup + roadmap 🟡
- [x] `git init`, identity = `simplysandeepp`
- [x] Create private GitHub repo `camio`
- [x] `README.md`, `TODO.md`, `.gitignore`
- [ ] First commit on `main`, push

## Step 1 — Next.js scaffold + env config  (branch `feat/scaffold`)
- [ ] Next.js (TypeScript, App Router) app
- [ ] `.env.example` with `CAMERA_SOURCE` (`mac` | `linux`) + camera device + ports
- [ ] Base layout, minimal styling, `/api/health` route
- [ ] Config module that reads env and derives the ffmpeg input per-OS

## Step 2 — Camera pipeline  (branch `feat/camera`) ✅
- [x] MediaMTX downloader (`npm run camera:setup`)
- [x] Generated MediaMTX config publishing `cam` as WebRTC (WHEP) + HLS
- [x] Cross-platform launcher: `avfoundation` on Mac, `v4l2` on Linux
- [x] `npm run camera` + `npm run camera:list`; MediaMTX boot/ports verified

## Step 3 — Authentication  (branch `feat/auth`) ✅
- [x] Login page (user ID + password)
- [x] Credentials hashed (scrypt, no native dep) from env; no plaintext in code
- [x] Signed JWT session cookie (httpOnly, sameSite, secure-optional)
- [x] Middleware: every route except `/login`, `/api/auth/login`, `/api/health`
- [x] Login rate-limiting (per-IP, in-memory)
- [x] `npm run auth:setup` credential generator

## Step 4 — Live dashboard + player  (branch `feat/dashboard`) ✅
- [x] WebRTC (WHEP) player, real-time
- [x] Automatic HLS fallback (hls.js) with 6s timeout
- [x] Camera status (real, via MediaMTX localhost API), uptime, viewers, live badge
- [x] Logout

## Step 5 — Stream guard  (branch `feat/stream-guard`) ✅
- [x] MediaMTX bound to 127.0.0.1 (lockdown, opt-out for tailnet WebRTC)
- [x] Auth-guarded HLS proxy (`/api/stream/hls/*`) — full playlist+segment chain
- [x] Auth-guarded WHEP signaling proxy (`/api/stream/whep`)
- [x] Player uses same-origin proxied paths; raw ports unreachable off-box
- [x] `docs/SECURITY.md`

## Step 6 — 24/7 run assets + deploy docs  (branch `feat/run247`) ✅
- [x] `systemd` units (camera, app) with `Restart=always`, start-on-boot
- [x] `deploy/systemd/install.sh` templating installer
- [x] `scripts/start.mjs` prod wrapper (binds APP_PORT on 0.0.0.0)
- [x] `docs/DEPLOY-UBUNTU.md`: install list, env, Tailscale, systemd enable
- [x] `docs/TESTING.md`: Mac camera + Android-over-mobile-data test

---

### Later / optional
- [ ] Motion detection + snapshot alerts
- [ ] Recording to disk on motion
- [ ] Multiple cameras
- [ ] Multiple user accounts
