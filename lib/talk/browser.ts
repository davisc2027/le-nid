/** Browser feature checks for Conversation mode. Client only. */

export type RecognitionResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
export type Recognizer = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
};
type RecognizerCtor = new () => Recognizer;

export function speechRecognitionCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Running as the installed Home Screen app, where Safari's speech recognition is unreliable. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if ((navigator as unknown as { standalone?: boolean }).standalone === true) return true;
  try { return window.matchMedia("(display-mode: standalone)").matches; } catch { return false; }
}

export function canRecord(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

export function prefersReducedMotion(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

type Sentinel = { release(): Promise<void>; released?: boolean };

/** Keeps the screen on while listening, where the Wake Lock API exists. Safe to call repeatedly. */
export function createWakeLock() {
  let sentinel: Sentinel | null = null;
  let wanted = false;
  async function acquire() {
    wanted = true;
    if (sentinel && !sentinel.released) return;
    try {
      const wl = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<Sentinel> } }).wakeLock;
      if (wl && document.visibilityState === "visible") sentinel = await wl.request("screen");
      if (!wanted) await release();
    } catch { sentinel = null; }
  }
  async function release() {
    wanted = false;
    const s = sentinel;
    sentinel = null;
    try { await s?.release(); } catch { /* already released */ }
  }
  return { acquire, release };
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch { return fallback; }
}

export function writeJson(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode or storage full */ }
}
