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
npm run camera:setup         # downloads the MediaMTX media server into ./bin
brew install ffmpeg          # if not already installed

cp .env.example .env.local
npm run auth:setup           # generates your password hash + session secret
# paste those two lines into .env.local

# Terminal 1 — the camera pipeline (MediaMTX + ffmpeg)
npm run camera
# Terminal 2 — the Camio web app
npm run dev
```

Open http://localhost:3000 and log in. Full walkthrough + Android testing:
[`docs/TESTING.md`](./docs/TESTING.md).

## Production (Ubuntu, 24/7)

Pull the repo, set `CAMERA_SOURCE=linux`, install `ffmpeg` + Tailscale, then run
`sudo bash deploy/systemd/install.sh` to enable the `systemd` services (auto-start
on boot, restart on crash). Full step-by-step:
[`docs/DEPLOY-UBUNTU.md`](./docs/DEPLOY-UBUNTU.md).

## Docs
- [`docs/CAMERA.md`](./docs/CAMERA.md) — the camera pipeline
- [`docs/SECURITY.md`](./docs/SECURITY.md) — the two-layer security model
- [`docs/DEPLOY-UBUNTU.md`](./docs/DEPLOY-UBUNTU.md) — production deploy
- [`docs/TESTING.md`](./docs/TESTING.md) — Mac + Android testing

## Roadmap

See [`TODO.md`](./TODO.md) for the full step-by-step build plan. Each step is
built on its own branch, opened as a PR against `main`, and merged.

## Safety note

This project is completely independent of `sandeepp.in`, Vercel, and Render.
It changes no DNS and opens no router ports.
