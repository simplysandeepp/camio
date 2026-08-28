/**
 * Lists the camera devices ffmpeg can see, so you can pick CAMERA_DEVICE.
 *
 *   npm run camera:list
 *
 * On macOS the video devices print as "[N] Device Name" — use N as CAMERA_DEVICE.
 * On Linux it lists the /dev/videoN paths.
 */

import { spawnSync } from "node:child_process";
import { ffmpegBin } from "./lib/config.mjs";

const FFMPEG = ffmpegBin();

function haveFfmpeg() {
  return spawnSync(FFMPEG, ["-version"], { stdio: "ignore" }).status === 0;
}

if (!haveFfmpeg()) {
  console.error("✖ ffmpeg not found. Get it with:");
  console.error(
    process.platform === "linux"
      ? "    sudo apt update && sudo apt install -y ffmpeg   (or: npm run camera:setup)"
      : "    npm run camera:setup   (fetches ffmpeg into ./bin)"
  );
  process.exit(1);
}

if (process.platform === "darwin") {
  console.log("• macOS camera/AV devices (use the [N] index as CAMERA_DEVICE):\n");
  // ffmpeg prints the device list to stderr and exits non-zero by design.
  const r = spawnSync(
    FFMPEG,
    ["-hide_banner", "-f", "avfoundation", "-list_devices", "true", "-i", ""],
    { encoding: "utf8" }
  );
  process.stdout.write(r.stderr || r.stdout || "");
} else {
  console.log("• Linux video devices:\n");
  const v = spawnSync("v4l2-ctl", ["--list-devices"], { encoding: "utf8" });
  if (v.status === 0) {
    process.stdout.write(v.stdout);
  } else {
    console.log("  (install v4l-utils for names: sudo apt install -y v4l-utils)");
    const ls = spawnSync("sh", ["-c", "ls -1 /dev/video* 2>/dev/null"], { encoding: "utf8" });
    process.stdout.write(ls.stdout || "  no /dev/video* devices found\n");
  }
}
