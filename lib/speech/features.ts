/**
 * SPIKE, NOT WIRED INTO THE APP (nothing imports lib/speech). See docs/speaking-plan.md.
 *
 * Deterministic speech features in plain TypeScript, no dependencies: resampling to 16 kHz, framing, FFT, a mel
 * filterbank with an optional VTLN-style frequency warp (speaker normalization), log-mel, MFCC, per-utterance CMVN,
 * frame energy, silence trimming and a syllable-nucleus count from the energy envelope.
 *
 * All math is Float64. The same input gives the same output on the same JS engine. Across engines the result can
 * differ in the last bits, because ECMAScript leaves Math.log/cos/exp "implementation-approximated"; callers that
 * need cross-device stability should round scores (score.ts does) and keep thresholds away from hard edges.
 */

export type FeatureConfig = {
  sampleRate: number;
  frameMs: number;
  hopMs: number;
  fftSize: number;
  melBands: number;
  fMin: number;
  /** Kept below Nyquist / max warp (8000 / 1.2) so warped filters stay inside the spectrum. */
  fMax: number;
  numCeps: number;
  preEmphasis: number;
  /**
   * Log-mel floor, in dB below the utterance's loudest band energy. Without it, near-silent frames (digital silence
   * in a studio reference vs room noise on a phone) differ wildly in log space and dominate the distance.
   */
  dynamicRangeDb: number;
  /**
   * VTLN-style warp: the filter that looks at frequency f in the reference looks at f * warp in this signal.
   * A speaker whose formants sit about 15% higher (typical adult female vs male) matches best near 1.15.
   */
  warp: number;
};

export const DEFAULT_FEATURES: FeatureConfig = {
  sampleRate: 16000,
  frameMs: 25,
  hopMs: 10,
  fftSize: 512,
  melBands: 40,
  fMin: 100,
  fMax: 6500,
  numCeps: 13,
  preEmphasis: 0.97,
  dynamicRangeDb: 45,
  warp: 1,
};

type Samples = ArrayLike<number>;

/** Band-limited resampling (Hann-windowed sinc). Deterministic; good enough for 48 or 44.1 kHz mic input to 16 kHz. */
export function resample(x: Samples, from: number, to: number): Float64Array {
  if (from === to) return Float64Array.from(x);
  const ratio = to / from;
  const cutoff = Math.min(1, ratio) * 0.95; // fraction of the input Nyquist
  const half = Math.ceil(12 / cutoff); // kernel half-width in input samples
  const out = new Float64Array(Math.floor(x.length * ratio));
  for (let n = 0; n < out.length; n++) {
    const t = n / ratio;
    const c = Math.floor(t);
    let sum = 0;
    let wsum = 0;
    for (let k = c - half + 1; k <= c + half; k++) {
      if (k < 0 || k >= x.length) continue;
      const d = t - k;
      const s = d === 0 ? 1 : Math.sin(Math.PI * cutoff * d) / (Math.PI * cutoff * d);
      const w = cutoff * s * 0.5 * (1 + Math.cos((Math.PI * d) / half));
      sum += x[k] * w;
      wsum += w;
    }
    out[n] = wsum > 0 ? (sum / wsum) * cutoff : 0;
  }
  return out;
}

const mel = (hz: number) => 2595 * Math.log10(1 + hz / 700);
const hzFromMel = (m: number) => 700 * (Math.pow(10, m / 2595) - 1);

type Plan = { cos: Float64Array; sin: Float64Array; rev: Uint32Array };
const plans = new Map<number, Plan>();
function plan(n: number): Plan {
  let p = plans.get(n);
  if (p) return p;
  if (n & (n - 1)) throw new Error("fftSize must be a power of two");
  const cos = new Float64Array(n / 2);
  const sin = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) { cos[k] = Math.cos((2 * Math.PI * k) / n); sin[k] = Math.sin((2 * Math.PI * k) / n); }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r = (r << 1) | ((i >> b) & 1);
    rev[i] = r;
  }
  p = { cos, sin, rev };
  plans.set(n, p);
  return p;
}

/** |X[k]|^2 for k = 0..n/2 of a real frame (zero-padded to n). Iterative radix-2 FFT. */
export function powerSpectrum(frame: ArrayLike<number>, n: number): Float64Array {
  const { cos, sin, rev } = plan(n);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < Math.min(frame.length, n); i++) re[rev[i]] = frame[i];
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const step = n / size;
    for (let i = 0; i < n; i += size) {
      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;
        const c = cos[j * step];
        const s = sin[j * step];
        const tr = re[b] * c + im[b] * s;
        const ti = im[b] * c - re[b] * s;
        re[b] = re[a] - tr; im[b] = im[a] - ti;
        re[a] += tr; im[a] += ti;
      }
    }
  }
  const out = new Float64Array(n / 2 + 1);
  for (let k = 0; k <= n / 2; k++) out[k] = re[k] * re[k] + im[k] * im[k];
  return out;
}

/** Triangular mel filters on FFT bins, edges multiplied by `warp`. */
export function melFilterbank(c: FeatureConfig): Float64Array[] {
  const bins = c.fftSize / 2 + 1;
  const binHz = c.sampleRate / c.fftSize;
  const lo = mel(c.fMin);
  const hi = mel(c.fMax);
  const edges: number[] = [];
  for (let i = 0; i < c.melBands + 2; i++) edges.push(Math.min(c.sampleRate / 2, hzFromMel(lo + ((hi - lo) * i) / (c.melBands + 1)) * c.warp));
  const bank: Float64Array[] = [];
  for (let m = 0; m < c.melBands; m++) {
    const [a, b, d] = [edges[m], edges[m + 1], edges[m + 2]];
    const w = new Float64Array(bins);
    for (let k = 0; k < bins; k++) {
      const f = k * binHz;
      if (f > a && f <= b) w[k] = (f - a) / (b - a);
      else if (f > b && f < d) w[k] = (d - f) / (d - b);
    }
    bank.push(w);
  }
  return bank;
}

export type Frames = { frames: Float64Array[]; energyDb: number[] };

/** Pre-emphasis, 25 ms Hamming frames every 10 ms, plus each frame's energy in dB (before pre-emphasis). */
export function frameSignal(x: ArrayLike<number>, c: FeatureConfig): Frames {
  const len = Math.round((c.sampleRate * c.frameMs) / 1000);
  const hop = Math.round((c.sampleRate * c.hopMs) / 1000);
  const count = x.length >= len ? 1 + Math.floor((x.length - len) / hop) : 0;
  const win = new Float64Array(len);
  for (let i = 0; i < len; i++) win[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (len - 1));
  const frames: Float64Array[] = [];
  const energyDb: number[] = [];
  for (let f = 0; f < count; f++) {
    const start = f * hop;
    const fr = new Float64Array(len);
    let e = 0;
    for (let i = 0; i < len; i++) {
      const s = x[start + i];
      e += s * s;
      const prev = start + i > 0 ? x[start + i - 1] : 0;
      fr[i] = (s - c.preEmphasis * prev) * win[i];
    }
    frames.push(fr);
    energyDb.push(10 * Math.log10(e / len + 1e-12));
  }
  return { frames, energyDb };
}

/** Log mel energies per frame, floored at `dynamicRangeDb` below the loudest band energy of these frames. */
export function logMel(frames: Float64Array[], c: FeatureConfig): number[][] {
  const bank = melFilterbank(c);
  const energies = frames.map((fr) => {
    const p = powerSpectrum(fr, c.fftSize);
    return bank.map((w) => {
      let s = 0;
      for (let k = 0; k < w.length; k++) if (w[k]) s += w[k] * p[k];
      return s;
    });
  });
  let max = 0;
  for (const e of energies) for (const v of e) if (v > max) max = v;
  const floor = Math.max(1e-10, max * Math.pow(10, -c.dynamicRangeDb / 10));
  return energies.map((e) => e.map((v) => Math.log(v + floor)));
}

/** Orthonormal DCT-II of each log-mel frame; c0 (overall level) is dropped by default. */
export function mfcc(logmel: number[][], numCeps: number, dropC0 = true): number[][] {
  if (!logmel.length) return [];
  const m = logmel[0].length;
  const table: number[][] = [];
  for (let k = 0; k < numCeps; k++) {
    const row: number[] = [];
    for (let j = 0; j < m; j++) row.push(Math.sqrt((k === 0 ? 1 : 2) / m) * Math.cos((Math.PI * k * (j + 0.5)) / m));
    table.push(row);
  }
  return logmel.map((v) => {
    const out: number[] = [];
    for (let k = dropC0 ? 1 : 0; k < numCeps; k++) {
      let s = 0;
      for (let j = 0; j < m; j++) s += table[k][j] * v[j];
      out.push(s);
    }
    return out;
  });
}

/** Per-utterance cepstral mean (and variance) normalization: removes the mic/room tilt and level. */
export function cmvn(feats: number[][], variance = true): number[][] {
  if (!feats.length) return [];
  const d = feats[0].length;
  const mean = new Float64Array(d);
  const sd = new Float64Array(d);
  for (const f of feats) for (let i = 0; i < d; i++) mean[i] += f[i] / feats.length;
  for (const f of feats) for (let i = 0; i < d; i++) sd[i] += (f[i] - mean[i]) ** 2 / feats.length;
  for (let i = 0; i < d; i++) sd[i] = Math.sqrt(sd[i]) || 1;
  return feats.map((f) => f.map((v, i) => (v - mean[i]) / (variance ? sd[i] : 1)));
}

const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
};

export type Trim = { start: number; end: number; noiseDb: number; peakDb: number };

/** Why a clip has no usable speech: nothing loud enough at all, or speech not clearly above the background. */
export function speechProblem(energyDb: number[]): "silent" | "noisy" | null {
  if (energyDb.length < 10) return "silent";
  const peakDb = Math.max(...energyDb);
  if (peakDb < -60) return "silent";
  if (peakDb - percentile(energyDb, 0.1) < 12) return "noisy";
  return null;
}

/**
 * Speech span in frames [start, end): frames above max(noise + 8 dB, peak - 40 dB), first and last run of at least
 * 3 such frames, padded by 5 frames. Null when the clip has no clear speech (peak under noise + 12 dB).
 */
export function trimSilence(energyDb: number[], pad = 5): Trim | null {
  if (speechProblem(energyDb)) return null;
  const noiseDb = percentile(energyDb, 0.1);
  const peakDb = Math.max(...energyDb);
  const th = Math.max(noiseDb + 8, peakDb - 40);
  const on = energyDb.map((e) => e > th);
  const run = (i: number) => on[i] && on[i + 1] && on[i + 2];
  let first = -1;
  let last = -1;
  for (let i = 0; i + 2 < on.length; i++) if (run(i)) { if (first < 0) first = i; last = i + 2; }
  if (first < 0) return null;
  return { start: Math.max(0, first - pad), end: Math.min(energyDb.length, last + 1 + pad), noiseDb, peakDb };
}

/**
 * Syllable-like nuclei: peaks of the smoothed energy envelope that rise at least `promDb` above the dips on both
 * sides and sit within 25 dB of the loudest frame. A rough rhythm cue, not a phonological syllable count.
 */
export function countNuclei(energyDb: number[], promDb = 4): number {
  const sm = energyDb.map((_, i) => {
    let s = 0, n = 0;
    for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < energyDb.length) { s += energyDb[j]; n++; }
    return s / n;
  });
  const peak = Math.max(...sm);
  let count = 0;
  for (let i = 0; i < sm.length; i++) {
    const leftOk = i === 0 || sm[i] >= sm[i - 1];
    const rightOk = i === sm.length - 1 || sm[i] > sm[i + 1];
    if (!leftOk || !rightOk || sm[i] < peak - 25) continue;
    // topographic prominence: the higher of the two lowest points before reaching a higher frame on each side
    let leftMin = sm[i];
    for (let j = i - 1; j >= 0 && sm[j] <= sm[i]; j--) leftMin = Math.min(leftMin, sm[j]);
    let rightMin = sm[i];
    for (let j = i + 1; j < sm.length && sm[j] <= sm[i]; j++) rightMin = Math.min(rightMin, sm[j]);
    if (sm[i] - Math.max(leftMin, rightMin) >= promDb) count++;
  }
  return count;
}

export type Extracted = {
  /** CMVN-normalized MFCCs (c1..c12) of the trimmed span. */
  feats: number[][];
  trim: Trim;
  /** Energy of every frame (untrimmed), for rhythm checks. */
  energyDb: number[];
  /** The 16 kHz signal. */
  signal: Float64Array;
};

/** Mic samples at any rate -> trimmed, normalized features. Null when no speech is found. */
export function extract(samples: Samples, sampleRate: number, partial: Partial<FeatureConfig> = {}, trimFrom?: Trim): Extracted | null {
  const c = { ...DEFAULT_FEATURES, ...partial };
  const signal = resample(samples, sampleRate, c.sampleRate);
  const { frames, energyDb } = frameSignal(signal, c);
  const trim = trimFrom ?? trimSilence(energyDb);
  if (!trim) return null;
  const lm = logMel(frames.slice(trim.start, trim.end), c);
  return { feats: cmvn(mfcc(lm, c.numCeps)), trim, energyDb, signal };
}
