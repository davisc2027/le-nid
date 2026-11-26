// Unit tests for lib/emergency.ts. Run: npm run test:emergency  (node --experimental-strip-types lib/emergency.test.mjs)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeEmergency, parseLines, checkForm, overrideOf, itemsToText, cleanPhone, cleanMap, telHref, GROUP_IDS, LIMITS } from "./emergency.ts";

const defaults = JSON.parse(readFileSync(new URL("../content/emergency/defaults.json", import.meta.url), "utf8"));

// defaults: every group present, every item valid, placeholders say "Ask your leader"
for (const id of GROUP_IDS) {
  assert.ok(Array.isArray(defaults[id]) && defaults[id].length > 0, id);
  assert.deepEqual(parseLines(itemsToText(defaults[id]), id), defaults[id], `${id} round-trips`);
  assert.ok(defaults[id].every((i) => /Ask your leader/.test(i.value)), `${id} has an obvious placeholder`);
}

// merging nothing / garbage changes nothing
for (const nothing of [null, undefined, {}, [], "x", 42, { leaders: "no" }, { leaders: [{ junk: 1 }, null, 5] }, { notes: [{ label: "", value: "x" }] }]) {
  assert.deepEqual(mergeEmergency(defaults, nothing), defaults, JSON.stringify(nothing));
}
assert.deepEqual(defaults.leaders[0].phone, "", "defaults are not mutated");

// a real override replaces its group only; junk items inside are dropped one by one
const m = mergeEmergency(defaults, { leaders: [{ label: "Anna", value: "Trip lead", phone: "+1 512 555 0100", map: "" }, { label: "bad phone", value: "x", phone: "call me" }, "nope"], insurance: [] });
assert.equal(m.leaders.length, 1);
assert.equal(m.leaders[0].label, "Anna");
assert.deepEqual(m.staying, defaults.staying);
assert.deepEqual(m.insurance, [], "an empty list hides the group on purpose");

// unsafe links never survive a read
const evil = mergeEmergency(defaults, { staying: [{ label: "Hostel", value: "x", map: "javascript:alert(1)" }, { label: "Ok", value: "y", map: "maps.apple.com/?q=Strasbourg" }] });
assert.equal(evil.staying.length, 1);
assert.equal(evil.staying[0].map, "https://maps.apple.com/?q=Strasbourg");
assert.equal(cleanMap("javascript:alert(1)"), null);
assert.equal(cleanMap("data:text/html,hi"), null);
assert.equal(cleanMap("ftp://x.org/a"), null);
assert.equal(cleanMap("http://localhost"), null, "needs a dotted host");
assert.equal(cleanMap(""), "");
assert.equal(cleanMap("https://maps.app.goo.gl/abc"), "https://maps.app.goo.gl/abc");
assert.equal(cleanMap("https://x.org/" + "a".repeat(600)), null);

// phones
assert.equal(cleanPhone("+33 3 88 00 00 00"), "+33 3 88 00 00 00");
assert.equal(cleanPhone("112"), "112");
assert.equal(cleanPhone(""), "");
assert.equal(cleanPhone("call me"), null);
assert.equal(cleanPhone("1"), null);
assert.equal(cleanPhone("12+34"), null);
assert.equal(cleanPhone("1".repeat(25)), null);
assert.equal(telHref("+33 3 88 00 00 00"), "tel:+33388000000");
assert.equal(telHref("(512) 555-0100"), "tel:5125550100");

// parsing lines
assert.deepEqual(parseLines("Anna | Trip lead | +1 512 555 0100 | https://maps.apple.com/?q=x\n\n  Ben | Second leader | 555 0101", "Leaders"), [
  { label: "Anna", value: "Trip lead", phone: "+1 512 555 0100", map: "https://maps.apple.com/?q=x" },
  { label: "Ben", value: "Second leader", phone: "555 0101", map: "" },
]);
assert.deepEqual(parseLines("Heading | Some text", "Notes"), [{ label: "Heading", value: "Some text", phone: "", map: "" }]);
assert.deepEqual(parseLines("", "Notes"), []);
const bad = (text, re) => assert.throws(() => parseLines(text, "G"), re, text);
bad("| value", /label/);
bad("Only a label", /add some text/);
bad("A | b | c | d | e", /separators/);
bad("A | b | nope", /phone/);
bad("A | b | 555 0101 | javascript:alert(1)", /map link/);
bad("A | " + "x".repeat(LIMITS.value + 1), /limit is 200/);
bad("x".repeat(LIMITS.label + 1) + " | v", /limit is 60/);
bad(Array.from({ length: LIMITS.items + 1 }, (_, i) => `L${i} | v`).join("\n"), /at most 10 lines/);
assert.throws(() => parseLines("A | b\nB | c | no", "Leaders"), /Leaders, line 2/);

// whole form: every group required, unknown fields refused
const form = Object.fromEntries(GROUP_IDS.map((id) => [id, itemsToText(defaults[id])]));
assert.deepEqual(checkForm(form), defaults);
assert.throws(() => checkForm({ ...form, extra: "x" }), /Unknown group/);
const missing = { ...form }; delete missing.notes;
assert.throws(() => checkForm(missing), /Notes: missing/);
assert.throws(() => checkForm({ ...form, notes: "x".repeat(4001) }), /too much/);
assert.throws(() => checkForm({ ...form, notes: 5 }), /missing/);

// only changed groups are stored
const changed = checkForm({ ...form, leaders: "Anna | Trip lead | +1 512 555 0100" });
assert.deepEqual(Object.keys(overrideOf(defaults, changed)), ["leaders"]);
assert.deepEqual(overrideOf(defaults, defaults), {});
assert.deepEqual(mergeEmergency(defaults, overrideOf(defaults, changed)), changed, "store then merge gives back what was saved");

console.log("emergency tests passed");
