// Unit tests for lib/privacy.ts. Run: npm run test:privacy  (node --experimental-strip-types lib/privacy.test.mjs)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergePrivacy, checkPrivacyForm, overrideOf, placeholders, toBlocks, SECTIONS, SECTION_IDS } from "./privacy.ts";

const defaults = JSON.parse(readFileSync(new URL("../content/privacy.json", import.meta.url), "utf8"));

// defaults are complete and within limits
for (const s of SECTIONS) {
  assert.equal(typeof defaults[s.id], "string", s.id);
  assert.ok(defaults[s.id].length > 20 && defaults[s.id].length <= s.max, `${s.id} length`);
}
assert.deepEqual(Object.keys(defaults).sort(), [...SECTION_IDS].sort());
assert.deepEqual(checkPrivacyForm(defaults), defaults);

// the placeholders the owner has to fill in are findable (region, email provider, retention date, contact)
const ph = placeholders(defaults).join(" ");
for (const w of ["REGION", "EMAIL PROVIDER", "DELETION DATE", "CONTACT"]) assert.ok(ph.includes(w), w);
assert.deepEqual(placeholders({ ...defaults, third: "all filled in", retention: "done", contact: "x", summary: "s", collect: "c", why: "w", who: "w", rights: "r" }), []);

// merge: nothing / garbage changes nothing
for (const nothing of [null, undefined, {}, [], "x", 42, { collect: 5 }, { collect: "   " }, { collect: "x".repeat(5000) }, { unknown: "x" }]) {
  assert.deepEqual(mergePrivacy(defaults, nothing), defaults, String(JSON.stringify(nothing)).slice(0, 40));
}
const m = mergePrivacy(defaults, { retention: "  Deleted by 1 June.  ", third: "Supabase in the EU." });
assert.equal(m.retention, "Deleted by 1 June.");
assert.equal(m.third, "Supabase in the EU.");
assert.equal(m.collect, defaults.collect);

// strict form
assert.throws(() => checkPrivacyForm({ ...defaults, extra: "x" }), /Unknown section/);
const noWhy = { ...defaults }; delete noWhy.why;
assert.throws(() => checkPrivacyForm(noWhy), /missing/);
assert.throws(() => checkPrivacyForm({ ...defaults, why: "   " }), /can't be empty/);
assert.throws(() => checkPrivacyForm({ ...defaults, summary: "x".repeat(701) }), /too long/);
assert.throws(() => checkPrivacyForm({ ...defaults, why: 4 }), /missing/);
assert.equal(checkPrivacyForm({ ...defaults, why: "a\r\nb" }).why, "a\nb");

// only changed sections are stored
assert.deepEqual(overrideOf(defaults, defaults), {});
assert.deepEqual(overrideOf(defaults, { ...defaults, contact: "Ask Pastor Sam." }), { contact: "Ask Pastor Sam." });

// display blocks
assert.deepEqual(toBlocks("Intro\n- one\n- two\nOutro"), [{ type: "p", text: "Intro" }, { type: "ul", items: ["one", "two"] }, { type: "p", text: "Outro" }]);
assert.deepEqual(toBlocks(""), []);

console.log("privacy tests passed");
