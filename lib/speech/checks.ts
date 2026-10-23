/**
 * On-device checks for one spoken attempt: speech heard, length in a generous range, too quiet, too noisy, and for
 * yes/no questions whether the pitch rose at the end. Pure and deterministic. No scores are produced.
 * Decision order and thresholds: docs/speaking-build-spec.md section 6.
 */
import { DEFAULT_FEATURES, frameSignal, resample, speechProblem, trimSilence } from "./features";
import { finalMovement, yinTrack } from "./pitch";
import { durationRange, isRiseQuestion, syllables } from "./text";

export type StopReason = "silence" | "cap" | "tap" | "no-speech";
export type ResultState = "success" | "near-miss" | "thanks" | "no-speech" | "too-quiet" | "too-noisy" | "too-short" | "too-long";
export type AttemptResult = {
  state: ResultState; rose: boolean | null; riseSt: number | null; speechSec: number; peakDb: number; noiseDb: number;
  snrDb: number; minSec: number; maxSec: number; contour: number[] | null;
};

/** Peak frame energy below this (dB) is "too quiet": 15 dB above the silence gate. To be calibrated in the Speak lab. */
export const QUIET_PEAK_DB = -45;

const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const percentile10 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(0.1 * (xs.length - 1))];

type Input = { samples: Float32Array; sampleRate: number; fr: string; stoppedBy: StopReason; attempt: number };

/** Pitch movement and a small contour for the trimmed span. */
function pitchOf(samples: Float32Array, sampleRate: number, start: number, end: number): { riseSt: number | null; contour: number[] | null } {
  const hop = Math.round(sampleRate * 0.01);
  const seg16 = resample(samples.subarray(Math.min(samples.length, start * hop), Math.min(samples.length, end * hop)), sampleRate, 16000);
  let peak = 0;
  for (let i = 0; i < seg16.length; i++) peak = Math.max(peak, Math.abs(seg16[i]));
  if (peak <= 0) return { riseSt: null, contour: null };
  for (let i = 0; i < seg16.length; i++) seg16[i] *= 0.5 / peak;
  const f0 = yinTrack(seg16, 16000);
  const mv = finalMovement(f0);
  const voiced = Array.from(f0).filter((hz) => hz > 0);
  let contour: number[] | null = null;
  if (voiced.length >= 5) {
    const mid = median(voiced);
    const st = voiced.map((hz) => r1(12 * Math.log2(hz / mid)));
    const step = Math.max(1, Math.ceil(st.length / 60));
    contour = st.filter((_, i) => i % step === 0);
  }
  return { riseSt: mv === null ? null : r1(mv), contour };
}

export function analyzeAttempt(a: Input): AttemptResult {
  const cfg = { ...DEFAULT_FEATURES, sampleRate: a.sampleRate };
  const energyDb = frameSignal(a.samples, cfg).energyDb;
  const problem = speechProblem(energyDb);
  const peakDb = energyDb.length ? r1(Math.max(...energyDb)) : -120;
  const noiseDb = energyDb.length ? r1(percentile10(energyDb)) : -120;
  const trim = trimSilence(energyDb);
  const speechSec = trim ? r2(Math.max(0, trim.end - trim.start - 10) * 0.01) : 0;
  const { minSec, maxSec } = durationRange(syllables(a.fr));
  const rise = isRiseQuestion(a.fr);
  const out: AttemptResult = {
    state: "success", rose: null, riseSt: null, speechSec, peakDb, noiseDb, snrDb: r1(peakDb - noiseDb), minSec, maxSec, contour: null,
  };

  if (a.stoppedBy === "no-speech" || problem === "silent") out.state = "no-speech";
  else if (problem === "noisy") out.state = "too-noisy";
  else if (peakDb < QUIET_PEAK_DB) out.state = "too-quiet";
  else if (a.stoppedBy === "cap" || speechSec > maxSec) out.state = "too-long";
  else if (speechSec < minSec) out.state = "too-short";
  else {
    if (rise && trim) {
      const p = pitchOf(a.samples, a.sampleRate, trim.start, trim.end);
      out.riseSt = p.riseSt;
      out.contour = p.contour;
    }
    if (rise && out.riseSt !== null && out.riseSt <= 0.5) out.state = "near-miss";
    else if (rise && out.riseSt !== null) out.rose = out.riseSt >= 2;
  }
  if (a.attempt >= 3 && (out.state === "too-short" || out.state === "too-long" || out.state === "near-miss")) out.state = "thanks";
  return out;
}
