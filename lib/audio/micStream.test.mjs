// Unit tests for lib/audio/micStream.ts with a fake MediaStream. Run: node --experimental-strip-types lib/audio/micStream.test.mjs
import assert from "node:assert/strict";
import * as M from "./micStream.ts";

class Track {
  enabled = true; readyState = "live"; stopped = 0; #l = new Set();
  addEventListener(t, f) { if (t === "ended") this.#l.add(f); }
  removeEventListener(t, f) { this.#l.delete(f); }
  stop() { this.stopped++; this.readyState = "ended"; }
  end() { this.readyState = "ended"; [...this.#l].forEach((f) => f()); }
}
class Stream { constructor() { this.track = new Track(); } getAudioTracks() { return [this.track]; } getTracks() { return [this.track]; } }

let calls = 0, fail = null, streams = [];
let now = 0, timers = [];
M.micEnv.getUserMedia = async () => { calls++; if (fail) { const f = fail; if (f.once) fail = null; throw Object.assign(new Error("x"), { name: f.name }); } const s = new Stream(); streams.push(s); return s; };
M.micEnv.setTimeout = (fn, ms) => { const t = { fn, at: now + ms }; timers.push(t); return t; };
M.micEnv.clearTimeout = (t) => { timers = timers.filter((x) => x !== t); };
const advance = (ms) => { now += ms; for (const t of timers.filter((x) => x.at <= now)) { timers = timers.filter((x) => x !== t); t.fn(); } };
const reset = () => { M.releaseMic(); calls = 0; fail = null; streams = []; timers = []; };

let passed = 0;
const test = async (n, f) => { try { reset(); await f(); passed++; } catch (e) { console.error("FAIL", n, e.message); process.exitCode = 1; } };
const C = { audio: { channelCount: 1 } };

await test("reuses stream, disables between listens, re-enables", async () => {
  const a = await M.acquireMic(C); M.pauseMic(a);
  assert.equal(a.track.enabled, false); assert.equal(a.track.stopped, 0);
  const b = await M.acquireMic(C);
  assert.equal(a, b); assert.equal(calls, 1); assert.equal(b.track.enabled, true);
});
await test("different constraints release the old stream", async () => {
  const a = await M.acquireMic(C); const b = await M.acquireMic({ audio: { channelCount: 2 } });
  assert.notEqual(a, b); assert.equal(a.track.stopped, 1); assert.equal(calls, 2);
});
await test("idle 90s releases, next acquire re-requests", async () => {
  const a = await M.acquireMic(C); M.pauseMic(a);
  advance(M.IDLE_MS - 1); assert.equal(a.track.stopped, 0);
  advance(1); assert.equal(a.track.stopped, 1); assert.equal(M.micIsWarm(), false);
  const b = await M.acquireMic(C); assert.notEqual(a, b); assert.equal(calls, 2);
});
await test("acquire cancels idle timer", async () => {
  const a = await M.acquireMic(C); M.pauseMic(a); await M.acquireMic(C); advance(M.IDLE_MS * 2);
  assert.equal(a.track.stopped, 0);
});
await test("hidden over 30s releases; visible again in time keeps", async () => {
  const a = await M.acquireMic(C); M.pauseMic(a);
  M.onVisibility(true); advance(10_000); M.onVisibility(false); advance(60_000 - 0);
  assert.equal(a.track.stopped, 0 + (M.micIsWarm() ? 0 : 1)); // idle (90s) not reached yet
  assert.equal(M.micIsWarm(), true);
  M.onVisibility(true); advance(M.HIDDEN_MS); assert.equal(a.track.stopped, 1); assert.equal(M.micIsWarm(), false);
});
await test("track ended drops the cache and re-acquires", async () => {
  const a = await M.acquireMic(C); a.track.end();
  assert.equal(M.micIsWarm(), false);
  const b = await M.acquireMic(C); assert.notEqual(a, b);
});
await test("releaseMic stops tracks and clears timers", async () => {
  const a = await M.acquireMic(C); M.pauseMic(a); M.releaseMic();
  assert.equal(a.track.stopped, 1); assert.equal(timers.length, 0);
});
await test("pauseMic on an uncached stream stops it", async () => {
  const s = new Stream(); M.pauseMic(s); assert.equal(s.track.stopped, 1);
});
await test("errors pass through with the same name", async () => {
  fail = { name: "NotAllowedError" };
  await assert.rejects(M.acquireMic(C), (e) => e.name === "NotAllowedError");
  assert.equal(M.micIsWarm(), false);
});
await test("overconstrained falls back to the second constraints", async () => {
  fail = { name: "OverconstrainedError", once: true };
  const s = await M.acquireMic(C, { audio: true }); assert.ok(s); assert.equal(calls, 2);
});
await test("concurrent acquires share one request", async () => {
  const [a, b] = await Promise.all([M.acquireMic(C), M.acquireMic(C)]);
  assert.equal(a, b); assert.equal(calls, 1);
});
console.log(`micStream: ${passed} passed`);
