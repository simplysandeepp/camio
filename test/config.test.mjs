import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readConfig,
  ffmpegInputArgs,
  renderMediamtxConfig,
  rtspPublishUrl,
} from "../scripts/lib/config.mjs";

test("ffmpeg input args differ per OS", () => {
  const mac = ffmpegInputArgs({ source: "mac", device: "0", resolution: "1280x720", fps: "25" });
  assert.ok(mac.includes("avfoundation"));
  assert.ok(mac.includes("0:none"));

  const linux = ffmpegInputArgs({ source: "linux", device: "/dev/video0", resolution: "640x480", fps: "30" });
  assert.ok(linux.includes("v4l2"));
  assert.ok(linux.includes("/dev/video0"));
});

test("mediamtx config binds to localhost in lockdown", () => {
  const cfg = readConfig();
  const yml = renderMediamtxConfig({ ...cfg, localhostOnly: true });
  assert.match(yml, /rtspAddress: 127\.0\.0\.1:/);
  assert.match(yml, /hlsAddress: 127\.0\.0\.1:/);
  assert.match(yml, /webrtcAddress: 127\.0\.0\.1:/);
  assert.match(yml, /apiAddress: 127\.0\.0\.1:/);
  assert.match(yml, /moq: no/);
});

test("mediamtx config opens webrtc when not lockdown", () => {
  const cfg = readConfig();
  const yml = renderMediamtxConfig({ ...cfg, localhostOnly: false });
  assert.match(yml, /webrtcAddress: :/); // empty host = all interfaces
});

test("rtsp publish url uses the stream name", () => {
  assert.match(rtspPublishUrl({ ports: { rtsp: 8554 }, streamName: "cam" }), /rtsp:\/\/localhost:8554\/cam/);
});

test("rtsp publish url accepts an explicit camera id", () => {
  assert.match(
    rtspPublishUrl({ ports: { rtsp: 8554 }, streamName: "cam" }, "garage"),
    /rtsp:\/\/localhost:8554\/garage/
  );
});

test("no CAMERAS env synthesizes a single default camera", () => {
  const cfg = readConfig();
  assert.equal(cfg.cameras.length, 1);
  assert.equal(cfg.cameras[0].id, cfg.streamName);
});

test("CAMERAS env resolves multiple cameras with per-field fallback", () => {
  const prev = process.env.CAMERAS;
  process.env.CAMERAS = JSON.stringify([
    { id: "front", label: "Front door", device: "0" },
    { id: "garage" },
  ]);
  try {
    const cfg = readConfig();
    assert.equal(cfg.cameras.length, 2);
    assert.equal(cfg.cameras[0].id, "front");
    assert.equal(cfg.cameras[0].label, "Front door");
    assert.equal(cfg.cameras[1].id, "garage");
    assert.equal(cfg.cameras[1].label, "garage"); // falls back to id
    assert.equal(cfg.cameras[1].resolution, "1280x720"); // fell back to the global default

    const yml = renderMediamtxConfig(cfg);
    assert.match(yml, /front:\n\s+source: publisher/);
    assert.match(yml, /garage:\n\s+source: publisher/);
  } finally {
    // biome-ignore lint/performance/noDelete: env vars need true deletion, not "undefined" string
    if (prev === undefined) delete process.env.CAMERAS;
    else process.env.CAMERAS = prev;
  }
});

test("invalid CAMERAS JSON falls back to a single default camera", () => {
  const prev = process.env.CAMERAS;
  process.env.CAMERAS = "{not valid json";
  try {
    const cfg = readConfig();
    assert.equal(cfg.cameras.length, 1);
  } finally {
    // biome-ignore lint/performance/noDelete: env vars need true deletion, not "undefined" string
    if (prev === undefined) delete process.env.CAMERAS;
    else process.env.CAMERAS = prev;
  }
});
