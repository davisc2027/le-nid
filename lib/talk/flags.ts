/** Feature flags for Conversation mode, kept in localStorage (a per-device convenience) and toggled in the hidden diagnostics panel. */
export type SttModelChoice = "default" | "whisper-large-v3-turbo" | "whisper-large-v3";
export type EndSilenceChoice = "auto" | 700 | 900 | 1200;

export type Flags = {
  pcm: boolean; // AudioWorklet PCM capture with pre-roll (falls back to MediaRecorder by itself)
  textCheck: boolean; // correct the side from the transcript text
  langRetry: boolean; // allow the server's single forced-language retry
  earlyArm: boolean; // arm the recorder at 1.5x the noise floor instead of 2x
  spectral: boolean; // band-energy condition when the room is loud
  adaptiveEnd: boolean; // hang time depends on how long the sentence is
  softCap: boolean; // 12 s soft cap, 20 s hard cap
  pipeline: boolean; // start transcribing the next clip while the last one translates
  phrasebook: boolean;
  cache: boolean;
  context: boolean; // previous turns as translation context
  warnings: boolean; // "may be off" chip
  whisperPrompt: boolean; // vocabulary prompt: OFF until tested on real phones
  noiseSuppression: boolean;
  sttModel: SttModelChoice;
  endSilence: EndSilenceChoice;
  keepAudio: boolean; // explicit opt-in: keep the last clips in memory for export
};

export const DEFAULT_FLAGS: Flags = {
  pcm: true, textCheck: true, langRetry: true, earlyArm: true, spectral: true, adaptiveEnd: true, softCap: true,
  pipeline: true, phrasebook: true, cache: true, context: true, warnings: true,
  whisperPrompt: false, noiseSuppression: true, sttModel: "default", endSilence: "auto", keepAudio: false,
};

const KEY = "le-nid-talk-flags";
const DIAG_KEY = "le-nid-talk-diag";

export function readFlags(): Flags {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_FLAGS, ...JSON.parse(raw) } : { ...DEFAULT_FLAGS };
  } catch { return { ...DEFAULT_FLAGS }; }
}
export function writeFlags(f: Flags) { try { localStorage.setItem(KEY, JSON.stringify(f)); } catch { /* storage unavailable */ } }
export function readDiagEnabled(): boolean { try { return localStorage.getItem(DIAG_KEY) === "1"; } catch { return false; } }
export function writeDiagEnabled(on: boolean) { try { if (on) localStorage.setItem(DIAG_KEY, "1"); else localStorage.removeItem(DIAG_KEY); } catch { /* ignore */ } }
