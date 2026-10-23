// SPIKE TESTS for lib/speech (unwired). Run from the repo root:
//   node --experimental-strip-types lib/speech/speech.test.mjs
//
// There is no real speech here. The signals are formant-synthesized vowel strings (an impulse train through a
// glottal low-pass and four resonators), so these tests show how the DSP behaves on controlled changes (gain,
// noise, tempo, pitch, vocal-tract length, one swapped vowel). They do NOT show that scores match human judgments
// of French pronunciation; that needs the calibration set described in docs/speaking-plan.md.
import { register } from "node:module";
import assert from "node:assert/strict";

// lib/speech uses extensionless imports (for Next and tsc); let Node find the .ts files.
register(
  "data:text/javascript," +
    encodeURIComponent(`export async function resolve(s, c, next) {
      if (s.startsWith(".") && !/\\.[cm]?[jt]s$/.test(s)) { try { return await next(s + ".ts", c); } catch {} }
      return next(s, c);
    }`),
);
const P = await import("./pitch.ts");
const S = await import("./score.ts");

const SR = 16000;
// Male-like formants (Hz). y is French u (rue), u is French ou (vous), oe is eu (peu).
const V = {
  a: [730, 1300, 2500, 3500], i: [280, 2250, 2950, 3500], u: [310, 800, 2250, 3300], y: [280, 1800, 2200, 3300],
  e: [400, 2050, 2650, 3500], o: [420, 800, 2550, 3500], oe: [380, 1500, 2300, 3400],
};
const BW = [70, 100, 130, 170];

function prng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * segs: [{ v: "a", ms: 150 } | { sil: 80 }]. f0: Hz, or (progress 0..1) => Hz. fScale: vocal-tract scaling of all
 * formants (about 1.15-1.2 for a typical adult female vs male). tempo: multiplies every duration.
 */
function synth(segs, { f0 = 110, fScale = 1, tempo = 1, gain = 1, lead = 300, tail = 300 } = {}) {
  const parts = [{ sil: lead }, ...segs, { sil: tail }].map((s) => ({ ...s, n: Math.round(((s.ms ?? s.sil) * (s.v ? tempo : s.sil === lead || s.sil === tail ? 1 : tempo) * SR) / 1000) }));
  const total = parts.reduce((t, p) => t + p.n, 0);
  const out = new Float64Array(total);
  const y1 = [0, 0, 0, 0], y2 = [0, 0, 0, 0];
  let phase = 0, g1 = 0, g2 = 0, pos = 0, prevF = null;
  for (const p of parts) {
    const target = p.v ? V[p.v].map((f) => f * fScale) : null;
    const from = prevF ?? target;
    for (let k = 0; k < p.n; k++, pos++) {
      if (!target) { out[pos] = 0; continue; }
      const prog = pos / total;
      const hz = typeof f0 === "function" ? f0(prog) : f0;
      phase += hz / SR;
      let src = 0;
      if (phase >= 1) { phase -= 1; src = 1; }
      g1 = 0.97 * g1 + src; g2 = 0.9 * g2 + g1 * 0.03; // glottal pulse shaping, about -12 dB/oct
      const tr = Math.min(1, k / (0.03 * SR)); // 30 ms formant transition from the previous vowel
      let x = g2;
      for (let r = 0; r < 4; r++) {
        const F0r = from[r] + (target[r] - from[r]) * tr;
        const bw = BW[r] * fScale;
        const C = -Math.exp((-2 * Math.PI * bw) / SR);
        const B = 2 * Math.exp((-Math.PI * bw) / SR) * Math.cos((2 * Math.PI * F0r) / SR);
        const A = 1 - B - C;
        const yv = A * x + B * y1[r] + C * y2[r];
        y2[r] = y1[r]; y1[r] = yv; x = yv;
      }
      // one loudness bump per vowel, dipping to -20 dB at its edges (a stand-in for consonants between syllables)
      out[pos] = x * (0.1 + 0.9 * Math.sin((Math.PI * k) / p.n));
    }
    if (target) prevF = target;
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < out.length; i++) out[i] = (out[i] / peak) * 0.5 * gain;
  return out;
}

function addNoise(x, snrDb, seed = 7) {
  const rnd = prng(seed);
  let sp = 0, n = 0;
  for (const v of x) if (Math.abs(v) > 1e-4) { sp += v * v; n++; }
  const noiseRms = Math.sqrt(sp / n) / Math.pow(10, snrDb / 20);
  return x.map((v) => v + (rnd() * 2 - 1) * noiseRms * Math.sqrt(3));
}

// Reference "phrase": three words of two vowels each, with short pauses. Words: [a i] [u e] [o a]
const PHRASE = [{ v: "a", ms: 140 }, { v: "i", ms: 140 }, { sil: 70 }, { v: "u", ms: 160 }, { v: "e", ms: 140 }, { sil: 70 }, { v: "o", ms: 150 }, { v: "a", ms: 170 }];
const swap = (from, to) => PHRASE.map((s) => (s.v === from ? { ...s, v: to } : s));
function wordsOf(segs, lead = 300) {
  const words = [];
  let t = lead, cur = null;
  for (const s of segs) {
    if (s.sil) { if (cur) { cur.endMs = t; words.push(cur); cur = null; } t += s.sil; continue; }
    if (!cur) cur = { text: `w${words.length + 1}`, startMs: t, endMs: t };
    t += s.ms;
  }
  if (cur) { cur.endMs = t; words.push(cur); }
  return words;
}
const REF = { samples: synth(PHRASE), sampleRate: SR, words: wordsOf(PHRASE) };
const run = (samples, opts) => S.compare(REF, { samples, sampleRate: SR }, opts);

let failures = 0;
const results = [];
function check(name, fn) {
  try { fn(); results.push(["ok  ", name]); } catch (e) { failures++; results.push(["FAIL", `${name}: ${e.message}`]); }
}

// ---- conditions ------------------------------------------------------------------------------------------------
const C = {
  identical: run(synth(PHRASE)),
  "gain x0.15": run(synth(PHRASE, { gain: 0.15 })),
  "gain x1.8 (near clipping)": run(synth(PHRASE, { gain: 1.8 }).map((v) => Math.max(-1, Math.min(1, v)))),
  "extra silence 1.5 s + 30 dB noise": run(addNoise(synth(PHRASE, { lead: 1500, tail: 1500 }), 30)),
  "white noise SNR 20 dB": run(addNoise(synth(PHRASE), 20)),
  "white noise SNR 30 dB": run(addNoise(synth(PHRASE), 30)),
  "white noise SNR 10 dB": run(addNoise(synth(PHRASE), 10)),
  "slower x1.35": run(synth(PHRASE, { tempo: 1.35 })),
  "faster x0.75": run(synth(PHRASE, { tempo: 0.75 })),
  "pitch 110 -> 180 Hz": run(synth(PHRASE, { f0: 180 })),
  "other voice (formants x1.17, f0 210), no warp": run(synth(PHRASE, { fScale: 1.17, f0: 210 }), { warps: [1] }),
  "other voice (formants x1.17, f0 210), warp search": run(synth(PHRASE, { fScale: 1.17, f0: 210 })),
  "ERROR ou->u in word 2 (same voice)": run(synth(swap("u", "y"))),
  "ERROR ou->u in word 2 (other voice, warp)": run(synth(swap("u", "y"), { fScale: 1.17, f0: 210 })),
  "ERROR o->eu in word 3 (same voice)": run(synth(swap("o", "oe"))),
  "ERROR all vowels different": run(synth(PHRASE.map((s) => (s.v ? { ...s, v: { a: "i", i: "u", u: "a", e: "o", o: "e" }[s.v] } : s)))),
};

// ---- assertions: only what synthetic signals can honestly show ------------------------------------------------------
check("determinism: identical input -> identical result object (run twice)", () => {
  const a = JSON.stringify(run(synth(swap("u", "y"), { fScale: 1.1, f0: 150 })));
  const b = JSON.stringify(run(synth(swap("u", "y"), { fScale: 1.1, f0: 150 })));
  assert.equal(a, b);
});
check("identical recording scores distance 0", () => assert.equal(C.identical.distance, 0));
check("gain does not matter (CMVN, c0 dropped)", () => {
  assert.ok(C["gain x0.15"].distance < 0.02, `got ${C["gain x0.15"].distance}`);
});
check("leading/trailing silence and low noise are trimmed (duration ratio stays near 1)", () => {
  const r = C["extra silence 1.5 s + 30 dB noise"];
  assert.ok(Math.abs(r.durationRatio - 1) < 0.15, `ratio ${r.durationRatio}`);
});
check("tempo changes are absorbed by DTW better than a one-vowel error", () => {
  const err = C["ERROR ou->u in word 2 (same voice)"].distance;
  assert.ok(C["slower x1.35"].distance < err && C["faster x0.75"].distance < err);
});
check("the swapped vowel's word is the outlier (same voice)", () => {
  const w = C["ERROR ou->u in word 2 (same voice)"].words;
  assert.equal(w.reduce((a, b) => (b.relative > a.relative ? b : a)).text, "w2");
});
check("the swapped vowel's word is the outlier (other voice, with warp search)", () => {
  const w = C["ERROR ou->u in word 2 (other voice, warp)"].words;
  assert.equal(w.reduce((a, b) => (b.relative > a.relative ? b : a)).text, "w2");
});
check("warp search lowers the cross-voice distance", () => {
  assert.ok(C["other voice (formants x1.17, f0 210), warp search"].distance < C["other voice (formants x1.17, f0 210), no warp"].distance);
});
check("silence-only clip -> no-speech; very noisy clip -> too-noisy (refuse rather than misjudge)", () => {
  assert.equal(run(new Float64Array(SR * 2)).reason, "no-speech");
  const noisy = run(addNoise(synth(PHRASE), 5));
  assert.equal(noisy.reason, "too-noisy");
});
check("rising vs falling question contour (YIN, semitones vs own median)", () => {
  const rise = synth(PHRASE, { f0: (p) => (p < 0.6 ? 120 : 120 * Math.pow(2, ((p - 0.6) / 0.25) * 5 / 12)) });
  const fall = synth(PHRASE, { f0: (p) => (p < 0.6 ? 120 : 120 * Math.pow(2, -((p - 0.6) / 0.25) * 4 / 12)) });
  const highRise = synth(PHRASE, { f0: (p) => (p < 0.6 ? 220 : 220 * Math.pow(2, ((p - 0.6) / 0.25) * 5 / 12)) });
  const mr = P.finalMovement(P.yinTrack(rise, SR)), mf = P.finalMovement(P.yinTrack(fall, SR)), mh = P.finalMovement(P.yinTrack(highRise, SR));
  results.push(["info", `final movement (st): rise ${mr?.toFixed(2)}, fall ${mf?.toFixed(2)}, high-voice rise ${mh?.toFixed(2)}`]);
  assert.ok(mr > 1.5 && mh > 1.5 && mf < -1);
});
check("energy-envelope nuclei: reference has about one nucleus per vowel (6)", () => {
  const n = C.identical.nuclei.ref;
  results.push(["info", `nuclei ref=${n}`]);
  assert.ok(n >= 4 && n <= 8);
});
check("speed: one 2 s comparison with 10 warps", () => {
  const t = performance.now();
  run(synth(PHRASE, { fScale: 1.1 }));
  const ms = performance.now() - t;
  results.push(["info", `compare() with 10 warps: ${ms.toFixed(0)} ms on this machine (Node, desktop CPU)`]);
  assert.ok(ms < 5000);
});

// ---- the two findings that matter for the design ---------------------------------------------------------------------
{
  const entries = Object.entries(C).filter(([, r]) => r.ok && r.distance > 0);
  const good = entries.filter(([n]) => !n.startsWith("ERROR") && !n.includes("no warp"));
  const bad = entries.filter(([n]) => n.startsWith("ERROR") && !n.includes("all vowels"));
  const maxGoodAbs = Math.max(...good.map(([, r]) => r.distance));
  const minBadAbs = Math.min(...bad.map(([, r]) => r.distance));
  const maxGoodRel = Math.max(...good.map(([, r]) => Math.max(...r.words.map((w) => w.relative))));
  const minBadRel = Math.min(...bad.map(([, r]) => Math.max(...r.words.map((w) => w.relative))));
  results.push(["info", `ABSOLUTE distance: correct-but-different (pitch, voice, noise, tempo) up to ${maxGoodAbs.toFixed(3)}; one-vowel errors from ${minBadAbs.toFixed(3)} -> ${maxGoodAbs < minBadAbs ? "separable" : "NOT separable: do not grade on it"}`]);
  results.push(["info", `RELATIVE word outlier: correct-but-different up to ${maxGoodRel.toFixed(2)}; one-vowel errors from ${minBadRel.toFixed(2)} -> ${maxGoodRel < minBadRel ? "separable on these synthetic signals" : "NOT separable"}`]);
  results.push(["info", `all-vowels-wrong attempt: max relative ${Math.max(...C["ERROR all vowels different"].words.map((w) => w.relative)).toFixed(2)} (relative scoring is blind to errors spread over every word)`]);
  check("documented limitation: pitch alone moves the absolute distance about as much as a real vowel error", () => {
    assert.ok(C["pitch 110 -> 180 Hz"].distance > 0.5 * C["ERROR ou->u in word 2 (same voice)"].distance);
  });
}

// ---- report ---------------------------------------------------------------------------------------------------------
const errRef = C["ERROR ou->u in word 2 (same voice)"].distance;
console.log("\nCondition".padEnd(52), "distance  warp  dur   words (relative cost)");
for (const [name, r] of Object.entries(C)) {
  if (!r.ok) { console.log(name.padEnd(51), r.reason); continue; }
  const flag = name.startsWith("ERROR") ? "" : r.distance >= errRef ? "  <-- as far as a real vowel error" : "";
  console.log(name.padEnd(51), r.distance.toFixed(3).padStart(8), String(r.warp).padStart(5), r.durationRatio.toFixed(2).padStart(5), " ", r.words.map((w) => `${w.text}:${w.relative.toFixed(2)}`).join(" "), flag);
}
console.log("");
for (const [s, m] of results) console.log(s, m);
console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
console.log("Reminder: synthetic vowels only. This proves determinism and invariance properties, not validity on real French speech.");
process.exitCode = failures ? 1 : 0;
