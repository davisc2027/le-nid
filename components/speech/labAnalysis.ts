/** Speak lab analysis helpers: extra numbers for one attempt, and the reference comparison. Client-side only. */
import { analyzeAttempt, type AttemptResult } from "@/lib/speech/checks";
import { countNuclei, DEFAULT_FEATURES, extract, frameSignal, trimSilence } from "@/lib/speech/features";
import { compare, PLACEHOLDER_THRESHOLDS, weakestWord, type RefWord, type WordScore } from "@/lib/speech/score";
import { speechWords, syllables } from "@/lib/speech/text";
import type { Recording } from "./useRecorder";

export type LabAnalysis = { result: AttemptResult; nuclei: number; analysisMs: number };
export type RefCompare = {
  voice: string; refSec: number; nucleiRef: number; ok: boolean; reason?: string;
  distance?: number; warp?: number; durationRatio?: number; words: WordScore[]; maxRelative: number | null; weakest: string;
};

export function analyzeForLab(rec: Recording, fr: string): LabAnalysis {
  const t0 = performance.now();
  const result = analyzeAttempt({ samples: rec.samples, sampleRate: rec.sampleRate, fr, stoppedBy: rec.stoppedBy, attempt: 1 });
  const energyDb = frameSignal(rec.samples, { ...DEFAULT_FEATURES, sampleRate: rec.sampleRate }).energyDb;
  const trim = trimSilence(energyDb);
  const nuclei = trim ? countNuclei(energyDb.slice(trim.start, trim.end)) : 0;
  return { result, nuclei, analysisMs: Math.round(performance.now() - t0) };
}

/** Word spans are approximate: the reference's trimmed span is split in proportion to each word's syllables. */
export function compareWithReference(ref: { samples: Float32Array; sampleRate: number }, rec: Recording, fr: string, voice: string): RefCompare {
  const r = extract(ref.samples, ref.sampleRate);
  const empty = { voice, refSec: Math.round((ref.samples.length / ref.sampleRate) * 100) / 100, nucleiRef: 0, words: [], maxRelative: null, weakest: "" };
  if (!r) return { ...empty, ok: false, reason: "bad-reference" };
  const hop = DEFAULT_FEATURES.hopMs;
  const startMs = r.trim.start * hop, spanMs = (r.trim.end - r.trim.start) * hop;
  const words = speechWords(fr);
  const syl = words.map((w) => syllables(w));
  const total = syl.reduce((a, b) => a + b, 0) || 1;
  let at = startMs;
  const spans: RefWord[] = words.map((text, i) => {
    const len = (spanMs * syl[i]) / total;
    const w = { text, startMs: Math.round(at), endMs: Math.round(at + len) };
    at += len;
    return w;
  });
  const c = compare({ ...ref, words: spans }, { samples: rec.samples, sampleRate: rec.sampleRate });
  if (!c.ok) return { ...empty, ok: false, reason: c.reason };
  const weak = weakestWord(c.words, PLACEHOLDER_THRESHOLDS);
  return {
    ...empty, ok: true, nucleiRef: c.nuclei.ref, distance: c.distance, warp: c.warp, durationRatio: c.durationRatio, words: c.words,
    maxRelative: c.words.length ? Math.max(...c.words.map((w) => w.relative)) : null, weakest: weak?.text ?? "",
  };
}
