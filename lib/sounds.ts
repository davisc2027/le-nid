// Lesson sound effects, synthesized with Web Audio (no audio files). Must first run inside a tap on iPhone.
// iPhone mutes Web Audio when the silent switch is on.
const KEY = "le-nid-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", peak = 0.18) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator(), gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function play(fn: () => void) {
  if (!soundOn() || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    fn();
  } catch {}
}

export const playSuccess = () => play(() => { tone(784, 0, 0.14); tone(1047, 0.1, 0.28); });
export const playTick = () => play(() => tone(880, 0, 0.1, "sine", 0.12));
export const playError = () => play(() => { tone(233, 0, 0.18, "triangle", 0.2); tone(175, 0.14, 0.3, "triangle", 0.2); });
export const playDone = () => play(() => [523, 659, 784, 1047].forEach((f, k) => tone(f, k * 0.12, 0.3)));
