/** 16-bit PCM mono WAV from float samples (44-byte header). */
export function encodeWavBytes(samples: ArrayLike<number>, sampleRate: number): Uint8Array {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + 2 * n);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + 2 * n, true); str(8, "WAVE");
  str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, "data"); v.setUint32(40, 2 * n, true);
  for (let i = 0; i < n; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + 2 * i, x < 0 ? Math.round(x * 32768) : Math.round(x * 32767), true);
  }
  return new Uint8Array(buf);
}

export function encodeWav(samples: ArrayLike<number>, sampleRate: number): Blob {
  return new Blob([encodeWavBytes(samples, sampleRate) as BlobPart], { type: "audio/wav" });
}
