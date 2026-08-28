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

## Step 2 — Camera pipeline  (branch `feat/camera`)
- [ ] Bundle / document MediaMTX
- [ ] `mediamtx.yml` publishing a `cam` path as WebRTC (WHEP) + HLS
- [ ] Cross-platform launcher: `avfoundation` on Mac, `v4l2` on Linux
- [ ] `npm run camera` script; verify stream locally

## Step 3 — Authentication  (branch `feat/auth`)
- [ ] Login page (user ID + password)
- [ ] Credentials hashed (bcrypt) from env; no plaintext secrets in code
- [ ] Signed JWT session cookie (httpOnly, secure)
- [ ] Middleware: every route except `/login` requires a valid session
- [ ] Login rate-limiting

## Step 4 — Live dashboard + player  (branch `feat/dashboard`)
- [ ] WebRTC (WHEP) player, real-time
- [ ] Automatic HLS fallback (hls.js)
- [ ] Camera status, uptime, connection indicator
- [ ] Logout

## Step 5 — Stream guard  (branch `feat/stream-guard`)
- [ ] Proxy/guard WebRTC + HLS endpoints behind the session
- [ ] Raw stream URLs unreachable without logging in

## Step 6 — 24/7 run assets + deploy docs  (branch `feat/run247`)
- [ ] `systemd` units (camera, app) with `Restart=always`, start-on-boot
- [ ] Mac dev scripts
- [ ] `docs/DEPLOY-UBUNTU.md`: install list, env, Tailscale, systemd enable
- [ ] `docs/TESTING.md`: Mac camera + Android-over-mobile-data test

---

### Later / optional
- [ ] Motion detection + snapshot alerts
- [ ] Recording to disk on motion
- [ ] Multiple cameras
- [ ] Multiple user accounts
