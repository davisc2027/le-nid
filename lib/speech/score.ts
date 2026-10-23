/**
 * SPIKE, NOT WIRED INTO THE APP. Compares an attempt with a native reference recording of the same phrase.
 *
 * What this can tell a learner: whether speech was heard, whether its length and rhythm are in range, and which
 * reference WORD is the least like the reference relative to the learner's own other words. It cannot name the wrong
 * sound, and its absolute distance mixes voice and pronunciation, so the thresholds below are placeholders that must
 * be calibrated on real recordings (docs/speaking-plan.md, "Calibration") before any band is shown to learners.
 */
import { countNuclei, DEFAULT_FEATURES, extract, frameSignal, resample, speechProblem, type FeatureConfig } from "./features";
import { dtw, spanMeans } from "./align";

export type Audio = { samples: ArrayLike<number>; sampleRate: number };
export type RefWord = { text: string; startMs: number; endMs: number };
export type Reference = Audio & { words?: RefWord[] };

export type WordScore = { text: string; cost: number; /** cost / median word cost of this attempt */ relative: number };

export type CompareResult =
  | {
      ok: true;
      /** Mean frame distance along the best DTW path at the best warp (lower is closer). Rounded to 1e-4. */
      distance: number;
      warp: number;
      /** Attempt speech length / reference speech length. */
      durationRatio: number;
      nuclei: { ref: number; attempt: number };
      words: WordScore[];
    }
  | { ok: false; reason: "no-speech" | "too-noisy" | "too-short" | "too-long" | "bad-reference" };

export type CompareOptions = {
  features?: Partial<FeatureConfig>;
  band?: number;
  /** VTLN warp factors to try; the lowest distance wins. [1] disables speaker normalization. */
  warps?: number[];
};

export const DEFAULT_WARPS = [0.84, 0.88, 0.92, 0.96, 1, 1.04, 1.08, 1.12, 1.16, 1.2];

/** Rounding keeps results identical across engines whose Math.* differ in the last bits. */
const q = (x: number) => Math.round(x * 1e4) / 1e4;

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function compare(ref: Reference, attempt: Audio, opts: CompareOptions = {}): CompareResult {
  const fc = opts.features ?? {};
  const r = extract(ref.samples, ref.sampleRate, fc);
  if (!r) return { ok: false, reason: "bad-reference" };
  // trim the attempt once (at warp 1); every warp reuses the same span so only the spectrum mapping changes
  const base = extract(attempt.samples, attempt.sampleRate, fc);
  if (!base) {
    const c = { ...DEFAULT_FEATURES, ...fc };
    const problem = speechProblem(frameSignal(resample(attempt.samples, attempt.sampleRate, c.sampleRate), c).energyDb);
    return { ok: false, reason: problem === "noisy" ? "too-noisy" : "no-speech" };
  }
  const durationRatio = (base.trim.end - base.trim.start) / (r.trim.end - r.trim.start);
  if (durationRatio < 0.4) return { ok: false, reason: "too-short" };
  if (durationRatio > 2.5) return { ok: false, reason: "too-long" };

  let best: { d: number; warp: number; cost: Float64Array } | null = null;
  for (const warp of opts.warps ?? DEFAULT_WARPS) {
    const a = warp === 1 && !fc.warp ? base : extract(attempt.samples, attempt.sampleRate, { ...fc, warp }, base.trim);
    if (!a) continue;
    const res = dtw(r.feats, a.feats, opts.band ?? 0.25);
    if (res && (!best || res.distance < best.d)) best = { d: res.distance, warp, cost: res.refCost };
  }
  if (!best) return { ok: false, reason: "no-speech" };

  const hop = (fc.hopMs ?? 10);
  const words = ref.words ?? [];
  const spans = words.map((w): [number, number] => [Math.round(w.startMs / hop) - r.trim.start, Math.round(w.endMs / hop) - r.trim.start]);
  const costs = spanMeans(best.cost, spans);
  const mid = costs.length ? median(costs) || 1 : 1;
  return {
    ok: true,
    distance: q(best.d),
    warp: best.warp,
    durationRatio: q(durationRatio),
    nuclei: {
      ref: countNuclei(r.energyDb.slice(r.trim.start, r.trim.end)),
      attempt: countNuclei(base.energyDb.slice(base.trim.start, base.trim.end)),
    },
    words: words.map((w, k) => ({ text: w.text, cost: q(costs[k]), relative: q(costs[k] / mid) })),
  };
}

export type Band = "clear" | "close" | "again";
export type Thresholds = { clear: number; close: number; wordRelative: number };

/** PLACEHOLDERS ONLY. Real values come from the calibration set; never ship these. */
export const PLACEHOLDER_THRESHOLDS: Thresholds = { clear: 0.75, close: 0.95, wordRelative: 1.35 };

export function band(distance: number, t: Thresholds): Band {
  return distance <= t.clear ? "clear" : distance <= t.close ? "close" : "again";
}

/** The one word to highlight, if any: the clear outlier among the attempt's own words. */
export function weakestWord(words: WordScore[], t: Thresholds): WordScore | null {
  if (words.length < 2) return null;
  const top = words.reduce((a, b) => (b.relative > a.relative ? b : a));
  return top.relative >= t.wordRelative ? top : null;
}
