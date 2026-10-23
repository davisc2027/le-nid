/** Ring buffer for the pre-roll, and clip assembly (pre-roll + live frames - trailing silence). Pure. */
export function createRing(capacity: number) {
  const data = new Float32Array(capacity);
  let write = 0, filled = 0;
  return {
    push(frame: Float32Array) {
      for (let i = 0; i < frame.length; i++) { data[write] = frame[i]; write = (write + 1) % capacity; }
      filled = Math.min(capacity, filled + frame.length);
    },
    /** The most recent samples, oldest first. */
    snapshot(): Float32Array {
      const out = new Float32Array(filled);
      const start = (write - filled + capacity) % capacity;
      for (let i = 0; i < filled; i++) out[i] = data[(start + i) % capacity];
      return out;
    },
    clear() { write = 0; filled = 0; },
    size: () => filled,
  };
}

/** preRoll + live frames, with `trimSamples` removed from the end (trailing silence beyond the kept tail). */
export function assembleClip(preRoll: Float32Array, frames: Float32Array[], trimSamples = 0): Float32Array {
  let live = 0;
  for (const f of frames) live += f.length;
  const total = Math.max(0, preRoll.length + live - Math.max(0, trimSamples));
  const out = new Float32Array(total);
  out.set(preRoll.subarray(0, Math.min(preRoll.length, total)), 0);
  let o = preRoll.length;
  for (const f of frames) {
    if (o >= total) break;
    const n = Math.min(f.length, total - o);
    out.set(f.subarray(0, n), o);
    o += n;
  }
  return out;
}
