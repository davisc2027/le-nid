/**
 * SPIKE, NOT WIRED INTO THE APP. YIN pitch tracking (de Cheveigné & Kawahara 2002) and a final-contour check for
 * questions. Pitch is only used for "did the end of your question go up?", never for comparing voices: it is
 * expressed in semitones relative to the speaker's own median, so a low and a high voice are treated the same.
 */

export type PitchOptions = { hopMs: number; windowMs: number; fMin: number; fMax: number; threshold: number; minRms: number };
export const DEFAULT_PITCH: PitchOptions = { hopMs: 10, windowMs: 30, fMin: 70, fMax: 450, threshold: 0.15, minRms: 0.01 };

/** f0 in Hz per hop (0 = unvoiced or too quiet). */
export function yinTrack(x: ArrayLike<number>, sampleRate: number, partial: Partial<PitchOptions> = {}): Float64Array {
  const o = { ...DEFAULT_PITCH, ...partial };
  const hop = Math.round((sampleRate * o.hopMs) / 1000);
  const w = Math.round((sampleRate * o.windowMs) / 1000);
  const tauMin = Math.max(2, Math.floor(sampleRate / o.fMax));
  const tauMax = Math.ceil(sampleRate / o.fMin);
  const count = x.length > w + tauMax ? Math.floor((x.length - w - tauMax) / hop) + 1 : 0;
  const out = new Float64Array(count);
  const d = new Float64Array(tauMax + 2);
  for (let f = 0; f < count; f++) {
    const s = f * hop;
    let e = 0;
    for (let j = 0; j < w; j++) e += x[s + j] * x[s + j];
    if (Math.sqrt(e / w) < o.minRms) continue;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      let sum = 0;
      for (let j = 0; j < w; j++) { const diff = x[s + j] - x[s + j + tau]; sum += diff * diff; }
      d[tau] = sum;
    }
    // cumulative mean normalized difference
    let running = 0;
    let best = -1;
    const cm = new Float64Array(tauMax + 2);
    cm[0] = 1;
    for (let tau = 1; tau <= tauMax + 1; tau++) {
      running += d[tau];
      cm[tau] = running > 0 ? (d[tau] * tau) / running : 1;
    }
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (cm[tau] < o.threshold) {
        while (tau + 1 <= tauMax && cm[tau + 1] < cm[tau]) tau++;
        best = tau;
        break;
      }
    }
    if (best < 0) continue;
    // parabolic interpolation around the minimum
    const a = cm[best - 1], b = cm[best], c = cm[best + 1];
    const den = a - 2 * b + c;
    const shift = den !== 0 ? (0.5 * (a - c)) / den : 0;
    out[f] = sampleRate / (best + Math.max(-1, Math.min(1, shift)));
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * How far the last voiced stretch moves, in semitones: median f0 of the last `tailFrames` voiced frames vs the
 * median of the `beforeFrames` voiced frames just before them. Positive = rising. Null if too little voicing.
 * Octave errors are reduced by dropping frames more than 7 semitones from the utterance median.
 */
export function finalMovement(f0: ArrayLike<number>, tailFrames = 15, beforeFrames = 30): number | null {
  const voiced: number[] = [];
  for (let i = 0; i < f0.length; i++) if (f0[i] > 0) voiced.push(f0[i]);
  if (voiced.length < tailFrames + 10) return null;
  const mid = median(voiced);
  const st = (hz: number) => 12 * Math.log2(hz / mid);
  const clean = voiced.filter((hz) => Math.abs(st(hz)) <= 7);
  if (clean.length < tailFrames + 10) return null;
  const tail = clean.slice(-tailFrames);
  const before = clean.slice(Math.max(0, clean.length - tailFrames - beforeFrames), clean.length - tailFrames);
  return 12 * Math.log2(median(tail) / median(before));
}
