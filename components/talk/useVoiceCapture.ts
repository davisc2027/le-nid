"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bandRatio, createVad, meterLevel, rmsFromFloats, type VadConfig, type VadEnd } from "@/lib/talk/vad";
import { extensionFor, pickMimeType } from "@/lib/talk/mime";
import { canRecord, createWakeLock } from "@/lib/talk/browser";
import { assembleClip, createRing } from "@/lib/talk/ring";
import { encodeWav } from "@/lib/talk/wav";
import type { Side } from "@/lib/talk/lang";
import type { Clip, ClipMeta } from "@/lib/talk/client";

export type CaptureState = "off" | "starting" | "listening" | "hearing" | "denied" | "unsupported" | "error";
export type CaptureMode = "pcm" | "recorder";

/** Read when listening starts (changes apply the next time). */
export type Tuning = { pcm: boolean; noiseSuppression: boolean; spectral: boolean; vad: Partial<VadConfig> };

type Options = {
  onClip: (clip: Clip) => void;
  /** Called about 20 times a second with 0..1; write to the DOM directly, do not set React state. */
  onLevel?: (level: number) => void;
  /** While true (for example the phone is reading aloud) nothing is recorded. */
  isMuted?: () => boolean;
  /** Noisy place mode: undefined = listen freely; null = wait (only learn the noise); a side = record the next sentence in that language. */
  getGate?: () => Side | null | undefined;
  getTuning?: () => Tuning;
};

const FRAME_MS = 50;
const SAMPLE_RATE = 16000;
const PRE_ROLL_MS = 600;
const TAIL_MS = 300;
const PCM_WATCHDOG_MS = 1500;
const DEFAULT_TUNING: Tuning = { pcm: true, noiseSuppression: true, spectral: true, vad: {} };

/**
 * Microphone + voice-activity detection. Preferred path: an AudioWorklet delivers 16 kHz mono PCM into a 600 ms ring
 * buffer, so a clip starts BEFORE the moment the detector noticed speech and ends 300 ms after the last word, and is
 * sent as WAV. Fallback (no audioWorklet, worklet failure, or the flag off): one MediaRecorder per utterance.
 * start() must run from a tap (iOS needs the AudioContext created in the gesture). Everything is released on stop(),
 * on unmount, and when the tab is hidden.
 */
export function useVoiceCapture({ onClip, onLevel, isMuted, getGate, getTuning }: Options) {
  const [state, setState] = useState<CaptureState>("off");
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const cb = useRef({ onClip, onLevel, isMuted, getGate, getTuning });
  useEffect(() => { cb.current = { onClip, onLevel, isMuted, getGate, getTuning }; });
  const live = useRef<{
    gen: number;
    stream?: MediaStream;
    ctx?: AudioContext;
    timer?: ReturnType<typeof setInterval>;
    watchdog?: ReturnType<typeof setTimeout>;
    node?: AudioWorkletNode;
    recorder?: MediaRecorder;
  }>({ gen: 0 });
  const wake = useRef<ReturnType<typeof createWakeLock> | null>(null);

  const stop = useCallback((next: CaptureState = "off") => {
    const l = live.current;
    l.gen++;
    if (l.timer) clearInterval(l.timer);
    if (l.watchdog) clearTimeout(l.watchdog);
    if (l.recorder && l.recorder.state !== "inactive") { try { l.recorder.stop(); } catch { /* already stopped */ } }
    if (l.node) { l.node.port.onmessage = null; try { l.node.disconnect(); } catch { /* ignore */ } }
    l.stream?.getTracks().forEach((t) => t.stop());
    void l.ctx?.close().catch(() => {});
    live.current = { gen: l.gen };
    void wake.current?.release();
    cb.current.onLevel?.(0);
    setMode(null);
    setState(next);
  }, []);

  const start = useCallback(async () => {
    if (live.current.stream || live.current.ctx) return;
    if (!canRecord()) { setState("unsupported"); return; }
    const gen = ++live.current.gen;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) { setState("unsupported"); return; }
    const tuning = cb.current.getTuning?.() ?? DEFAULT_TUNING;
    // Created inside the tap so iOS lets it run.
    const ctx = new AC();
    void ctx.resume().catch(() => {});
    live.current.ctx = ctx;
    setState("starting");
    wake.current ??= createWakeLock();
    void wake.current.acquire();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: tuning.noiseSuppression, autoGainControl: true, channelCount: 1 } });
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
    analyser.smoothingTimeConstant = 0.3;
    source.connect(analyser);
    const tbuf = new Float32Array(analyser.fftSize);
    const fbuf = new Float32Array(analyser.frequencyBinCount);
    const vad = createVad(tuning.vad);
    const mime = typeof MediaRecorder !== "undefined" ? pickMimeType((t) => MediaRecorder.isTypeSupported(t)) : "";

    // ----- PCM path -----
    let pcmOn = false;
    const ring = createRing(Math.round((SAMPLE_RATE * PRE_ROLL_MS) / 1000));
    let framesSeen = 0, accSq = 0, accN = 0;
    let liveFrames: Float32Array[] | null = null; // non-null while an utterance is being recorded
    if (tuning.pcm && ctx.audioWorklet && typeof AudioWorkletNode !== "undefined") {
      try {
        await ctx.audioWorklet.addModule("/worklets/capture.js?v=1");
        if (live.current.gen !== gen) return;
        const node = new AudioWorkletNode(ctx, "le-nid-capture", { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1 });
        node.port.onmessage = (e: MessageEvent<{ pcm: Float32Array; sumSq: number; count: number }>) => {
          const m = e.data;
          if (!m?.pcm) return;
          framesSeen++;
          accSq += m.sumSq; accN += m.count;
          ring.push(m.pcm);
          liveFrames?.push(m.pcm);
        };
        const mute = ctx.createGain(); // some browsers only run a worklet that is connected to the output; keep it silent
        mute.gain.value = 0;
        source.connect(node);
        node.connect(mute).connect(ctx.destination);
        live.current.node = node;
        pcmOn = true;
        // If no audio arrives, give up on PCM and use the recorder instead.
        live.current.watchdog = setTimeout(() => {
          if (live.current.gen === gen && framesSeen === 0) {
            pcmOn = false; liveFrames = null; ring.clear();
            try { node.disconnect(); } catch { /* ignore */ }
            setMode("recorder");
          }
        }, PCM_WATCHDOG_MS);
      } catch { pcmOn = false; }
    }
    if (live.current.gen !== gen) return;
    setMode(pcmOn ? "pcm" : "recorder");

    // ----- one utterance in progress -----
    type Current = { pre?: Float32Array; rec?: MediaRecorder; chunks?: Blob[]; gate?: Side; startedAt: number };
    let current: Current | undefined;

    const meta = (ev: VadEnd, pcm: boolean, bytes: number, mimeType: string, preMs: number): ClipMeta => ({
      pcm, mime: mimeType, bytes, floor: vad.floor(), speechMs: ev.speechMs, silenceMs: ev.silenceMs, reason: ev.reason,
      preRollMs: preMs, sampleRate: pcm ? SAMPLE_RATE : ctx.sampleRate, endedAt: Date.now(),
    });

    const begin = (gate: Side | undefined): Current => {
      const c: Current = { gate, startedAt: performance.now() };
      if (pcmOn) {
        c.pre = ring.snapshot();
        liveFrames = [];
        return c;
      }
      let rec: MediaRecorder;
      try { rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); } catch { rec = new MediaRecorder(stream); }
      c.chunks = [];
      c.rec = rec;
      rec.ondataavailable = (e) => { if (e.data.size) c.chunks!.push(e.data); };
      live.current.recorder = rec;
      try { rec.start(); } catch { c.rec = undefined; live.current.recorder = undefined; }
      return c;
    };

    const discard = () => {
      const c = current;
      current = undefined;
      liveFrames = null;
      if (c?.rec) {
        if (live.current.recorder === c.rec) live.current.recorder = undefined;
        c.rec.onstop = null;
        try { if (c.rec.state !== "inactive") c.rec.stop(); } catch { /* ignore */ }
      }
    };

    const finish = (ev: VadEnd) => {
      const c = current;
      current = undefined;
      const frames = liveFrames;
      liveFrames = null;
      if (!c) return;
      if (c.rec) {
        const rec = c.rec;
        if (live.current.recorder === rec) live.current.recorder = undefined;
        rec.onstop = () => {
          if (!ev.keep || live.current.gen !== gen) return;
          const type = rec.mimeType || mime || "audio/webm";
          const blob = new Blob(c.chunks ?? [], { type });
          if (blob.size < 1000) return;
          cb.current.onClip({ blob, ext: extensionFor(type), durationMs: ev.durationMs, peak: ev.peakRms, forcedLang: c.gate, meta: meta(ev, false, blob.size, type, 0) });
        };
        try { if (rec.state !== "inactive") rec.stop(); } catch { /* ignore */ }
        return;
      }
      if (!ev.keep || !c.pre || !frames || live.current.gen !== gen) return;
      // Keep ~300 ms after the last voiced frame; the rest of the silence is trimmed away.
      const trim = Math.max(0, Math.round(((ev.silenceMs - TAIL_MS) * SAMPLE_RATE) / 1000));
      const samples = assembleClip(c.pre, frames, trim);
      if (samples.length < SAMPLE_RATE * 0.3) return;
      const blob = new Blob([encodeWav(samples, SAMPLE_RATE)], { type: "audio/wav" });
      cb.current.onClip({
        blob, ext: "wav", durationMs: (samples.length / SAMPLE_RATE) * 1000, peak: ev.peakRms, forcedLang: c.gate,
        meta: meta(ev, true, blob.size, "audio/wav", (c.pre.length / SAMPLE_RATE) * 1000),
      });
    };

    if (ctx.state !== "running") void ctx.resume().catch(() => {});
    setState("listening");
    live.current.timer = setInterval(() => {
      if (live.current.gen !== gen) return;
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      analyser.getFloatTimeDomainData(tbuf);
      let rms = rmsFromFloats(tbuf);
      // The worklet sees every sample of the last 50 ms; the analyser only the latest 21 ms.
      if (pcmOn && accN > 0) { rms = Math.sqrt(accSq / accN); }
      accSq = 0; accN = 0;
      cb.current.onLevel?.(meterLevel(rms));
      if (cb.current.isMuted?.()) {
        if (current) { discard(); setState("listening"); }
        vad.reset();
        ring.clear(); // never let the phone's own voice into the pre-roll
        return;
      }
      const gate = cb.current.getGate?.();
      if (gate === null) { // Noisy place mode, no language chosen yet: only learn the room
        if (current) { discard(); setState("listening"); }
        vad.learn(rms);
        return;
      }
      let band: number | undefined;
      if (tuning.spectral && vad.floor() > vad.config.bandFloor) {
        analyser.getFloatFrequencyData(fbuf);
        band = bandRatio(fbuf, ctx.sampleRate);
      }
      const ev = vad.step(rms, performance.now(), band);
      if (ev.type === "arm") {
        current = begin(gate);
        if (ev.confirmed) setState("hearing");
      } else if (ev.type === "start") setState("hearing");
      else if (ev.type === "cancel") discard();
      else if (ev.type === "end") {
        finish(ev);
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

  return { state, mode, start, stop: () => stop("off") };
}
