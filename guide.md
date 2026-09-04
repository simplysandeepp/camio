# Camio Security Camera Guide

This guide provides simple commands to start and stop your `local-cam` security camera container, as well as the flow to securely connect it using Tailscale.

## 1. Tailscale Connectivity Flow

Using Tailscale allows you to securely access your camera stream from anywhere without opening vulnerable ports on your router. 

1. **Start Tailscale (if not already running):**
   ```bash
   sudo tailscale up
   ```
2. **Find your Tailscale IP Address:**
   ```bash
   tailscale ip -4
   ```
   *(For the command below, we use `100.89.229.35` based on your previous usage. If your Tailscale IP changes, update the `-p` flag).*

## 2. Starting the Camera

Run the following command from your `~/projects/camio` directory. 
By using `-p 100.89.229.35:8081:8081`, you are explicitly binding the camera's feed to your private Tailscale network, meaning nobody can view it unless they are authenticated on your Tailscale account.

```bash
docker run -d \
  --name security-cam \
  --restart unless-stopped \
  --device=/dev/video2 \
  -p 100.89.229.35:8081:8081 \
  -v $(pwd)/docker-camera/motion.conf:/etc/motion/motion.conf \
  local-cam
```

## 3. Stopping the Camera

To temporarily stop the camera container:
```bash
docker stop security-cam
```

To permanently remove the container (so it doesn't automatically restart next time your server boots):
```bash
docker stop security-cam
docker rm security-cam
```

## 4. Stopping All Containers / Docker (Optional)

If you ever need to stop **all** running containers at once:
```bash
docker stop $(docker ps -q)
```

If you need to completely shut down the Docker service on your server:
```bash
sudo systemctl stop docker
sudo systemctl stop docker.socket
```
(To start Docker back up later, run `sudo systemctl start docker`).
