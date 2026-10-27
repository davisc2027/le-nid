// Unit tests for lib/polls.ts. Run: npm run test:polls  (node --experimental-strip-types lib/polls.test.mjs)
import assert from "node:assert/strict";
import { percentages, toTally, isOpen, rate, parisEndOfDay } from "./polls.ts";

const sum = (a) => a.reduce((x, y) => x + y, 0);

// Single choice always totals 100 (largest remainder).
assert.deepEqual(percentages([1, 1, 1], 3, false), [34, 33, 33]);
assert.deepEqual(percentages([2, 1], 3, false), [67, 33]);
assert.deepEqual(percentages([0, 0, 0], 0, false), [0, 0, 0]);
assert.deepEqual(percentages([5, 0], 5, false), [100, 0]);
assert.deepEqual(percentages([1, 1, 1, 1, 1, 1, 1], 7, false).reduce((a, b) => a + b), 100);
for (let t = 0; t < 500; t++) {
  const counts = Array.from({ length: 2 + (t % 7) }, (_, i) => (t * (i + 3) * 7919) % 11);
  const total = sum(counts);
  const p = percentages(counts, total, false);
  assert.equal(sum(p), total ? 100 : 0, JSON.stringify(counts));
  p.forEach((v, i) => assert.ok(Math.abs(v - (total ? (100 * counts[i]) / total : 0)) < 1, "within 1 point"));
}
// Multiple choice: share of people, may exceed 100 in total.
assert.deepEqual(percentages([3, 2, 1], 3, true), [100, 67, 33]);
assert.deepEqual(percentages([0, 0], 0, true), [0, 0]);

// Tally from RPC rows (bigint may arrive as string).
assert.deepEqual(toTally([{ option_idx: 0, votes: 2, voters: "3" }, { option_idx: 1, votes: "1", voters: 3 }], 3), { counts: [2, 1, 0], voters: 3 });
assert.deepEqual(toTally(null, 2), { counts: [0, 0], voters: 0 });

// Open / closed.
const now = Date.parse("2026-06-01T12:00:00Z");
assert.equal(isOpen({ closed: false, closes_at: null }, now), true);
assert.equal(isOpen({ closed: true, closes_at: null }, now), false);
assert.equal(isOpen({ closed: false, closes_at: "2026-06-01T11:59:59Z" }, now), false);
assert.equal(isOpen({ closed: false, closes_at: "2026-06-02T00:00:00Z" }, now), true);

assert.equal(rate(1, 3), 33);
assert.equal(rate(0, 0), 0);

// End of day in Paris: summer UTC+2, winter UTC+1.
assert.equal(parisEndOfDay("2026-07-10"), "2026-07-10T21:59:59.000Z");
assert.equal(parisEndOfDay("2026-01-10"), "2026-01-10T22:59:59.000Z");
assert.equal(parisEndOfDay("nope"), null);
assert.equal(parisEndOfDay("2026-13-40"), null);

console.log("polls tests passed");
