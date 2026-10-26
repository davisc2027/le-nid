/**
 * Shared microphone stream cache. The browser (iOS Safari / Home Screen app) owns the permission and a web app cannot
 * store consent, so we only avoid asking more often than needed: one getUserMedia per screen visit, reused by later
 * taps. Between listens the stream stays open but its tracks are disabled (silence, nothing captured). It is fully
 * released on screen unmount (releaseMic), after IDLE_MS idle, after HIDDEN_MS with the page hidden, and when a track
 * ends. Any failure inside the cache falls back to a plain getUserMedia, i.e. the old behaviour.
 * Errors from getUserMedia (NotAllowedError etc.) are passed through untouched.
 */

export const IDLE_MS = 90_000;
export const HIDDEN_MS = 30_000;

type Timer = unknown;

/** Replaceable in tests. */
export const micEnv = {
  getUserMedia: (c: MediaStreamConstraints): Promise<MediaStream> => navigator.mediaDevices.getUserMedia(c),
  setTimeout: (fn: () => void, ms: number): Timer => setTimeout(fn, ms),
  clearTimeout: (t: Timer) => clearTimeout(t as ReturnType<typeof setTimeout>),
};

type Entry = { key: string; stream: MediaStream; offEnded: () => void };

let entry: Entry | null = null;
let pending: { key: string; promise: Promise<MediaStream> } | null = null;
let idleTimer: Timer | null = null;
let hiddenTimer: Timer | null = null;
let listening = false;

const stopTracks = (s: MediaStream) => s.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });
const setEnabled = (s: MediaStream, on: boolean) => s.getAudioTracks().forEach((t) => { try { t.enabled = on; } catch { /* ignore */ } });
const clearIdle = () => { if (idleTimer !== null) { micEnv.clearTimeout(idleTimer); idleTimer = null; } };
const clearHidden = () => { if (hiddenTimer !== null) { micEnv.clearTimeout(hiddenTimer); hiddenTimer = null; } };

/** Stop every track and forget the cached stream. Safe to call any time. */
export function releaseMic(): void {
  clearIdle();
  clearHidden();
  const e = entry;
  entry = null;
  pending = null;
  if (e) { e.offEnded(); stopTracks(e.stream); }
}

/** Page visibility changed (also called by the document listener). Hidden for HIDDEN_MS releases the mic. */
export function onVisibility(hidden: boolean): void {
  if (!hidden) { clearHidden(); return; }
  if (!entry || hiddenTimer !== null) return;
  hiddenTimer = micEnv.setTimeout(() => { hiddenTimer = null; releaseMic(); }, HIDDEN_MS);
}

function listen() {
  if (listening || typeof document === "undefined") return;
  listening = true;
  document.addEventListener("visibilitychange", () => onVisibility(document.visibilityState === "hidden"));
}

function adopt(key: string, stream: MediaStream): void {
  const tracks = stream.getAudioTracks();
  const onEnded = () => { if (entry?.stream === stream) releaseMic(); };
  tracks.forEach((t) => t.addEventListener("ended", onEnded));
  entry = { key, stream, offEnded: () => tracks.forEach((t) => t.removeEventListener("ended", onEnded)) };
}

const usable = (s: MediaStream) => {
  const t = s.getAudioTracks();
  return t.length > 0 && t.every((x) => x.readyState !== "ended");
};

/**
 * Returns a live, enabled mic stream for these constraints, reusing the warm one when the constraints match.
 * `fallback` is tried if the first request throws OverconstrainedError. Pair every call with pauseMic(stream).
 */
export async function acquireMic(constraints: MediaStreamConstraints, fallback?: MediaStreamConstraints): Promise<MediaStream> {
  let key: string;
  try { key = JSON.stringify(constraints); } catch { return request(constraints, fallback); }
  try {
    listen();
    clearIdle();
    if (entry && entry.key === key && usable(entry.stream)) {
      setEnabled(entry.stream, true);
      return entry.stream;
    }
    if (entry) releaseMic(); // different constraints or dead tracks: one stream at a time
    if (pending && pending.key === key) {
      const s = await pending.promise;
      if (entry?.stream === s) { setEnabled(s, true); clearIdle(); return s; }
    }
  } catch { /* cache trouble: fall through to a direct request */ }

  const promise = request(constraints, fallback);
  pending = { key, promise };
  const stream = await promise; // errors pass through unchanged
  try {
    if (pending?.promise === promise) {
      pending = null;
      adopt(key, stream);
    } else {
      return stream; // released while we waited; caller owns it (pauseMic will stop it, not being cached)
    }
  } catch { /* uncached stream still works */ }
  return stream;
}

async function request(c: MediaStreamConstraints, fallback?: MediaStreamConstraints): Promise<MediaStream> {
  try {
    return await micEnv.getUserMedia(c);
  } catch (e) {
    if (fallback && (e as { name?: string } | null)?.name === "OverconstrainedError") return micEnv.getUserMedia(fallback);
    throw e;
  }
}

/**
 * Call when a listen ends. A cached stream is kept warm with its tracks disabled (released after IDLE_MS); a stream
 * that is not the cached one (fallback path) is stopped outright.
 */
export function pauseMic(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  if (entry?.stream !== stream) { stopTracks(stream); return; }
  setEnabled(stream, false);
  clearIdle();
  idleTimer = micEnv.setTimeout(() => { idleTimer = null; releaseMic(); }, IDLE_MS);
}

/** True while a stream is cached (for tests and diagnostics). */
export const micIsWarm = () => entry !== null;
