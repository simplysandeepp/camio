# Testing Camio (Mac dev → Android phone)

How to try Camio on your Mac and watch from your Android phone, the way you'll
use it on Ubuntu later.

## Mac: run it

Terminal 1 — the camera pipeline:
```bash
npm run camera:setup     # once: downloads MediaMTX
brew install ffmpeg      # if you don't have ffmpeg
npm run camera:list      # find your camera index (usually 0)
npm run camera
```
> macOS will ask for **camera permission** for your terminal the first time —
> allow it (System Settings → Privacy & Security → Camera), then re-run.

Terminal 2 — the web app:
```bash
cp .env.example .env.local
npm run auth:setup       # paste the output into .env.local
npm run build
npm start
```

Open http://localhost:3000, log in — you should see yourself, real-time.

## Android phone: watch it

### Option A — same Wi-Fi (quick)
1. Find your Mac's IP: `ipconfig getifaddr en0`.
2. On the phone (same Wi-Fi): `http://<mac-ip>:3000`, log in.
   - Playback uses the guarded HLS path (a few seconds' latency) by default.

### Option B — mobile data, via Tailscale (the real test)
1. Install Tailscale on the **Mac** and the **Android phone**, same account.
   ```bash
   # macOS
   brew install tailscale && sudo tailscale up
   tailscale ip -4
   ```
2. Turn Wi-Fi **off** on the phone (use mobile data), Tailscale **on**.
3. Open `http://<mac-tailscale-name>:3000` (or `http://100.x.x.x:3000`), log in.

If it works on mobile data, it'll work from anywhere.

## What to check
- [ ] Wrong password is rejected.
- [ ] After login, the live badge shows **LIVE**.
- [ ] Status panel shows **Camera online** + uptime ticking.
- [ ] Stop `npm run camera` → within ~5s the panel flips to **Camera offline**.
- [ ] The raw stream is NOT reachable without login: on the phone try
      `http://<host>:8889/` — it should fail/refuse (ports are localhost-only).

## Want real-time (not HLS) on the phone?
See the WebRTC opt-in in `docs/SECURITY.md`
(`MEDIAMTX_LOCALHOST_ONLY=false` + `WEBRTC_ADDITIONAL_HOSTS`).
