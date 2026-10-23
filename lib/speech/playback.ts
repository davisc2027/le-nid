/**
 * Model and learner-clip playback for the Say-it step. The model is a volunteer recording when one exists
 * (lib/speech/refs.ts), else the device French voice. See docs/speaking-build-spec.md section 7.
 */
import { speak } from "../french/speech";
import { referenceBlobUrl } from "./refs";
import { syllables } from "./text";

export type Players = { a: HTMLAudioElement; b: HTMLAudioElement };
export type PlaybackEvent = "model" | "me" | "end";
export type ModelOpts = { slow?: boolean; voice?: string };

const emit = (detail: PlaybackEvent) => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("speak-playback", { detail }));
};

type AudioSessionNav = Navigator & { audioSession?: { type: string } };
function playbackSession() {
  try { const a = (navigator as AudioSessionNav).audioSession; if (a) a.type = "playback"; } catch { /* not supported */ }
}

/** Element A plays the model recording, element B the learner's clip. Create once per step. */
export function createPlayers(): Players {
  const make = () => {
    const el = new Audio();
    el.setAttribute("playsinline", "");
    el.preload = "auto";
    el.volume = 1;
    return el;
  };
  return { a: make(), b: make() };
}

export function stopAll(p?: Players): void {
  try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch { /* ignore */ }
  for (const el of p ? [p.a, p.b] : []) { try { el.pause(); } catch { /* ignore */ } }
}

/** Resolves after `ms`, or at once when the signal aborts. */
const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((res) => {
  if (signal?.aborted) return res();
  const t = setTimeout(done, ms);
  function done() { clearTimeout(t); signal?.removeEventListener("abort", done); res(); }
  signal?.addEventListener("abort", done);
});

/** Plays one audio element to its end. Resolves on end, error or abort. */
function playElement(el: HTMLAudioElement, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onErr);
      signal?.removeEventListener("abort", onAbort);
      resolve(ok);
    };
    const onEnd = () => finish(true);
    const onErr = () => finish(false);
    const onAbort = () => { try { el.pause(); } catch { /* ignore */ } finish(true); };
    if (signal?.aborted) return finish(true);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onErr);
    signal?.addEventListener("abort", onAbort);
    el.currentTime = 0;
    el.play().catch(() => finish(false));
  });
}

/**
 * Plays the model. Resolves true when it played (or was stopped), false when nothing could play
 * (no recording and no device speech).
 */
export async function playModel(p: Players, fr: string, opts: ModelOpts = {}, signal?: AbortSignal): Promise<boolean> {
  playbackSession();
  const slow = !!opts.slow;
  const url = await referenceBlobUrl(fr, opts.voice);
  if (signal?.aborted) return true;
  if (url) {
    p.a.src = url;
    p.a.playbackRate = slow ? 0.75 : 1;
    (p.a as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
    emit("model");
    if (await playElement(p.a, signal)) return true;
  }
  return new Promise<boolean>((resolve) => {
    let done = false;
    // iOS sometimes never fires onend, so a timer ends the wait
    const timer = setTimeout(() => end(), (1500 + 400 * syllables(fr)) * (slow ? 2 : 1));
    const end = () => { if (done) return; done = true; clearTimeout(timer); signal?.removeEventListener("abort", onAbort); resolve(true); };
    const onAbort = () => { try { window.speechSynthesis.cancel(); } catch { /* ignore */ } end(); };
    if (!speak(fr, slow, { end })) { done = true; clearTimeout(timer); resolve(false); return; }
    emit("model");
    signal?.addEventListener("abort", onAbort);
  });
}

/** Plays the learner's clip (element B). */
export async function playClip(p: Players, wavUrl: string, signal?: AbortSignal): Promise<void> {
  playbackSession();
  if (p.b.src !== wavUrl) p.b.src = wavUrl;
  p.b.volume = 1;
  emit("me");
  await playElement(p.b, signal);
}

/**
 * Call inside the tap that starts a sequence: lets element B start later from the speech `onend` callback, which
 * is outside a gesture on iOS.
 */
export function primeClip(p: Players, wavUrl: string): void {
  if (p.b.src !== wavUrl) p.b.src = wavUrl;
  p.b.muted = true;
  p.b.play().then(() => { p.b.pause(); p.b.currentTime = 0; p.b.muted = false; }).catch(() => { p.b.muted = false; });
}

export type ShadowOpts = { players: Players; voice?: string; onPhase?: (phase: "model" | "you" | "model2" | null) => void };

/** Model, pause, the learner's clip, pause, model again. */
export async function playShadow(fr: string, wavUrl: string, opts: ShadowOpts, signal: AbortSignal): Promise<void> {
  const { players: p, voice, onPhase } = opts;
  try {
    onPhase?.("model");
    await playModel(p, fr, { voice }, signal);
    await sleep(400, signal);
    if (signal.aborted) return;
    onPhase?.("you");
    await playClip(p, wavUrl, signal);
    await sleep(400, signal);
    if (signal.aborted) return;
    onPhase?.("model2");
    await playModel(p, fr, { voice }, signal);
  } finally {
    onPhase?.(null);
    emit("end");
  }
}
