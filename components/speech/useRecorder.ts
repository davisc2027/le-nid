"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createEndpointer, levelFromRms } from "@/lib/speech/endpoint";
import type { StopReason } from "@/lib/speech/checks";
import { encodeWav } from "@/lib/speech/wav";

export type RecState = "idle" | "starting" | "recording" | "done" | "denied" | "unsupported" | "error";
export type Recording = {
  samples: Float32Array; sampleRate: number; wavUrl: string; seconds: number; stoppedBy: StopReason; settings: MediaTrackSettings | null;
};

type Runtime = {
  ctx: AudioContext; stream: MediaStream | null; nodes: AudioNode[]; buffer: Float32Array; written: number;
  settings: MediaTrackSettings | null; finished: boolean;
};

type AudioSessionNav = Navigator & { audioSession?: { type: string } };
const setAudioSession = (type: "play-and-record" | "playback") => {
  try { const a = (navigator as AudioSessionNav).audioSession; if (a) a.type = type; } catch { /* not supported */ }
};

/**
 * Records raw mono PCM from the microphone (AudioWorklet, ScriptProcessor fallback) until the endpointer hears the
 * phrase end, the cap is reached or stop() is called. Audio stays in memory. start() must run inside a tap.
 */
export function useRecorder(opts: { capSec: number; onLevel?: (level: number) => void }) {
  const [state, setStateRaw] = useState<RecState>("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  const stateRef = useRef<RecState>("idle");
  const optsRef = useRef(opts);
  const gen = useRef(0);
  const rt = useRef<Runtime | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => { optsRef.current = opts; });

  const setState = useCallback((s: RecState) => { stateRef.current = s; setStateRaw(s); }, []);

  const release = useCallback(() => {
    const r = rt.current;
    rt.current = null;
    if (!r) return;
    r.finished = true;
    for (const n of r.nodes) { try { n.disconnect(); } catch { /* already gone */ } }
    r.stream?.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
    r.ctx.close().catch(() => {});
    setAudioSession("playback");
  }, []);

  const revoke = useCallback(() => {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
  }, []);

  const finish = useCallback((reason: StopReason, myGen: number) => {
    const r = rt.current;
    if (!r || r.finished || gen.current !== myGen) return;
    const sampleRate = r.ctx.sampleRate;
    const samples = r.buffer.slice(0, r.written);
    const settings = r.settings;
    release();
    revoke();
    const wavUrl = URL.createObjectURL(encodeWav(samples, sampleRate));
    urlRef.current = wavUrl;
    setRecording({ samples, sampleRate, wavUrl, seconds: samples.length / sampleRate, stoppedBy: reason, settings });
    setState("done");
  }, [release, revoke, setState]);

  const start = useCallback(async () => {
    if (stateRef.current === "starting" || stateRef.current === "recording") return;
    const myGen = ++gen.current;
    release(); revoke();
    setRecording(null);
    const AC: typeof AudioContext | undefined =
      typeof window === "undefined" ? undefined : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!navigator.mediaDevices?.getUserMedia || !AC) { setState("unsupported"); return; }
    setState("starting");
    let ctx: AudioContext;
    try { ctx = new AC(); } catch { setState("error"); return; }
    void ctx.resume().catch(() => {});
    setAudioSession("play-and-record");
    const run: Runtime = { ctx, stream: null, nodes: [], buffer: new Float32Array(0), written: 0, settings: null, finished: false };
    rt.current = run;
    const abandoned = () => gen.current !== myGen;
    const fail = (e: unknown) => {
      if (abandoned()) return;
      release();
      const name = (e as { name?: string } | null)?.name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
    };
    try {
      const wanted = { channelCount: 1, echoCancellation: false, noiseSuppression: false, autoGainControl: false };
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: wanted });
      } catch (e) {
        if ((e as { name?: string } | null)?.name !== "OverconstrainedError") throw e;
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      run.stream = stream;
      if (abandoned()) { release(); return; }
      const track = stream.getAudioTracks()[0];
      run.settings = track ? track.getSettings() : null;
      if (track) track.onended = () => { if (!abandoned() && stateRef.current === "recording") fail(new Error("track ended")); };
      await ctx.resume().catch(() => {});
      if (abandoned()) { release(); return; }

      const sr = ctx.sampleRate;
      run.buffer = new Float32Array(Math.ceil((optsRef.current.capSec + 1) * sr));
      const ep = createEndpointer({ capSec: optsRef.current.capSec });
      const onChunk = (chunk: Float32Array) => {
        if (run.finished || abandoned()) return;
        const room = run.buffer.length - run.written;
        const n = Math.min(room, chunk.length);
        run.buffer.set(n === chunk.length ? chunk : chunk.subarray(0, n), run.written);
        run.written += n;
        let sum = 0;
        for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
        const rms = Math.sqrt(sum / Math.max(1, chunk.length));
        optsRef.current.onLevel?.(levelFromRms(rms));
        const ev = ep.step(rms, (run.written / sr) * 1000);
        if (ev === "stop-silence") finish("silence", myGen);
        else if (ev === "stop-no-speech") finish("no-speech", myGen);
        else if (ev === "stop-cap" || run.written >= run.buffer.length) finish("cap", myGen);
      };

      const source = ctx.createMediaStreamSource(stream);
      const mute = ctx.createGain();
      mute.gain.value = 0;
      let tap: AudioNode | null = null;
      if (ctx.audioWorklet) {
        try {
          await ctx.audioWorklet.addModule("/speech/pcm-tap.js");
          const node = new AudioWorkletNode(ctx, "pcm-tap", { channelCount: 1, channelCountMode: "explicit" });
          node.port.onmessage = (m: MessageEvent<Float32Array>) => onChunk(m.data);
          tap = node;
        } catch { tap = null; }
      }
      if (!tap) {
        const proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = (e) => onChunk(e.inputBuffer.getChannelData(0));
        tap = proc;
      }
      if (abandoned()) { release(); return; }
      source.connect(tap); tap.connect(mute); mute.connect(ctx.destination);
      run.nodes = [source, tap, mute];
      setState("recording");
    } catch (e) {
      fail(e);
    }
  }, [finish, release, revoke, setState]);

  const stop = useCallback(() => { if (stateRef.current === "recording") finish("tap", gen.current); }, [finish]);

  const discard = useCallback(() => {
    gen.current++;
    release(); revoke();
    setRecording(null);
    setState("idle");
  }, [release, revoke, setState]);

  useEffect(() => {
    const generation = gen;
    const hide = () => { if (document.visibilityState === "hidden") discard(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", discard);
    return () => {
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", discard);
      generation.current++;
      release(); revoke();
    };
  }, [discard, release, revoke]);

  return { state, recording, start, stop, reset: discard };
}
