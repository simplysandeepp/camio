"use client";

import { useEffect, useRef, useState } from "react";

type PlayState = "connecting" | "webrtc" | "hls" | "offline";

interface Props {
  whep: string;
  hls: string;
}

/**
 * Live camera player. Tries WebRTC (WHEP) for real-time playback and falls back
 * to HLS if WebRTC can't establish within a few seconds.
 */
export default function CameraPlayer({ whep, hls }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayState>("connecting");

  useEffect(() => {
    let cancelled = false;
    let pc: RTCPeerConnection | null = null;
    let hlsInstance: { destroy: () => void } | null = null;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    // Effect-scoped guards (NOT React state, which is frozen in this closure).
    let webrtcConnected = false;
    let fellBack = false;

    function clearFallbackTimer() {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    }

    async function startHls() {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;

      // Tear down any prior hls.js instance before creating a new one.
      if (hlsInstance) {
        try { hlsInstance.destroy(); } catch { /* ignore */ }
        hlsInstance = null;
      }

      // Safari / iOS can play HLS natively.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = hls;
        try {
          await video.play();
          if (!cancelled) setState("hls");
          return;
        } catch {
          /* fall through to hls.js */
        }
      }

      const { default: Hls } = await import("hls.js");
      if (cancelled) return;
      if (Hls.isSupported()) {
        const inst = new Hls({ lowLatencyMode: true, backBufferLength: 10 });
        hlsInstance = inst;
        inst.loadSource(hls);
        inst.attachMedia(video);
        inst.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
          if (!cancelled) setState("hls");
        });
        inst.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal && !cancelled) setState("offline");
        });
      } else if (!cancelled) {
        setState("offline");
      }
    }

    async function startWebRtc() {
      const video = videoRef.current;
      if (!video) return;

      pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (ev) => {
        if (cancelled) return;
        webrtcConnected = true;
        clearFallbackTimer();
        video.srcObject = ev.streams[0];
        video.play().catch(() => {});
        setState("webrtc");
      };

      pc.onconnectionstatechange = () => {
        if (!pc || cancelled) return;
        if (pc.connectionState === "failed") triggerFallback();
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitForIceGathering(pc);
        if (cancelled) return;

        const res = await fetch(whep, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription?.sdp ?? offer.sdp ?? "",
        });
        if (!res.ok) throw new Error(`WHEP ${res.status}`);
        const answer = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: "answer", sdp: answer });
      } catch {
        triggerFallback();
      }
    }

    // Idempotent: only ever falls back once, and never after WebRTC connected.
    function triggerFallback() {
      if (cancelled || fellBack || webrtcConnected) return;
      fellBack = true;
      clearFallbackTimer();
      if (pc) {
        try { pc.close(); } catch { /* ignore */ }
        pc = null;
      }
      startHls();
    }

    // If WebRTC hasn't produced video in 6s, fall back to HLS.
    fallbackTimer = setTimeout(() => {
      if (!webrtcConnected) triggerFallback();
    }, 6000);

    startWebRtc();

    return () => {
      cancelled = true;
      clearFallbackTimer();
      if (pc) { try { pc.close(); } catch { /* ignore */ } }
      if (hlsInstance) { try { hlsInstance.destroy(); } catch { /* ignore */ } }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whep, hls]);

  return (
    <div className="player">
      <video ref={videoRef} playsInline muted autoPlay controls />
      <PlayerBadge state={state} />
    </div>
  );
}

function PlayerBadge({ state }: { state: PlayState }) {
  const map: Record<PlayState, { label: string; cls: string }> = {
    connecting: { label: "Connecting…", cls: "connecting" },
    webrtc: { label: "● LIVE (real-time)", cls: "live" },
    hls: { label: "● LIVE (HLS)", cls: "live" },
    offline: { label: "Camera offline", cls: "offline" },
  };
  const b = map[state];
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const done = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      pc.removeEventListener("icegatheringstatechange", check);
      resolve();
    };
    const check = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    pc.addEventListener("icegatheringstatechange", check);
    // Safety timeout — don't wait forever for a stray candidate.
    timer = setTimeout(done, 1500);
  });
}
