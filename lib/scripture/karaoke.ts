// Spoken verse playback for the scripture track: tap a word to hear it, or play a chunk / the whole verse while
// each word lights up ("karaoke"). The device voice rarely reports where it is (iOS usually sends no word
// boundaries), so the highlight runs on a timer estimated from word length and punctuation pauses, and jumps to
// the real position whenever the browser does report one. One playback at a time, shared by every verse on screen.
import { speak } from "@/lib/french/speech";
import type { Tok } from "./tokens";

/** Milliseconds per letter at the app's normal (0.9) and slow (0.5) speech rates; tuned by ear on iOS French voices.
 *  The slow figure was 112 at rate 0.6, scaled by 0.6/0.5 when slow speech was slowed to 0.5. */
const MS_PER_CHAR = { normal: 72, slow: 134 };
const PAUSE = { comma: 260, stop: 480 };

/** When each token starts (ms from the beginning) and the total length, for the timer-based highlight. */
export function karaokeTimes(toks: Tok[], slow = false): { starts: number[]; total: number } {
  const per = slow ? MS_PER_CHAR.slow : MS_PER_CHAR.normal;
  const starts: number[] = [];
  let t = 120; // the voice takes a moment to start
  for (const tok of toks) {
    starts.push(t);
    if (!tok.word) continue;
    t += Math.max(2, tok.say.replace(/['-]/g, "").length) * per + 60;
    if (/[.!?…;:]["»”]*$/.test(tok.text)) t += PAUSE.stop;
    else if (/,["»”]*$/.test(tok.text)) t += PAUSE.comma;
  }
  return { starts, total: t };
}

/** Character offset of each token in `toks.map(t => t.text).join(" ")`. */
export function charStarts(toks: Tok[]): number[] {
  const out: number[] = [];
  let at = 0;
  for (const t of toks) { out.push(at); at += t.text.length + 1; }
  return out;
}

// ---- shared playback state (client only) -------------------------------------------------------------------
export type Playing = { group: string; index: number } | null;
let state: Playing = null;
let session = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
const listeners = new Set<() => void>();
const emit = (s: Playing) => { state = s; listeners.forEach((l) => l()); };

export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const getPlaying = () => state;
export const getServerPlaying = (): Playing => null;
/** Id of the latest playback, so a control can tell whether what is playing is still the one it started. */
export const currentSession = () => session;

function clear() { timers.forEach(clearTimeout); timers = []; }

/** Stops the highlight (and the voice, when `voice` is true). */
export function stop(voice = true) {
  session++;
  clear();
  if (voice && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  if (state) emit(null);
}

/** Speaks one word (from a tap). Returns false when the device has no speech. */
export function sayWord(say: string, slow = false): boolean {
  stop(false);
  return speak(say, slow);
}

/**
 * Speaks `toks` and highlights each word in `group` as it is read. Call from a tap (iOS). Returns false when
 * the device has no speech. `reduced` (prefers-reduced-motion) keeps the highlight but drops its transition (CSS side).
 */
export function playKaraoke(group: string, toks: Tok[], slow = false): boolean {
  stop(false);
  const id = ++session;
  const text = toks.map((t) => t.text).join(" ");
  const { starts, total } = karaokeTimes(toks, slow);
  const offsets = charStarts(toks);
  let boundaryMode = false;
  const show = (i: number) => { if (id === session && toks[i]?.word) emit({ group, index: i }); };
  const finish = () => { if (id !== session) return; clear(); emit(null); };
  const ok = speak(text, slow, {
    boundary: (c) => {
      if (id !== session) return;
      if (!boundaryMode) { boundaryMode = true; clear(); timers.push(setTimeout(finish, total * 2 + 4000)); } // safety net
      let i = 0;
      while (i + 1 < offsets.length && offsets[i + 1] <= c) i++;
      show(i);
    },
    end: finish,
  });
  if (!ok) return false;
  starts.forEach((s, i) => timers.push(setTimeout(() => !boundaryMode && show(i), s)));
  timers.push(setTimeout(() => !boundaryMode && finish(), total + 700));
  return true;
}
