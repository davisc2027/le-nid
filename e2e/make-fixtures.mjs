// Deterministic fake-microphone clips for the speaking tests (docs/speaking-build-spec.md 11.2). No dependencies.
// `node e2e/make-fixtures.mjs` writes 48 kHz mono 16-bit WAVs to e2e/fixtures/. Playwright runs it as globalSetup.
// `synth()` is also imported by lib/speech/phase1.test.mjs.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SR = 48000;

/** Uniform noise in +-amp from an LCG with seed 1. */
function noise(n, amp = 0.0003) {
  let x = 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x = (Math.imul(1664525, x) + 1013904223) >>> 0;
    out[i] = (x / 4294967296 * 2 - 1) * amp;
  }
  return out;
}

const F0 = {
  flat: () => 140,
  rising: (t) => (t < 0.8 ? 160 : 160 * 2 ** ((5 / 12) * (t - 0.8) / 0.4)),
  falling: (t) => (t < 0.8 ? 160 : 160 * 2 ** (-(5 / 12) * (t - 0.8) / 0.4)),
};

/**
 * kind: "flat" | "rising" | "falling" | "silence". Layout: lead seconds of noise, a voiced segment, tail seconds of noise.
 * Voiced part: 20 harmonics at 1/k, a syllable-like envelope every 0.4 s, peak 0.3.
 */
export function synth(kind = "flat", { lead = 0.5, voiced = 1.2, tail = 2.5, noiseAmp = 0.0003 } = {}) {
  const total = kind === "silence" ? Math.round(4.2 * SR) : Math.round((lead + voiced + tail) * SR);
  const out = noise(total, noiseAmp);
  if (kind === "silence") return out;
  const f0 = F0[kind];
  const start = Math.round(lead * SR);
  const n = Math.round(voiced * SR);
  const seg = new Float64Array(n);
  let phase = 0, peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += 2 * Math.PI * f0(t) / SR;
    let v = 0;
    for (let k = 1; k <= 20; k++) v += Math.sin(k * phase) / k;
    const fr = (t / 0.4) % 1;
    seg[i] = v * (0.15 + 0.85 * Math.sin(Math.PI * fr) ** 2);
    peak = Math.max(peak, Math.abs(seg[i]));
  }
  for (let i = 0; i < n; i++) out[start + i] += (seg[i] / peak) * 0.3;
  return out;
}

export function wavBytes(samples, rate = SR) {
  const n = samples.length;
  const b = Buffer.alloc(44 + 2 * n);
  b.write("RIFF", 0); b.writeUInt32LE(36 + 2 * n, 4); b.write("WAVE", 8); b.write("fmt ", 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(2 * n, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + 2 * i);
  return b;
}

export const FIXTURES = { "speechlike.wav": "flat", "rising.wav": "rising", "falling.wav": "falling", "silence.wav": "silence" };

export default async function writeFixtures() {
  const dir = fileURLToPath(new URL("./fixtures/", import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const [file, kind] of Object.entries(FIXTURES)) writeFileSync(dir + file, wavBytes(synth(kind)));
  return dir;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log("fixtures written to", await writeFixtures());
