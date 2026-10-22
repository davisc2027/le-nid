#!/usr/bin/env node
// Checks the French curriculum (content/french/units.json) and the exercise engine (lib/french/exercises.ts).
// Run from the repo root:  node scripts/check-curriculum.mjs [lessonsPerSample]
// Needs Node 22.18+ (TypeScript type stripping on by default); on older Node 22 add --experimental-strip-types.
// It imports the real engine through tiny loader hooks (the "@/" alias, extensionless .ts imports, JSON modules),
// so the checks always test the code the app ships. Exit code 1 when an invariant fails.
import { register } from "node:module";

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

const C = await import("../lib/french/content.ts");
const E = await import("../lib/french/exercises.ts");
const { UNITS, ALL_LESSONS, ALL_PHRASES } = C;
const N = Number(process.argv[2]) || 40; // generated lessons per course lesson

let failures = 0;
const failKinds = new Map(); // failures grouped by message shape so a broken rule prints once with a count
const fail = (msg) => {
  failures++;
  const kind = msg.replace(/"[^"]*"|\[[^\]]*\]|#\d+|\d+/g, "…");
  const n = (failKinds.get(kind)?.n ?? 0) + 1;
  failKinds.set(kind, { n, example: failKinds.get(kind)?.example ?? msg });
};
const section = (t) => console.log("\n" + t);

// ---------------------------------------------------------------- units.json invariants
section("units.json invariants");
{
  const frSeen = new Map(), enSeen = new Map();
  const unitIds = new Set();
  for (const u of UNITS) {
    if (!/^u[0-9]+$/.test(u.id)) fail(`unit id ${u.id}`);
    if (unitIds.has(u.id)) fail(`duplicate unit ${u.id}`);
    unitIds.add(u.id);
    if (!u.title || !u.blurb) fail(`unit ${u.id} needs title and blurb`);
    u.lessons.forEach((l, k) => {
      if (!/^u[0-9]+-l[0-9]+$/.test(l.id)) fail(`lesson id ${l.id}`);
      if (l.id !== `${u.id}-l${k + 1}`) fail(`lesson ${l.id} should be ${u.id}-l${k + 1} (no gaps inside a unit)`);
      if (l.phrases.length < 5 || l.phrases.length > 10) fail(`${l.id} has ${l.phrases.length} phrases (5-10)`);
      for (const p of l.phrases) {
        for (const [side, seen] of [["fr", frSeen], ["en", enSeen]]) {
          const k2 = p[side].toLowerCase();
          if (seen.has(k2)) fail(`duplicate ${side} "${p[side]}" in ${seen.get(k2)} and ${l.id}`);
          seen.set(k2, l.id);
        }
        if (/\s{2,}|^\s|\s$/.test(p.fr)) fail(`whitespace in "${p.fr}"`);
        if (/[^\s ][?!:;]/.test(p.fr)) fail(`missing space before punctuation in "${p.fr}"`);
        if (/'/.test(p.fr) && /’/.test(p.fr)) fail(`mixed apostrophes in "${p.fr}"`);
        const tuWords = (x) => E.normalize(x).split(" ").filter((w) => ["tu", "te", "t", "toi", "ton", "ta", "tes"].includes(w));
        if (tuWords(p.fr).length && p.fr !== "Tu") fail(`tu form in a main phrase "${p.fr}" (use vous with strangers)`);
        if (p.tu && E.normalize(p.tu) === E.normalize(p.fr)) fail(`tu variant equals the phrase "${p.fr}"`);
        if (p.tu && !tuWords(p.tu).length && !/(e|s)-moi\b|^(Prends|Viens|Excuse|Ne perds)/.test(p.tu)) fail(`tu variant without a tu form "${p.tu}"`);
      }
    });
  }
  const keys = new Map();
  for (const p of ALL_PHRASES) {
    const k = E.phraseKey(p.fr);
    if (keys.has(k)) fail(`phrase key collision "${p.fr}" / "${keys.get(k)}"`);
    keys.set(k, p.fr);
  }
  const frs = new Set(ALL_PHRASES.map((p) => p.fr));
  for (const [a, b] of [...E.SAME_MEANING, ...E.NEAR_MISS]) for (const x of [a, b]) if (!frs.has(x)) fail(`pair table names a missing phrase "${x}"`);
  console.log(`  ${UNITS.length} units, ${ALL_LESSONS.length} lessons, ${ALL_PHRASES.length} phrases, ${keys.size} unique keys`);
}

// ---------------------------------------------------------------- generated exercises
const isMC = (e) => Array.isArray(e.choices) && typeof e.answer === "string";
const shown = (e) => e.choices; // what the learner reads
const endP = (s) => (/[?]\s*$/.test(s) ? "?" : /!\s*$/.test(s) ? "!" : ".");
const len = (s) => s.length;

const lessonOf = new Map(); // fr or en -> lesson index
ALL_LESSONS.forEach((l, i) => l.phrases.forEach((p) => { lessonOf.set(p.fr, i); lessonOf.set(p.en, i); }));
const unitOf = (i) => ALL_LESSONS[i].id.split("-")[0];
const byText = new Map(ALL_PHRASES.flatMap((p) => [[p.fr, p], [p.en, p]]));

function mcStats(exs, label) {
  let n = 0, longest = 0, shortest = 0, chance = 0, punctTell = 0;
  const where = { lesson: 0, unit: 0, earlier: 0, later: 0, word: 0 };
  let wrongN = 0, sharing = 0; // wrong sentence options that share a French word with the answer (plausibility)
  for (const e of exs) {
    const c = shown(e);
    if (c.length < 2) continue;
    n++;
    chance += 1 / c.length;
    const L = c.map(len), a = len(e.answer);
    // tie-aware: when k options share the extreme length and the answer is one of them, count 1/k
    const max = Math.max(...L), min = Math.min(...L);
    if (a === max) longest += 1 / L.filter((x) => x === max).length;
    if (a === min) shortest += 1 / L.filter((x) => x === min).length;
    const pa = endP(e.answer);
    if (c.filter((x) => endP(x) === pa).length === 1) punctTell++;
    const home = lessonOf.get(e.fr) ?? lessonOf.get(e.en);
    for (const o of c) {
      if (o === e.answer) continue;
      const li = lessonOf.get(o);
      const frOf = (x) => byText.get(x)?.fr;
      if (frOf(o) && frOf(e.answer)) {
        wrongN++;
        const aw = new Set(E.normalize(frOf(e.answer)).split(" "));
        if (E.normalize(frOf(o)).split(" ").some((w) => aw.has(w))) sharing++;
      }
      if (li === undefined || home === undefined) where.word++;
      else if (li === home) where.lesson++;
      else if (unitOf(li) === unitOf(home)) where.unit++;
      else if (li < home) where.earlier++;
      else where.later++;
    }
  }
  const wt = Object.values(where).reduce((a, b) => a + b, 0) || 1;
  const wp = (x) => ((100 * x) / wt).toFixed(0) + "%";
  const pct = (x) => (n ? ((100 * x) / n).toFixed(1) + "%" : "-");
  console.log(`  ${label}: ${n} multiple-choice items · answer is the longest ${pct(longest)}, the shortest ${pct(shortest)} (chance ${pct(chance)}), only option with its end punctuation ${pct(punctTell)}`);
  console.log(`      wrong options from: same lesson ${wp(where.lesson)}, same unit ${wp(where.unit)}, earlier units ${wp(where.earlier)}, later (unseen) units ${wp(where.later)}, word/variant options ${wp(where.word)}`);
  if (wrongN) console.log(`      wrong sentence options sharing a French word with the answer: ${((100 * sharing) / wrongN).toFixed(0)}%`);
  return { n, longest: longest / n, shortest: shortest / n, chance: chance / n, punct: punctTell / n };
}

function checkSequence(exs, where) {
  for (const [k, e] of exs.entries()) {
    if (isMC(e)) {
      const c = e.choices;
      if (new Set(c).size !== c.length) fail(`${where}: duplicate options ${JSON.stringify(c)}`);
      if (new Set(c.map(E.normalize)).size !== c.length) fail(`${where}: options equal after normalizing ${JSON.stringify(c)}`);
      if (!c.includes(e.answer)) fail(`${where}: answer missing from options`);
      if (E.ambiguousOption) {
        for (const o of c) if (o !== e.answer && E.ambiguousOption(e, o)) fail(`${where}: "${o}" could also be right for ${JSON.stringify(e.fr ?? e.en)}`);
      }
    }
    if (e.kind === "bank") {
      const words = E.tokenize(e.fr);
      const pool = [...e.tokens];
      for (const w of words) { const i = pool.indexOf(w); if (i < 0) fail(`${where}: bank missing tile ${w}`); else pool.splice(i, 1); }
      if (E.ambiguousTiles && E.ambiguousTiles(e)) fail(`${where}: bank tiles allow another correct sentence for "${e.fr}"`);
    }
    if (e.kind === "match") {
      const ens = e.pairs.map((p) => p.en);
      if (new Set(ens).size !== ens.length) fail(`${where}: match duplicate`);
      if (E.blocked) for (const a of e.pairs) for (const b of e.pairs) if (a !== b && E.blocked(a, b)) fail(`${where}: match pairs "${a.fr}" and "${b.fr}" are near-synonyms`);
    }
    if (k > 0 && exs[k - 1].kind === e.kind) fail(`${where}: two ${e.kind} exercises in a row (#${k})`);
  }
}

section(`Generated lessons (${N} per lesson)`);
const allMC = [];
const kindCount = {};
const stageMix = {};
for (const [li, lesson] of ALL_LESSONS.entries()) {
  for (let r = 0; r < N; r++) {
    const exs = E.buildLesson(lesson);
    if (r === 0 && process.env.SHOW === lesson.id) console.log(JSON.stringify(exs, null, 1));
    if (exs.length < 12 || exs.length > 18) fail(`${lesson.id}: ${exs.length} exercises (12-18)`);
    checkSequence(exs, lesson.id);
    for (const e of exs) {
      if (isMC(e)) allMC.push(e);
      kindCount[e.kind] = (kindCount[e.kind] ?? 0) + 1;
      const band = li < ALL_LESSONS.length / 3 ? "early" : li < (2 * ALL_LESSONS.length) / 3 ? "middle" : "late";
      stageMix[band] ??= {};
      stageMix[band][e.kind] = (stageMix[band][e.kind] ?? 0) + 1;
    }
  }
}
mcStats(allMC, "lesson exercises");
for (const kind of [...new Set(allMC.map((e) => e.kind))]) mcStats(allMC.filter((e) => e.kind === kind), `  kind ${kind}`);
console.log("  exercise mix by course third:");
for (const [band, m] of Object.entries(stageMix)) {
  const tot = Object.values(m).reduce((a, b) => a + b, 0);
  console.log(`    ${band.padEnd(6)} ` + Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${((100 * v) / tot).toFixed(0)}%`).join(", "));
}

section("Review and practice");
{
  const done = ALL_LESSONS.slice(0, 12).map((l) => l.id);
  const reviewMC = [];
  for (let r = 0; r < N * 4; r++) {
    const ps = E.pickReviewPhrases(done, ALL_LESSONS[12].id, {}, 4);
    const exs = E.buildReview(ps);
    checkSequence(exs, "review");
    if (exs.some((e) => e.kind !== "match" && !e.review)) fail("review exercise without the review flag");
    reviewMC.push(...exs.filter(isMC));
    // a full lesson as the player assembles it: core lesson, then up to 3 review items continuing the sequence
    const core = E.buildLesson(ALL_LESSONS[12]);
    const full = [...core, ...E.buildReview(E.pickReviewPhrases(done, ALL_LESSONS[12].id, {}, 3), core[core.length - 1].kind)];
    if (full.length > 18) fail(`lesson with review has ${full.length} exercises (max 18)`);
    checkSequence(full, "lesson + review");
    const practice = E.buildPractice([...ALL_PHRASES].sort(() => Math.random() - 0.5).slice(0, 10));
    checkSequence(practice, "practice");
    if (practice.length !== 10) fail("practice should give one exercise per phrase");
    reviewMC.push(...practice.filter(isMC));
    if (E.noAudioFallback) for (const e of [...exs, ...practice]) {
      const f = E.noAudioFallback(e);
      if (f && (f.kind === "listen" || f.kind === "hear")) fail("no-audio fallback still needs audio");
      if (f && isMC(f)) checkSequence([f], "no-audio fallback");
    }
  }
  mcStats(reviewMC, "review + practice");
}

for (const { n, example } of failKinds.values()) console.log(`  FAIL x${n}: ${example}`);
console.log(`\n${failures ? failures + " check(s) failed" : "All checks passed"}`);
process.exit(failures ? 1 : 0);
