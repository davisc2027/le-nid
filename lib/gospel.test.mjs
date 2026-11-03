// Unit tests for lib/gospel.ts. Run: npm run test:gospel  (node --experimental-strip-types lib/gospel.test.mjs)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mergeGospel, checkPatch, applyPatch, problems, LIMITS, STEP_IDS } from "./gospel.ts";

const defaults = JSON.parse(readFileSync(new URL("../content/gospel/three-circles.json", import.meta.url), "utf8"));
const parseVerse = (s) => ({ "Romans 3:23": "ROM 3:23", "Genèse 1:31": "GEN 1:31" })[s] ?? null;
const opts = { parseVerse };
const bi = (en, fr) => ({ en, fr });

// defaults are complete and unchanged by merging nothing
assert.deepEqual(problems(defaults), []);
for (const nothing of [null, undefined, {}, [], "x", 42, { steps: null }, { words: "nope" }]) assert.deepEqual(mergeGospel(defaults, nothing), defaults, JSON.stringify(nothing));

// partial override: one circle label in French only, one step's key sentence in both, untouched parts stay default
const m = mergeGospel(defaults, { circles: { design: { fr: "Le dessein de Dieu" } }, steps: { gospel: { key: bi("Jesus rose.", "Jésus est ressuscité.") } } });
assert.equal(m.circles.design.fr, "Le dessein de Dieu");
assert.equal(m.circles.design.en, defaults.circles.design.en);
assert.equal(m.steps.gospel.key.fr, "Jésus est ressuscité.");
assert.equal(m.steps.gospel.say.en, defaults.steps.gospel.say.en);
assert.deepEqual(m.words, defaults.words);
assert.deepEqual(defaults.circles.design.fr, "Le projet de Dieu", "defaults are not mutated");

// garbage inside an override is ignored piece by piece
const g = mergeGospel(defaults, { title: { en: "", fr: 5 }, steps: { design: { verses: ["nonsense", "JHN 3:16"] } }, words: [{ fr: "x" }, null, { fr: "a", en: "b", step: "nope" }], openers: [{ en: "q", fr: "" }], arrows: "x" });
assert.deepEqual(g.title, defaults.title);
assert.deepEqual(g.steps.design.verses, ["JHN 3:16"]);
assert.deepEqual(g.words, defaults.words, "all-invalid words fall back");
assert.deepEqual(g.openers, defaults.openers);
assert.deepEqual(g.arrows, defaults.arrows);

// lists are replaced as a whole; an empty verse list is a real choice
const l = mergeGospel(defaults, { words: [{ fr: "le feu", en: "fire", step: "design" }], steps: { start: { verses: [] } }, closing: [bi("Q?", "Q ?")] });
assert.deepEqual(l.words, [{ fr: "le feu", en: "fire", step: "design" }]);
assert.deepEqual(l.closing, [bi("Q?", "Q ?")]);
assert.deepEqual(l.steps.start.verses, []);

// strict patch: valid
const ok = checkPatch({ data: { circles: { design: bi("God's Design", "Le projet de Dieu") }, steps: { brokenness: { verses: ["Romans 3:23", "GEN 1:31"] } } }, reviewed: true, reset: ["steps.design"] }, opts);
assert.deepEqual(ok.data.steps.brokenness.verses, ["ROM 3:23", "GEN 1:31"]);
assert.equal(ok.reviewed, true);

// strict patch: rejects
const bad = (input, re) => assert.throws(() => checkPatch(input, opts), re);
bad({ data: { nope: 1 } }, /Unknown field/);
bad({ data: { circles: { design: bi("x".repeat(LIMITS.circle + 1), "ok") } } }, /limit is 24/);
bad({ data: { circles: { design: bi("ok", "  ") } } }, /French text is empty/);
bad({ data: { circles: { design: { en: "ok" } } } }, /French text is empty/);
bad({ data: { steps: { design: { verses: ["Not a verse"] } } } }, /do not recognise/);
bad({ data: { steps: { design: { verses: ["ROM 3:23", "ROM 3:23", "ROM 3:23", "ROM 3:23"] } } } }, /at most 3/);
bad({ data: { steps: { nope: {} } } }, /Unknown field/);
bad({ data: { words: [] } }, /between 1 and/);
bad({ data: { words: [{ fr: "a", en: "b", step: "zzz" }] } }, /pick a step/);
bad({ data: { words: [{ fr: "a", en: "", step: "design" }] } }, /both French and English/);
bad({ data: { words: Array.from({ length: LIMITS.words + 1 }, () => ({ fr: "a", en: "b", step: "design" })) } }, /between 1 and/);
bad({ data: { closing: [] } }, /keep between/);
bad({ data: { openers: Array.from({ length: LIMITS.openers + 1 }, () => bi("a", "b")) } }, /keep between/);
bad({ data: { steps: { design: { say: bi("a".repeat(LIMITS.say + 1), "b") } } } }, /limit is 320/);
bad({ reviewed: "yes" }, /review flag/);
bad({ reset: ["steps.nope"] }, /Bad reset/);
bad({ reset: "steps" }, /Bad reset/);
bad(null, /Bad request/);

// apply: merges into what is stored, replaces lists, reset removes a step's override
let stored = applyPatch(null, checkPatch({ data: { steps: { design: { say: bi("A", "B") } } } }, opts));
stored = applyPatch(stored, checkPatch({ data: { steps: { design: { key: bi("K", "L") }, gospel: { say: bi("C", "D") } } } }, opts));
assert.equal(stored.steps.design.say.fr, "B");
assert.equal(stored.steps.design.key.en, "K");
assert.equal(stored.steps.gospel.say.en, "C");
stored = applyPatch(stored, checkPatch({ reset: ["steps.design"] }, opts));
assert.equal(stored.steps.design, undefined);
assert.equal(stored.steps.gospel.say.en, "C");
assert.equal(mergeGospel(defaults, stored).steps.design.say.en, defaults.steps.design.say.en);
assert.equal(mergeGospel(defaults, stored).steps.gospel.say.en, "C");
assert.deepEqual(applyPatch("junk", checkPatch({}, opts)), {});

// problems() flags incomplete content
const broken = JSON.parse(JSON.stringify(defaults));
broken.circles.design.fr = "";
delete broken.steps.recover;
broken.steps.design.say.en = "x".repeat(LIMITS.say + 1);
const p = problems(broken);
assert.ok(p.some((x) => x.startsWith("circles.design")) && p.some((x) => x.startsWith("steps.recover")) && p.some((x) => x.startsWith("steps.design.say")), p.join("|"));
assert.equal(STEP_IDS.length, 6);
console.log("gospel tests ok");
