/**
 * Sliding-window limiter kept in memory (per server instance, best effort; fine for a 35-person group).
 * hit() records the request only when every window still has room.
 */
export type Window = { ms: number; max: number };

export function createRateLimiter(windows: Window[]) {
  const longest = Math.max(...windows.map((w) => w.ms));
  const hits = new Map<string, number[]>();

  function check(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < longest);
    hits.set(key, recent);
    let wait = 0;
    for (const w of windows) {
      const inWindow = recent.filter((t) => now - t < w.ms);
      if (inWindow.length >= w.max) wait = Math.max(wait, inWindow[inWindow.length - w.max] + w.ms - now);
    }
    return wait > 0 ? { ok: false, retryAfterSec: Math.max(1, Math.ceil(wait / 1000)) } : { ok: true };
  }

  return {
    check,
    hit(key: string, now = Date.now()) {
      const r = check(key, now);
      if (r.ok) hits.get(key)!.push(now);
      return r;
    },
  };
}
