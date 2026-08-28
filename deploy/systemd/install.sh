#!/usr/bin/env bash
#
# Installs Camio's systemd services so the camera + web app run 24/7 and
# restart on crash or reboot. Run on the Ubuntu machine, from the repo root:
#
#   sudo bash deploy/systemd/install.sh
#
set -euo pipefail

# Resolve repo root (this script lives in deploy/systemd/).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CAMIO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# The user Camio should run as = whoever owns the repo (not root).
RUN_USER="$(stat -c '%U' "$CAMIO_DIR")"

# Absolute node path (systemd has a minimal PATH).
NODE_BIN="$(command -v node || true)"
if [[ -z "$NODE_BIN" ]]; then
  echo "✖ node not found on PATH. Install Node.js first." >&2
  exit 1
fi

if [[ ! -f "$CAMIO_DIR/.env.local" ]]; then
  echo "✖ $CAMIO_DIR/.env.local not found. Create it (see .env.example) before installing." >&2
  exit 1
fi

echo "• Camio dir : $CAMIO_DIR"
echo "• Run user  : $RUN_USER"
echo "• Node      : $NODE_BIN"

for svc in camio-camera camio-app; do
  src="$SCRIPT_DIR/$svc.service"
  dst="/etc/systemd/system/$svc.service"
  echo "• Installing $dst"
  sed -e "s|__CAMIO_DIR__|$CAMIO_DIR|g" \
      -e "s|__USER__|$RUN_USER|g" \
      -e "s|__NODE__|$NODE_BIN|g" \
      "$src" > "$dst"
done

echo "• Reloading systemd"
systemctl daemon-reload
systemctl enable --now camio-camera.service
systemctl enable --now camio-app.service

echo
echo "✔ Installed. Check status with:"
echo "    systemctl status camio-camera camio-app"
echo "    journalctl -u camio-camera -f"
