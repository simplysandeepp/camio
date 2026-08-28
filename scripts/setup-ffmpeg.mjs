/**
 * Ensures an ffmpeg binary is available for Camio.
 *
 * - macOS: downloads a static ffmpeg build into ./bin (nothing installed
 *   system-wide — stays inside the project folder).
 * - Linux: ffmpeg is one apt command; if it's not on PATH we just say so.
 *
 * Safe to re-run: skips the download if ffmpeg is already available.
 */

import { mkdir, chmod, rm, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN_DIR = path.join(ROOT, "bin");
const BIN_PATH = path.join(BIN_DIR, "ffmpeg");

async function exists(p) {
  try { await stat(p); return true; } catch { return false; }
}
function onPath() {
  return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
}

async function main() {
  if (await exists(BIN_PATH)) {
    console.log("✔ ffmpeg already present at ./bin/ffmpeg");
    return;
  }
  if (onPath()) {
    console.log("✔ ffmpeg already available on PATH");
    return;
  }

  if (process.platform === "linux") {
    console.log(
      "• On Linux, install ffmpeg with:\n" +
        "    sudo apt update && sudo apt install -y ffmpeg"
    );
    return;
  }

  if (process.platform !== "darwin") {
    console.log(
      `• Please install ffmpeg for ${process.platform} and ensure it is on PATH.`
    );
    return;
  }

  // macOS: fetch a static build from evermeet.cx into ./bin.
  console.log("• Downloading a static ffmpeg for macOS into ./bin …");
  await mkdir(BIN_DIR, { recursive: true });
  const zipPath = path.join(BIN_DIR, "ffmpeg.zip");

  const dl = await fetch("https://evermeet.cx/ffmpeg/getrelease/zip", {
    headers: { "User-Agent": "camio-setup" },
  });
  if (!dl.ok || !dl.body) throw new Error(`download failed: HTTP ${dl.status}`);
  await pipeline(Readable.fromWeb(dl.body), createWriteStream(zipPath));

  const unzip = spawnSync("unzip", ["-o", zipPath, "-d", BIN_DIR], {
    encoding: "utf8",
  });
  if (unzip.status !== 0) throw new Error(`unzip failed: ${unzip.stderr || unzip.stdout}`);

  if (!(await exists(BIN_PATH))) {
    throw new Error("expected ./bin/ffmpeg after unzip but it wasn't there");
  }
  await chmod(BIN_PATH, 0o755);
  await rm(zipPath, { force: true });

  const v = spawnSync(BIN_PATH, ["-version"], { encoding: "utf8" });
  console.log(
    `✔ Installed ffmpeg → ./bin/ffmpeg (${(v.stdout || "").split("\n")[0] || "ok"})`
  );
}

main().catch((err) => {
  console.error("✖ setup-ffmpeg failed:", err.message);
  console.error("  You can instead install ffmpeg yourself (macOS: brew install ffmpeg).");
  process.exit(1);
});
