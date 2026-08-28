# Deploy Camio on Ubuntu (24/7)

This runs Camio on your Ubuntu machine so you can watch your room from anywhere
over Tailscale, with the camera + app auto-starting on boot and restarting on
crash. Nothing is exposed to the public internet.

> You developed and tested on the Mac; here you just pull and set up.

## 0. Prerequisites
- Ubuntu with your USB webcam plugged in.
- A [Tailscale](https://tailscale.com) account (free).

## 1. Install dependencies
```bash
sudo apt update
sudo apt install -y ffmpeg v4l-utils git curl

# Node.js LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs
node -v
```

## 2. Get the code
```bash
git clone https://github.com/simplysandeepp/camio.git
cd camio
npm ci
npm run camera:setup     # downloads MediaMTX for Linux into ./bin
```

## 3. Find your camera
```bash
npm run camera:list      # shows /dev/videoN devices
```

## 4. Configure
```bash
cp .env.example .env.local
npm run auth:setup       # prints CAMIO_PASSWORD_HASH + SESSION_SECRET
nano .env.local
```
Set at least:
```env
CAMERA_SOURCE=linux
CAMERA_DEVICE=/dev/video0        # from step 3
CAMIO_USER=admin
CAMIO_PASSWORD_HASH=...           # from auth:setup
SESSION_SECRET=...                # from auth:setup
# Keep the lockdown default (guarded HLS). See docs/SECURITY.md.
MEDIAMTX_LOCALHOST_ONLY=true
```

## 5. Build
```bash
npm run build
```

## 6. Join Tailscale
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
tailscale ip -4          # note your 100.x.x.x address / machine name
```
Install Tailscale on your phone too, signed into the **same** account.

## 7. Run 24/7 with systemd
```bash
sudo bash deploy/systemd/install.sh
systemctl status camio-camera camio-app
```
Both services now start on boot and restart on crash.

## 8. Watch from your phone
On your phone (with Tailscale on), open:
```
http://<machine-name>:3000        e.g. http://camio-ubuntu:3000
# or  http://100.x.x.x:3000
```
Log in. You'll get the live view (guarded HLS by default).

## Optional — real-time WebRTC over Tailscale
HLS has a few seconds of latency. For real-time, opt in (see `docs/SECURITY.md`):
```env
MEDIAMTX_LOCALHOST_ONLY=false
WEBRTC_ADDITIONAL_HOSTS=100.x.x.x   # your Tailscale IP from step 6
```
Then `npm run build && sudo systemctl restart camio-camera camio-app`.

## Managing it
```bash
journalctl -u camio-camera -f       # camera logs
journalctl -u camio-app -f          # app logs
sudo systemctl restart camio-app    # after config changes
sudo systemctl stop camio-camera camio-app
```

## Updating later
```bash
cd camio && git pull && npm ci && npm run build
sudo systemctl restart camio-camera camio-app
```
