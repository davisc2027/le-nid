#!/usr/bin/env node
// Checks content/gospel/three-circles.json: both languages complete, limits respected, every verse resolves in the
// app's Bible files (en and fr), every French word has an English gloss, and the French avoids the words we agreed not to use.
// Run from the repo root:  node scripts/check-gospel.mjs   (Node 22.18+; older 22 needs --experimental-strip-types)
import { readFileSync, existsSync } from "node:fs";
import { problems, STEP_IDS, LIMITS } from "../lib/gospel.ts";

const root = new URL("../", import.meta.url);
const c = JSON.parse(readFileSync(new URL("content/gospel/three-circles.json", root), "utf8"));
let failures = 0, checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) { failures++; console.log("  FAIL " + msg); } };

console.log("shape, completeness and lengths");
const p = problems(c);
ok(p.length === 0, p.join("\n  FAIL "));

console.log("verses resolve in public/bible (en and fr)");
const books = new Map();
const book = (lang, code) => {
  const k = `${lang}/${code}`;
  if (!books.has(k)) {
    const f = new URL(`public/bible/${k}.json`, root);
    books.set(k, existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
  }
  return books.get(k);
};
const resolves = (lang, key) => {
  const m = key.match(/^(\w{3}) (\d+):(\d+)(?:-(\d+))?$/);
  if (!m) return false;
  const ch = book(lang, m[1])?.[Number(m[2]) - 1];
  if (!ch) return false;
  const from = Number(m[3]), to = Number(m[4] ?? m[3]);
  if (to < from) return false;
  for (let n = from; n <= to; n++) {
    let k = n - 1;
    while (k > 0 && ch[k] === "=") k--; // "=" is a verse merged into the previous one
    if (!ch[k] || ch[k] === "=") return false;
  }
  return true;
};
for (const id of STEP_IDS) for (const key of c.steps?.[id]?.verses ?? []) for (const lang of ["en", "fr"]) ok(resolves(lang, key), `${id}: ${key} not found in public/bible/${lang}`);
ok(STEP_IDS.some((id) => (c.steps?.[id]?.verses ?? []).length > 0), "at least one step has a verse");

console.log("vocabulary");
const words = c.words ?? [];
ok(words.length >= STEP_IDS.length, "vocabulary list is too short");
for (const w of words) ok(w.fr && w.en && STEP_IDS.includes(w.step), `word needs fr, en and a valid step: ${JSON.stringify(w)}`);
for (const id of STEP_IDS) ok(words.some((w) => w.step === id), `no vocabulary for step ${id}`);
const seen = new Set();
for (const w of words) { const k = w.fr?.toLowerCase(); ok(!seen.has(k), `duplicate French word: ${w.fr}`); seen.add(k); }

console.log("French wording (vous form, agreed vocabulary)");
const fr = [];
const walk = (v) => { if (typeof v === "string") return; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") { if (typeof v.fr === "string") fr.push(v.fr); Object.values(v).forEach(walk); } };
walk(c);
ok(fr.length > 30, "expected many French strings");
for (const s of fr) {
  ok(!/\bcibl/i.test(s), `avoid "cible": ${s}`);
  ok(!/\b(tu|toi|ton|tes)\b/i.test(s), `use "vous", not "tu": ${s}`);
  ok(!/\bperdus?\b/i.test(s), `avoid "perdu": ${s}`);
  ok(!/\s{2,}|^\s|\s$/.test(s), `stray spaces: ${s}`);
  ok(!/[^\s][?!]\s*$/.test(s), `French needs a space before ? or !: ${s}`);
}
for (const id of STEP_IDS) {
  const st = c.steps?.[id];
  ok(st?.say?.en?.length <= LIMITS.say && st?.say?.fr?.length <= LIMITS.say, `${id}: what-to-say within ${LIMITS.say}`);
  ok(st?.key?.en && st?.key?.fr, `${id}: key sentence needs English and French`);
}

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
