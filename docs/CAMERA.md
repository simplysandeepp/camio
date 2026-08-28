# Camera pipeline

How Camio turns a webcam into a browser-playable stream.

```
  camera ──ffmpeg (capture + H.264)──► MediaMTX ──► WebRTC (real-time, WHEP)
                                                └──► HLS (fallback, /index.m3u8)
```

- **ffmpeg** grabs frames from the OS camera interface and encodes H.264.
- **MediaMTX** is a small single-binary media server that re-serves that feed as
  WebRTC (sub-second latency) and HLS (a few seconds, but works everywhere).
- Both are driven entirely by env vars (see `.env.example`), so the same commands
  work on macOS (dev) and Ubuntu (prod).

## One-time setup

```bash
npm run camera:setup     # downloads the MediaMTX binary for this OS into ./bin
```

Install **ffmpeg** if you don't have it:

- macOS:  `brew install ffmpeg`
- Ubuntu: `sudo apt update && sudo apt install -y ffmpeg`

## Pick your camera

```bash
npm run camera:list
```

- **macOS** prints devices as `[0] FaceTime HD Camera`, `[1] USB Cam`, … — put the
  number in `CAMERA_DEVICE` (e.g. `CAMERA_DEVICE=0`).
- **Ubuntu** lists `/dev/videoN` paths — use e.g. `CAMERA_DEVICE=/dev/video0`.

## Run it

```bash
npm run camera
```

You should see MediaMTX and ffmpeg start. Endpoints:

- WebRTC: `http://localhost:8889/cam`
- HLS:    `http://localhost:8888/cam/index.m3u8`

> **macOS first run:** the system asks for camera permission for your terminal.
> Allow it (System Settings → Privacy & Security → Camera), then re-run.

Press `Ctrl+C` to stop; both processes shut down together.

## Env knobs (all optional; sensible defaults)

| Var | Default (mac) | Default (linux) | Meaning |
|-----|---------------|-----------------|---------|
| `CAMERA_SOURCE` | `mac` | `linux` | Selects `avfoundation` vs `v4l2` |
| `CAMERA_DEVICE` | `0` | `/dev/video0` | Which camera |
| `CAMERA_RESOLUTION` | `1280x720` | `1280x720` | Capture size |
| `CAMERA_FPS` | `25` | `25` | Frame rate |
| `RTSP_PORT` / `WEBRTC_PORT` / `HLS_PORT` | `8554` / `8889` / `8888` | same | Ports |
| `STREAM_NAME` | `cam` | `cam` | MediaMTX path name |
| `WEBRTC_ADDITIONAL_HOSTS` | — | — | Extra ICE hosts (set to the Tailscale `100.x.x.x` IP on Ubuntu) |

MediaMTX config is **generated** at run time into `bin/mediamtx.generated.yml`
from these values — never edited by hand, always in sync with your `.env.local`.
