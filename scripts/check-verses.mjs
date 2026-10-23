#!/usr/bin/env node
// Checks the verse-learning logic against the real Bible text: chunking (hand-tuned and automatic), the
// tap-to-hear tokenizer, the mastery path state machine, progress serialization and recall grading.
// Run from the repo root:  node scripts/check-verses.mjs
// Needs Node 22.18+ (TypeScript type stripping on by default); on older Node 22 add --experimental-strip-types.
// It imports the real modules through tiny loader hooks (the "@/" alias, extensionless .ts imports, JSON
// modules), so the checks always test the code the app ships. Exit code 1 when an invariant fails.
import { register } from "node:module";
import { readFileSync, readdirSync } from "node:fs";

const hooks = `
import { readFileSync } from "node:fs";
let root;
export async function initialize(d) { root = d.root; }
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), root).href;
  if (/^(\\.|file:)/.test(spec) && !/\\.(m?[jt]s|json)$/.test(spec)) {
    try { return await next(spec + ".ts", ctx); } catch {}
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  if (url.endsWith(".json")) return { format: "module", shortCircuit: true, source: "export default " + readFileSync(new URL(url), "utf8") };
  if (url.endsWith(".ts")) return next(url, { ...ctx, format: "module-typescript" });
  return next(url, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url, { data: { root: new URL("../", import.meta.url).href } });

const C = await import("../lib/scripture/chunks.ts");
const T = await import("../lib/scripture/tokens.ts");
const M = await import("../lib/scripture/mastery.ts");
const D = await import("../lib/scripture/drills.ts");
const K = await import("../lib/scripture/karaoke.ts");

let failures = 0, checks = 0;
const fail = (msg) => { failures++; if (failures <= 40) console.log("  FAIL " + msg); };
const ok = (cond, msg) => { checks++; if (!cond) fail(msg); };
const section = (t) => console.log("\n" + t);

const root = new URL("../", import.meta.url);
const books = new Map();
function book(code) {
  if (!books.has(code)) {
    try { books.set(code, JSON.parse(readFileSync(new URL(`public/bible/fr/${code}.json`, root), "utf8"))); } catch { books.set(code, null); }
  }
  return books.get(code);
}
/** Same rules as lib/bible/load.ts: ranges join with a space; "=" marks a verse merged into the previous one. */
function verse(key) {
  const m = /^(\w{3}) (\d+):(\d+)(?:-(\d+))?$/.exec(key);
  const ch = m && book(m[1])?.[m[2] - 1];
  if (!ch) return null;
  const parts = [];
  for (let n = +m[3]; n <= +(m[4] ?? m[3]); n++) {
    let k = n - 1;
    if (ch[k] === "=") { if (n > +m[3]) continue; while (k > 0 && ch[k] === "=") k--; }
    if (!ch[k] || ch[k] === "=") return null;
    parts.push(ch[k]);
  }
  return parts.join(" ");
}

const CORE = ["JHN 3:16", "ROM 3:23", "ROM 5:8", "ROM 6:23", "ROM 10:9", "EPH 2:8-9", "JHN 14:6", "REV 3:20"];
const wordsIn = (s) => T.verseTokens(s).filter((t) => t.word).length;

if (!book("JHN")) {
  console.log("public/bible/fr is not installed (run node scripts/build-bible.mjs). Only the logic checks run.");
}

// ---------------------------------------------------------------- hand-tuned chunks
section("content/scripture/chunks.json (hand-tuned chunks)");
const overrides = JSON.parse(readFileSync(new URL("content/scripture/chunks.json", root), "utf8"));
const units = JSON.parse(readFileSync(new URL("content/french/units.json", root), "utf8"));
const lessonVerses = (Array.isArray(units) ? units : units.units).flatMap((u) => u.lessons).filter((l) => l.verse).map((l) => l.verse);
for (const key of new Set([...CORE, ...lessonVerses, ...Object.keys(overrides).filter((k) => !k.startsWith("_"))])) {
  const text = verse(key);
  if (!text) { if (book("JHN")) fail(`${key}: verse text not found`); continue; }
  ok(Array.isArray(overrides[key]), `${key}: no hand-tuned entry in chunks.json`);
  const o = C.overrideFor(key, text);
  ok(!!o, `${key}: chunks.json entry does not add up to the verse text`);
  const ch = C.chunksFor(key, text);
  ok(ch.map((c) => c.fr).join(" ") === text, `${key}: chunks do not join back to the exact verse`);
  ok(ch.length >= 2 && ch.length <= 5, `${key}: ${ch.length} chunks (2-5)`);
  ok(ch.every((c) => wordsIn(c.fr) >= 2), `${key}: a one-word chunk: ${ch.map((c) => `[${c.fr}]`).join(" ")}`);
  ok(ch.every((c) => c.en), `${key}: every core chunk should have an English meaning`);
  console.log(`  ${key.padEnd(10)} ${ch.map((c) => `[${c.fr}]`).join(" ")}`);
}

// ---------------------------------------------------------------- automatic chunker
section("automatic chunker (core verses, then every verse of the Bible text)");
for (const key of CORE) {
  const text = verse(key);
  if (!text) continue;
  const a = C.autoChunks(text);
  ok(a.join(" ") === text, `${key}: auto chunks lose text`);
  console.log(`  ${key.padEnd(10)} ${a.map((c) => `[${c}]`).join(" ")}`);
}
{
  let n = 0, oneWord = 0, bad = 0, sizes = [0, 0, 0, 0, 0, 0];
  const t0 = Date.now();
  let dir = [];
  try { dir = readdirSync(new URL("public/bible/fr/", root)).filter((f) => f.endsWith(".json")); } catch {}
  for (const f of dir) {
    const b = book(f.replace(".json", ""));
    for (const ch of b ?? []) for (const text of ch) {
      if (!text || text === "=") continue;
      n++;
      const a = C.autoChunks(text);
      if (a.join(" ") !== text.split(/\s+/).filter(Boolean).join(" ")) { bad++; if (bad < 4) fail(`auto chunks lose text: ${text}`); }
      const w = wordsIn(text);
      if (w >= 4 && (a.length < 2 || a.length > 5)) { bad++; if (bad < 8) fail(`${a.length} chunks for a ${w}-word verse: ${text}`); }
      if (w >= 4 && a.some((c) => wordsIn(c) < 2)) { oneWord++; if (oneWord < 4) fail(`one-word chunk: ${a.map((c) => `[${c}]`).join(" ")}`); }
      sizes[Math.min(5, a.length)]++;
    }
  }
  checks += n;
  if (n) console.log(`  ${n} verses in ${Date.now() - t0} ms; chunk counts 1:${sizes[1]} 2:${sizes[2]} 3:${sizes[3]} 4:${sizes[4]} 5:${sizes[5]}`);
  ok(T.verseTokens("").length === 0 && C.autoChunks("").length === 0, "empty text");
  ok(C.autoChunks("Jésus pleura.").length === 1, "a 2-word verse stays one chunk");
}

// ---------------------------------------------------------------- tap-to-hear tokenizer
section("tap-to-hear tokens");
for (const key of CORE) {
  const text = verse(key);
  if (!text) continue;
  const toks = T.verseTokens(text);
  ok(toks.map((t) => t.text).join(" ") === text, `${key}: tokens do not join back to the verse`);
  for (const t of toks) {
    if (!t.word) { ok(t.say === "" && !/[\p{L}\p{N}]/u.test(t.text), `${key}: punctuation token "${t.text}" would be spoken`); continue; }
    ok(/^[\p{L}\p{N}]/u.test(t.say) && /[\p{L}\p{N}]$/u.test(t.say), `${key}: "${t.say}" keeps punctuation at an edge`);
    ok(!/[’‘ʼ]/.test(t.say), `${key}: "${t.say}" keeps a curly apostrophe`);
    if (t.say.includes("'")) ok(/^\p{L}+'\p{L}+$/u.test(t.say), `${key}: elision "${t.say}" is not spoken with its word`);
  }
}
{
  const t = T.verseTokens("Car Dieu a tant aimé le monde qu'il a donné son Fils unique, afin que");
  ok(t[7].say === "qu'il" && t[12].say === "unique" && t[12].text === "unique,", "JHN 3:16 tokens: qu'il spoken whole, comma stripped");
  const r = T.verseTokens("que Dieu l’a ressuscité des morts, tu");
  ok(r[2].say === "l'a" && r[2].text === "l’a", "l’a: shown curly, spoken as l'a");
  const j = T.verseTokens("Jésus lui dit : « Je suis");
  ok(!j[3].word && !j[4].word && j[5].say === "Je", "stand-alone : and « are shown, not spoken");
  ok(T.verseTokens("Jésus-Christ notre").at(0).say === "Jésus-Christ", "hyphenated names stay one word");
}

// ---------------------------------------------------------------- karaoke timing
section("karaoke timing");
for (const key of CORE) {
  const text = verse(key);
  if (!text) continue;
  const toks = T.verseTokens(text);
  for (const slow of [false, true]) {
    const { starts, total } = K.karaokeTimes(toks, slow);
    ok(starts.length === toks.length && starts.every((s, i) => i === 0 || s >= starts[i - 1]) && total >= starts.at(-1), `${key}: karaoke times not increasing`);
    ok(total / wordsIn(text) > 250 && total / wordsIn(text) < 1400, `${key}: ${Math.round(total / wordsIn(text))} ms per word is implausible`);
  }
  const offs = K.charStarts(toks);
  ok(toks.every((t, i) => text.slice(offs[i], offs[i] + t.text.length) === t.text), `${key}: char offsets do not match the text`);
}

// ---------------------------------------------------------------- mastery path
section("mastery path state machine");
for (const key of CORE) {
  const text = verse(key);
  if (!text) continue;
  const sizes = C.chunksFor(key, text).map((c) => wordsIn(c.fr));
  const now = new Date("2026-10-23T12:00:00Z");
  let p = M.fresh(sizes, now);
  ok(M.statusOf(p, null, now).kind === "new", `${key}: fresh progress should be "new"`);
  const perPhase = [0, 0, 0, 0, 0, 0];
  let guard = 0;
  while (p.phase < M.RECALL && guard++ < 500) {
    const plan = M.planPhase(p.phase, sizes);
    ok(plan.length > 0 && p.step < plan.length, `${key}: phase ${p.phase} step ${p.step} outside its plan`);
    perPhase[p.phase]++;
    const before = M.fraction(p, sizes);
    p = M.advance(p, sizes, now);
    ok(M.fraction(p, sizes) > before, `${key}: progress did not grow at phase ${p.phase} step ${p.step}`);
    // every step survives a save and reload, and re-fits the same chunks unchanged
    const back = M.parseProgress(JSON.stringify(M.serialize(p)));
    ok(back && JSON.stringify(back) === JSON.stringify(p), `${key}: progress does not survive serialization`);
    ok(JSON.stringify(M.resolve(back, sizes, null, now)) === JSON.stringify(p), `${key}: resolve changed a valid saved progress`);
  }
  ok(p.phase === M.RECALL && p.step === 0, `${key}: did not reach Recall`);
  ok(M.planPhase(1, sizes).filter((s) => s.kind === "order").length === sizes.filter((n) => n >= 2).length, `${key}: build phase should order every chunk`);
  ok(M.planPhase(2, sizes).length === 2 * Math.max(1, sizes.length - 1), `${key}: chain phase has one letters + one no-cue step per link`);
  ok(M.planPhase(2, sizes).every((s, i) => s.cue === (i % 2 ? "none" : "letters")), `${key}: chain cues should fade (letters, then none)`);
  console.log(`  ${key.padEnd(10)} steps per phase: ${perPhase.slice(0, 4).join(" / ")} + recall + cement`);
  p = M.markLearned({ ...p, hint: true, fails: 2 }, now);
  ok(p.phase === M.CEMENT && !p.hint && !p.fails && p.learnedAt, `${key}: markLearned`);
  ok(M.statusOf(p, p.learnedAt, now).kind === "wait", `${key}: right after Recall the retest waits`);
  const later = new Date(now.getTime() + M.CEMENT_DELAY_MIN * 60_000 + 1000);
  ok(M.statusOf(p, p.learnedAt, later).kind === "retest", `${key}: the retest opens after the delay`);
  ok(M.cementFromReview(p, p.learnedAt, now) === null, `${key}: a review before the retest opens does not master`);
  const missed = M.markCement(p, false, later);
  ok(M.statusOf(missed, p.learnedAt, later).kind === "wait", `${key}: a missed retest waits again`);
  const m = M.markCement(p, true, later);
  ok(M.statusOf(m, p.learnedAt, later).kind === "mastered" && M.fraction(m, sizes) === 1, `${key}: a clean retest masters`);
  ok(M.cementFromReview(p, p.learnedAt, later)?.masteredAt, `${key}: a clean review after the delay counts as the retest`);
  const again = M.restart(m, sizes, later);
  ok(again.phase === 0 && again.masteredAt && M.statusOf(again, p.learnedAt, later).kind === "mastered", `${key}: practising again keeps "mastered"`);
}
{
  const sizes = [6, 6, 5, 3, 6];
  const now = new Date();
  const p = { ...M.fresh(sizes, now), phase: 1, step: 7 };
  ok(M.resolve(p, [7, 5, 5, 3, 6], null, now).step === 0, "a changed chunk split restarts the chunk-based phase");
  ok(M.resolve({ ...p, phase: 4, step: 0 }, [7, 5, 5, 3, 6], null, now).phase === 4, "a changed split keeps Recall");
  ok(M.resolve(null, sizes, "2026-01-01T00:00:00.000Z", now).phase === M.CEMENT, "a verse learned before the path starts at Cement");
  ok(M.statusOf(null, "2026-01-01T00:00:00.000Z", now).kind === "retest", "legacy learned verse shows the retest");
  ok(M.cementFromReview(null, "2026-01-01T00:00:00.000Z", now)?.masteredAt, "legacy learned verse: a clean review masters it");
  ok(M.cementFromReview(null, null, now) === null, "a new verse is never mastered by review");
  for (const junk of [null, 1, "x", "{}", [], { v: 2, phase: 0, step: 0, sig: "", updatedAt: now.toISOString() }, { v: 1, phase: 9, step: 0, sig: "", updatedAt: now.toISOString() },
    { v: 1, phase: 1, step: -1, sig: "", updatedAt: now.toISOString() }, { v: 1, phase: 1, step: 0, sig: "", updatedAt: "yesterday" }])
    ok(M.parseProgress(junk) === null, `parseProgress accepts junk ${JSON.stringify(junk)}`);
  const a = { ...M.fresh(sizes, new Date(1000)) }, b = { ...M.fresh(sizes, new Date(2000)), phase: 2 };
  ok(M.newest(a, b) === b && M.newest(b, a) === b && M.newest(null, a) === a, "newest picks the later save");
  ok(JSON.stringify(M.serialize({ ...M.markLearned(M.fresh(sizes, now), now) })).length < 400, "serialized progress stays small");
}

// ---------------------------------------------------------------- grading
section("recall grading");
{
  const e = "si tu confesses de ta bouche que Jésus est Seigneur, et si tu crois dans ton cœur que Dieu l’a ressuscité des morts, tu seras sauvé.";
  ok(D.gradeRecall(e, e).score === 1, "exact recall scores 1");
  ok(D.gradeRecall("Si tu confesses de ta bouche que Jesus est Seigneur et si tu crois dans ton coeur que Dieu l'a ressuscite des morts tu seras sauve", e).score === 1, "accents, case, œ/oe, apostrophes, punctuation are free");
  ok(D.gradeRecall("si tu confeses de ta bouche que Jésus est Seigneur, et si tu crois dans ton cœur que Dieu l’a ressucité des morts, tu seras sauvé.", e).score === 1, "one slip in a long word is free");
  const g = D.gradeRecall("si tu confesses de ta bouche que Jésus est Seigneur", e);
  ok(g.score < D.PASS && g.marks.some((m) => !m.ok), "half the verse fails and marks the missing words");
  ok(D.gradeRecall("tous ont pèche et sont prive de la gloire de dieu", "tous ont péché et sont privés de la gloire de Dieu ;").score >= D.PASS, "ROM 3:23 lenient pass");
  ok(D.gradeRecall("tu", "tous ont péché").score < D.PASS, "short words need to be exact");
  ok(T.sameWord("COEUR", "cœur") && T.sameWord("eternelle", "éternelle") && !T.sameWord("vie", "vue"), "sameWord");
  const lines = ["Car Dieu a tant aimé le monde", "qu'il a donné son Fils unique,", "ne périsse pas,"].map((l) => T.verseTokens(l));
  const gaps = M.pickGaps(lines, () => 0.3);
  ok([0, 1, 2].every((li) => [...gaps].some((k) => k.startsWith(`${li}:`))), "gaps: at least one blank per chunk");
  ok([...gaps].every((k) => { const [l, t] = k.split(":").map(Number); return lines[l][t].word; }), "gaps: never on punctuation");
  for (let r = 0; r < 20; r++) {
    const b = D.pickBlanks("ne périsse pas,", 0.4);
    ok(b.size >= 1 && [...b].every((i) => i < 3), "pickBlanks: at least one blank, inside the text");
  }
}

console.log(`\n${failures ? `${failures} FAILED` : "All good"} (${checks} checks)`);
process.exit(failures ? 1 : 0);
