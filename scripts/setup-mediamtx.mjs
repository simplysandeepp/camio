/**
 * Downloads the MediaMTX media-server binary for THIS machine into ./bin.
 *
 * MediaMTX is the engine that takes the ffmpeg camera feed and serves it to
 * browsers as WebRTC (real-time) and HLS (fallback). It's a single static
 * binary — we fetch the right build for the current OS/arch from GitHub
 * Releases. Run once per machine:  npm run camera:setup
 */

import { mkdir, chmod, rm, readdir, rename, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BIN_DIR = path.join(ROOT, "bin");
const BIN_PATH = path.join(BIN_DIR, "mediamtx");

function targetTriple() {
  const osMap = { darwin: "darwin", linux: "linux" };
  const archMap = { arm64: "arm64", x64: "amd64" };
  const os = osMap[process.platform];
  const arch = archMap[process.arch];
  if (!os || !arch) {
    throw new Error(
      `Unsupported platform ${process.platform}/${process.arch}. Download MediaMTX manually from https://github.com/bluenviron/mediamtx/releases into ./bin/mediamtx`
    );
  }
  return { os, arch };
}

async function latestRelease() {
  const res = await fetch(
    "https://api.github.com/repos/bluenviron/mediamtx/releases/latest",
    { headers: { "User-Agent": "camio-setup", Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}: could not read latest MediaMTX release`);
  return res.json();
}

async function main() {
  if (await exists(BIN_PATH)) {
    const v = spawnSync(BIN_PATH, ["--version"], { encoding: "utf8" });
    console.log(`✔ MediaMTX already installed at ./bin/mediamtx (${(v.stdout || "").trim() || "ok"})`);
    return;
  }

  const { os, arch } = targetTriple();
  console.log(`• Detecting latest MediaMTX for ${os}/${arch} …`);
  const rel = await latestRelease();

  const wantSuffix = `_${os}_${arch}.tar.gz`;
  const asset = (rel.assets || []).find(
    (a) => a.name.includes(wantSuffix) && !a.name.includes("ffmpeg")
  );
  if (!asset) {
    throw new Error(
      `No asset matching *${wantSuffix} in release ${rel.tag_name}. Check https://github.com/bluenviron/mediamtx/releases`
    );
  }

  await mkdir(BIN_DIR, { recursive: true });
  const tarPath = path.join(BIN_DIR, asset.name);
  console.log(`• Downloading ${asset.name} (${rel.tag_name}) …`);
  const dl = await fetch(asset.browser_download_url, { headers: { "User-Agent": "camio-setup" } });
  if (!dl.ok || !dl.body) throw new Error(`Download failed: ${dl.status}`);
  await pipeline(Readable.fromWeb(dl.body), createWriteStream(tarPath));

  console.log("• Extracting …");
  const tar = spawnSync("tar", ["-xzf", tarPath, "-C", BIN_DIR], { encoding: "utf8" });
  if (tar.status !== 0) throw new Error(`tar failed: ${tar.stderr || tar.stdout}`);

  // The tarball extracts a `mediamtx` binary (and a sample yml we ignore).
  const extracted = path.join(BIN_DIR, "mediamtx");
  if (!(await exists(extracted))) {
    // Some archives may nest; find it.
    const found = (await readdir(BIN_DIR)).find((f) => f === "mediamtx");
    if (!found) throw new Error("Could not locate extracted 'mediamtx' binary");
    await rename(path.join(BIN_DIR, found), BIN_PATH);
  }
  await chmod(BIN_PATH, 0o755);

  // Clean up the tarball and MediaMTX's sample config (we generate our own).
  await rm(tarPath, { force: true });
  await rm(path.join(BIN_DIR, "mediamtx.yml"), { force: true });
  await rm(path.join(BIN_DIR, "LICENSE"), { force: true });

  const v = spawnSync(BIN_PATH, ["--version"], { encoding: "utf8" });
  console.log(`✔ Installed MediaMTX → ./bin/mediamtx (${(v.stdout || "").trim() || rel.tag_name})`);
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

main().catch((err) => {
  console.error("✖ setup-mediamtx failed:", err.message);
  process.exit(1);
});
