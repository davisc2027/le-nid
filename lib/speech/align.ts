/**
 * Used by lib/speech/checks.ts (features, pitch) and the Speak lab (score, align). Banded dynamic time warping between a reference and an attempt, with the local cost
 * mapped back onto reference frames so it can be averaged per reference word.
 */

export type DtwResult = {
  /** Total path cost divided by path length (mean local distance along the best path). */
  distance: number;
  path: Array<[number, number]>;
  /** Mean local distance of the path cells that touch each reference frame. */
  refCost: Float64Array;
};

const euclid = (a: number[], b: number[]) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s / a.length);
};

/**
 * Symmetric DTW (steps (1,0), (0,1), (1,1)) inside a Sakoe-Chiba band around the length-scaled diagonal.
 * `band` is the half-width as a fraction of the attempt length (0.25 allows a quarter of the clip of drift).
 * Null when either side is empty.
 */
export function dtw(ref: number[][], hyp: number[][], band = 0.25): DtwResult | null {
  const n = ref.length;
  const m = hyp.length;
  if (!n || !m) return null;
  const w = Math.max(3, Math.ceil(band * Math.max(n, m)));
  const INF = Number.POSITIVE_INFINITY;
  const D = new Float64Array((n + 1) * (m + 1)).fill(INF);
  const L = new Float64Array((n + 1) * (m + 1)); // path length, for the normalized cost
  const at = (i: number, j: number) => i * (m + 1) + j;
  D[at(0, 0)] = 0;
  for (let i = 1; i <= n; i++) {
    const centre = (i * m) / n;
    const lo = Math.max(1, Math.floor(centre - w));
    const hi = Math.min(m, Math.ceil(centre + w));
    for (let j = lo; j <= hi; j++) {
      const c = euclid(ref[i - 1], hyp[j - 1]);
      // ties broken in a fixed order (diagonal, then ref step, then attempt step) so the path is reproducible
      let best = D[at(i - 1, j - 1)], len = L[at(i - 1, j - 1)];
      if (D[at(i - 1, j)] < best) { best = D[at(i - 1, j)]; len = L[at(i - 1, j)]; }
      if (D[at(i, j - 1)] < best) { best = D[at(i, j - 1)]; len = L[at(i, j - 1)]; }
      if (best === INF) continue;
      D[at(i, j)] = best + c;
      L[at(i, j)] = len + 1;
    }
  }
  if (D[at(n, m)] === INF) return null;
  // backtrack
  const path: Array<[number, number]> = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const diag = D[at(i - 1, j - 1)], up = D[at(i - 1, j)], left = D[at(i, j - 1)];
    if (diag <= up && diag <= left) { i--; j--; } else if (up <= left) i--; else j--;
  }
  path.reverse();
  const sum = new Float64Array(n);
  const cnt = new Float64Array(n);
  for (const [a, b] of path) { sum[a] += euclid(ref[a], hyp[b]); cnt[a]++; }
  const refCost = new Float64Array(n);
  for (let k = 0; k < n; k++) refCost[k] = cnt[k] ? sum[k] / cnt[k] : 0;
  return { distance: D[at(n, m)] / L[at(n, m)], path, refCost };
}

/** Mean of refCost over each [start, end) frame span (spans are clamped to the array). */
export function spanMeans(refCost: ArrayLike<number>, spans: Array<[number, number]>): number[] {
  return spans.map(([s, e]) => {
    const a = Math.max(0, Math.min(refCost.length, s));
    const b = Math.max(a, Math.min(refCost.length, e));
    let t = 0;
    for (let k = a; k < b; k++) t += refCost[k];
    return b > a ? t / (b - a) : 0;
  });
}
