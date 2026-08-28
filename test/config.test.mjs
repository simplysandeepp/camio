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
