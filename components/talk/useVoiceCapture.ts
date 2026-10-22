"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createVad, meterLevel, rmsFromBytes } from "@/lib/talk/vad";
import { extensionFor, pickMimeType } from "@/lib/talk/mime";
import { canRecord, createWakeLock } from "@/lib/talk/browser";
import type { Clip } from "@/lib/talk/client";

export type CaptureState = "off" | "starting" | "listening" | "hearing" | "denied" | "unsupported" | "error";

type Options = {
  onClip: (clip: Clip) => void;
  /** Called about 20 times a second with 0..1; write to the DOM directly, do not set React state. */
  onLevel?: (level: number) => void;
  /** While true (for example the phone is reading aloud) nothing is recorded. */
  isMuted?: () => boolean;
};

const FRAME_MS = 50;

/**
 * Microphone + voice-activity detection + one MediaRecorder per utterance. start() must run from a tap (iOS needs
 * the AudioContext created in the gesture). Everything is released on stop(), on unmount, and when the tab is hidden.
 */
export function useVoiceCapture({ onClip, onLevel, isMuted }: Options) {
  const [state, setState] = useState<CaptureState>("off");
  const cb = useRef({ onClip, onLevel, isMuted });
  useEffect(() => { cb.current = { onClip, onLevel, isMuted }; });
  const live = useRef<{
    gen: number;
    stream?: MediaStream;
    ctx?: AudioContext;
    timer?: ReturnType<typeof setInterval>;
    recorder?: MediaRecorder;
    discard?: boolean;
  }>({ gen: 0 });
  const wake = useRef<ReturnType<typeof createWakeLock> | null>(null);

  const stop = useCallback((next: CaptureState = "off") => {
    const l = live.current;
    l.gen++;
    if (l.timer) clearInterval(l.timer);
    if (l.recorder && l.recorder.state !== "inactive") { l.discard = true; try { l.recorder.stop(); } catch { /* already stopped */ } }
    l.stream?.getTracks().forEach((t) => t.stop());
    void l.ctx?.close().catch(() => {});
    live.current = { gen: l.gen };
    void wake.current?.release();
    cb.current.onLevel?.(0);
    setState(next);
  }, []);

  const start = useCallback(async () => {
    if (live.current.stream || live.current.ctx) return;
    if (!canRecord()) { setState("unsupported"); return; }
    const gen = ++live.current.gen;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { setState("unsupported"); return; }
    // Created inside the tap so iOS lets it run.
    const ctx = new AC();
    void ctx.resume().catch(() => {});
    live.current.ctx = ctx;
    setState("starting");
    wake.current ??= createWakeLock();
    void wake.current.acquire();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (live.current.gen === gen) stop(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }
    if (live.current.gen !== gen) { stream.getTracks().forEach((t) => t.stop()); return; }
    live.current.stream = stream;
    stream.getAudioTracks().forEach((t) => t.addEventListener("ended", () => { if (live.current.gen === gen) stop("error"); }));

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const vad = createVad();
    const mime = pickMimeType((t) => MediaRecorder.isTypeSupported(t));

    const beginRecording = () => {
      const l = live.current;
      if (l.recorder && l.recorder.state !== "inactive") return;
      let rec: MediaRecorder;
      try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch { rec = new MediaRecorder(stream); }
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      l.recorder = rec;
      l.discard = false;
      try { rec.start(); } catch { l.recorder = undefined; }
      return { rec, chunks };
    };
    let current: { rec: MediaRecorder; chunks: Blob[] } | undefined;

    const endRecording = (keep: boolean, durationMs: number, peak: number) => {
      const c = current;
      current = undefined;
      if (!c) return;
      const l = live.current;
      if (l.recorder === c.rec) l.recorder = undefined;
      c.rec.onstop = () => {
        if (!keep || live.current.gen !== gen) return;
        const type = c.rec.mimeType || mime || "audio/webm";
        const blob = new Blob(c.chunks, { type });
        if (blob.size < 1000) return;
        cb.current.onClip({ blob, ext: extensionFor(type), durationMs, peak });
      };
      try { if (c.rec.state !== "inactive") c.rec.stop(); } catch { /* ignore */ }
    };

    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    setState("listening");
    live.current.timer = setInterval(() => {
      if (live.current.gen !== gen) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      analyser.getByteTimeDomainData(buf);
      const rms = rmsFromBytes(buf);
      cb.current.onLevel?.(meterLevel(rms));
      if (cb.current.isMuted?.()) {
        if (current) { endRecording(false, 0, 0); setState("listening"); }
        vad.reset();
        return;
      }
      const ev = vad.step(rms, performance.now());
      if (ev.type === "arm") {
        current = beginRecording();
        if (ev.confirmed) setState("hearing");
      } else if (ev.type === "start") setState("hearing");
      else if (ev.type === "cancel") endRecording(false, 0, 0);
      else if (ev.type === "end") {
        endRecording(ev.keep, ev.durationMs, ev.peakRms);
        setState("listening");
      }
    }, FRAME_MS);
  }, [stop]);

  // Pause when the tab is hidden (the phone locks or the person switches apps) and release the mic.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && live.current.ctx) stop("off"); };
    const onPageHide = () => { if (live.current.ctx) stop("off"); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      stop("off");
    };
  }, [stop]);

  return { state, start, stop: () => stop("off") };
}
