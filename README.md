# 📹 Camio

Self-hosted security-camera web app. Turns a machine with a webcam into a
private, login-protected live camera you can watch from anywhere — **without**
exposing anything to the public internet and **without** any paid cloud hosting.

- **Dev machine:** macOS (uses the Mac's built-in / USB camera via `avfoundation`)
- **Production machine:** Ubuntu Linux 24/7 (uses a USB webcam via `/dev/video0`)
- **Remote access:** [Tailscale](https://tailscale.com) private network (free) — no port
  forwarding, no DNS changes, nothing public.
- **Same code runs on both** — only one env variable (`CAMERA_SOURCE`) changes.

## How it works

```
  Camera ──ffmpeg──► MediaMTX ──► WebRTC (real-time) + HLS (fallback)
                                          │
                        Next.js "Camio" app (login: user + password)
                                          │
                            Tailscale private network (free)
                                          │
                     You, from your phone on mobile data, anywhere
```

Nothing is exposed to the public internet. Your machine dials into a private
Tailscale network; only your own logged-in devices can reach it, and Camio's own
login page is a second lock on top.

## Quick start (development on Mac)

```bash
npm install
cp .env.example .env.local   # then edit credentials
npm run camera               # starts the camera pipeline (MediaMTX + ffmpeg)
npm run dev                  # starts the Camio web app
```

Open http://localhost:3000 and log in.

## Production (Ubuntu) — summary

Set `CAMERA_SOURCE=linux` in `.env.local`, install `ffmpeg` + Tailscale, then
enable the provided `systemd` services so everything runs 24/7 and auto-restarts.
Full walkthrough lands in `docs/DEPLOY-UBUNTU.md` (Step 6).

## Roadmap

See [`TODO.md`](./TODO.md) for the full step-by-step build plan. Each step is
built on its own branch, opened as a PR against `main`, and merged.

## Safety note

This project is completely independent of `sandeepp.in`, Vercel, and Render.
It changes no DNS and opens no router ports.
