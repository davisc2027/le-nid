#!/usr/bin/env node
// Checks the French curriculum (content/french/units.json) and the exercise engine (lib/french/exercises.ts).
// Run from the repo root:  node scripts/check-curriculum.mjs [lessonsPerSample]
// Needs Node 22.18+ (TypeScript type stripping on by default); on older Node 22 add --experimental-strip-types.
// It imports the real engine through tiny loader hooks (the "@/" alias, extensionless .ts imports, JSON modules),
// so the checks always test the code the app ships. Exit code 1 when an invariant fails.
import { register } from "node:module";
import { readFileSync } from "node:fs";

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
      // the same pattern complete_lesson() accepts in the database (migration 0010)
      if (!/^u([0-9]|[12][0-9]|30)-l([0-9]|1[0-9]|20)$/.test(l.id)) fail(`lesson id ${l.id} (u0-u30, l0-l20)`);
      if (l.verse !== undefined) {
        // a verse lesson names a key like "JHN 3:16" or "EPH 2:8-9" that exists in the French Bible text
        const m = /^([1-3]?[A-Z]{2,3}) (\d+):(\d+)(?:-(\d+))?$/.exec(l.verse);
        let ok = false;
        try {
          const book = m && JSON.parse(readFileSync(new URL(`../public/bible/fr/${m[1]}.json`, import.meta.url), "utf8"));
          ok = !!book?.[m[2] - 1]?.[(m[4] ?? m[3]) - 1];
        } catch {}
        if (!ok) fail(`lesson ${l.id} names verse "${l.verse}" that is not in public/bible/fr`);
      }
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

// ---------------------------------------------------------------- culture.json invariants
// The culture and etiquette layer (docs/culture-track.md). Cards appear in the lesson flow by lesson id, quote phrases
// from units.json by their exact `fr` text, and carry sources; check questions are 3-option multiple choice.
section("culture.json invariants");
{
  const culture = JSON.parse(readFileSync(new URL("../content/french/culture.json", import.meta.url), "utf8"));
  const unitIds = new Set(UNITS.map((u) => u.id));
  const lessonUnit = new Map(UNITS.flatMap((u) => u.lessons.map((l) => [l.id, u.id])));
  const frs = new Set(ALL_PHRASES.map((p) => p.fr));
  const TYPES = new Set(["fact", "etiquette", "history", "faith-context", "alsace"]);
  const REVIEW = new Set(["native", "leader", "both"]);
  const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  const emoji = /\p{Extended_Pictographic}/u;
  const sentences = (s) => (s.match(/[.!?](?=\s+[A-ZÀ-Ý“]|\s*$)/g) ?? []).length;
  const urlOk = (u) => { try { return new URL(u).protocol === "https:" && !/\s/.test(u); } catch { return false; } };
  const text = (s, max, what) => {
    if (typeof s !== "string" || !s.trim()) return fail(`culture: ${what} is empty`);
    if (s.length > max) fail(`culture: ${what} is ${s.length} chars (max ${max})`);
    if (/\s{2,}|^\s|\s$/.test(s)) fail(`culture: stray whitespace in ${what}`);
    if (emoji.test(s)) fail(`culture: emoji in ${what}`);
  };

  const themes = new Set();
  for (const t of culture.themes) {
    if (!ID.test(t.id) || themes.has(t.id)) fail(`culture: theme id "${t.id}" invalid or duplicate`);
    themes.add(t.id);
    text(t.title, 40, `theme ${t.id} title`); text(t.blurb, 90, `theme ${t.id} blurb`);
  }
  const cards = new Map();
  const byLesson = new Map();
  for (const c of culture.cards) {
    if (!ID.test(c.id) || cards.has(c.id)) fail(`culture: card id "${c.id}" invalid or duplicate`);
    cards.set(c.id, c);
    if (!TYPES.has(c.type)) fail(`culture: card ${c.id} has type "${c.type}"`);
    if (!themes.has(c.theme)) fail(`culture: card ${c.id} names missing theme "${c.theme}"`);
    text(c.title, 48, `card ${c.id} title`);
    text(c.text, 440, `card ${c.id} text`);
    const n = sentences(c.text);
    if (n < 2 || n > 4) fail(`culture: card ${c.id} text has ${n} sentences (2-4)`);
    if (!unitIds.has(c.unit)) fail(`culture: card ${c.id} names missing unit "${c.unit}"`);
    if (c.lesson !== undefined) {
      if (!lessonUnit.has(c.lesson)) fail(`culture: card ${c.id} names missing lesson "${c.lesson}"`);
      else if (lessonUnit.get(c.lesson) !== c.unit) fail(`culture: card ${c.id} lesson ${c.lesson} is not in unit ${c.unit}`);
      if (c.moment !== "intro" && c.moment !== "done") fail(`culture: card ${c.id} needs moment "intro" or "done"`);
      // never more than one card per lesson
      if (byLesson.has(c.lesson)) fail(`culture: lesson ${c.lesson} has two cards ("${byLesson.get(c.lesson)}" and "${c.id}")`);
      byLesson.set(c.lesson, c.id);
    } else if (c.moment !== undefined) fail(`culture: card ${c.id} has a moment but no lesson`);
    if (c.phrase !== undefined) {
      text(c.phrase.fr, 60, `card ${c.id} phrase`); text(c.phrase.gloss, 60, `card ${c.id} gloss`);
      if (!c.phrase.extra && !frs.has(c.phrase.fr)) fail(`culture: card ${c.id} quotes a phrase not in units.json "${c.phrase.fr}" (mark it "extra": true if intended)`);
      if (c.phrase.extra && frs.has(c.phrase.fr)) fail(`culture: card ${c.id} marks an existing phrase as extra "${c.phrase.fr}"`);
      if (/[^\s ][?!:;]/.test(c.phrase.fr)) fail(`culture: missing space before punctuation in "${c.phrase.fr}"`);
    }
    if (c.odile !== undefined) text(c.odile, 140, `card ${c.id} odile`);
    if (c.odileSass !== undefined) {
      text(c.odileSass, 140, `card ${c.id} odileSass`);
      if (c.odile === undefined) fail(`culture: card ${c.id} has a sass line but no gentle line`);
      if (c.type === "faith-context") fail(`culture: card ${c.id} is faith context and must not have a sass line`);
    }
    if (!Array.isArray(c.source) || !c.source.length) fail(`culture: card ${c.id} has no source`);
    else for (const u of c.source) if (!urlOk(u)) fail(`culture: card ${c.id} has a bad source URL "${u}"`);
    if (c.review !== undefined && !REVIEW.has(c.review)) fail(`culture: card ${c.id} review "${c.review}" (native, leader or both)`);
    if (c.review !== undefined) text(c.reviewNote, 160, `card ${c.id} reviewNote`);
  }

  const qIds = new Set();
  const lengthRank = { longest: 0, shortest: 0 };
  for (const q of culture.questions) {
    if (!ID.test(q.id) || qIds.has(q.id)) fail(`culture: question id "${q.id}" invalid or duplicate`);
    qIds.add(q.id);
    if (!cards.has(q.card)) fail(`culture: question ${q.id} names missing card "${q.card}"`);
    text(q.scenario, 160, `question ${q.id} scenario`);
    text(q.explain, 260, `question ${q.id} explain`);
    if (sentences(q.explain) > 2) fail(`culture: question ${q.id} explanation has more than 2 sentences`);
    if (q.fact !== undefined) text(q.fact, 140, `question ${q.id} fact`);
    if (!Array.isArray(q.options) || q.options.length !== 3) { fail(`culture: question ${q.id} needs exactly 3 options`); continue; }
    q.options.forEach((o, k) => text(o, 90, `question ${q.id} option ${k + 1}`));
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 2) fail(`culture: question ${q.id} answer must be 0, 1 or 2 (exactly one correct option)`);
    if (new Set(q.options.map((o) => E.normalize(o))).size !== 3) fail(`culture: question ${q.id} has duplicate options`);
    const L = q.options.map((o) => o.length), a = L[q.answer] ?? 0;
    if (a === Math.max(...L)) lengthRank.longest++;
    if (a === Math.min(...L)) lengthRank.shortest++;
  }
  const checks = new Set();
  for (const it of culture.checklist) {
    if (!ID.test(it.id) || checks.has(it.id)) fail(`culture: checklist id "${it.id}" invalid or duplicate`);
    checks.add(it.id);
    if (it.kind !== "do" && it.kind !== "dont") fail(`culture: checklist ${it.id} kind "${it.kind}"`);
    if (!cards.has(it.card)) fail(`culture: checklist ${it.id} names missing card "${it.card}"`);
    text(it.text, 110, `checklist ${it.id}`);
  }
  // Joshua Project cards: credited, hedged as estimates, flagged for review (docs/culture-track.md section 7).
  for (const c of culture.cards) {
    const jp = c.credit === "joshua-project";
    if (jp && !c.source.some((u) => /joshuaproject\.net/.test(u))) fail(`culture: card ${c.id} has a Joshua Project credit but no joshuaproject.net source`);
    if (c.source.some((u) => /joshuaproject\.net/.test(u)) && !jp) fail(`culture: card ${c.id} cites Joshua Project but has no "credit": "joshua-project"`);
    const figures = /\d/.test(c.text.replace(/\b20\d\d\b/g, ""));
    if (jp && figures && !/\b(about|estimate)/i.test(c.text)) fail(`culture: card ${c.id} shows a Joshua Project figure without "about" or "estimate"`);
    if (jp && figures && !/estimate|snapshot|2026 definition/i.test(c.text)) fail(`culture: card ${c.id} must say its Joshua Project figures are estimates or a snapshot`);
    if (c.theme === "neighbours" && !c.review) fail(`culture: neighbours card ${c.id} needs review and reviewNote`);
    if (/\b(target|mission field)\b/i.test(c.text) && c.theme === "neighbours") fail(`culture: neighbours card ${c.id} uses target language`);
  }
  for (const t of culture.themes) if (t.credit !== undefined && t.credit !== "joshua-project") fail(`culture: theme ${t.id} has unknown credit "${t.credit}"`);
  if (culture.cards.some((c) => c.credit) && !culture.themes.some((t) => t.credit === "joshua-project")) fail("culture: credited cards need a theme-level credit line");
  if (cards.size < 40) fail(`culture: only ${cards.size} cards (at least 40)`);
  if (qIds.size < 30) fail(`culture: only ${qIds.size} questions (at least 30)`);
  // options are shuffled in the app, so position is no tell; length can be, so keep it near chance (1 in 3)
  const nq = culture.questions.length || 1;
  const longest = lengthRank.longest / nq;
  if (longest > 0.5) fail(`culture: the answer is the longest option in ${(100 * longest).toFixed(0)}% of questions (keep it under 50%)`);
  const perTheme = [...themes].map((t) => `${t} ${[...cards.values()].filter((c) => c.theme === t).length}`).join(", ");
  console.log(`  ${cards.size} cards (${perTheme}), ${byLesson.size} placed in lessons, ${qIds.size} questions, ${checks.size} checklist items`);
  console.log(`  answer is the longest option ${(100 * longest).toFixed(0)}%, the shortest ${((100 * lengthRank.shortest) / nq).toFixed(0)}% (chance about 33%)`);
}

// ---------------------------------------------------------------- generated exercises
const isMC =(e) => Array.isArray(e.choices) && typeof e.answer === "string";
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
      if (!c.includes(e.answer)) fail(`${where}: answer missing from choices`);
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

// Regression: props passed from server to client components arrive as copies (new objects). The engine must treat a
// copied lesson or phrase exactly like the original (it once crashed with "e is not iterable" on every lesson).
{
  const copy = (x) => JSON.parse(JSON.stringify(x));
  for (const l of ALL_LESSONS) {
    try {
      const exs = E.buildLesson(copy(l));
      if (!exs.length) fail(`copied lesson ${l.id} built no exercises`);
      const rv = E.buildReview(copy(ALL_PHRASES.slice(0, 4)));
      const pr = E.buildPractice(copy(ALL_PHRASES.slice(5, 15)));
      if (rv.length !== 4 || pr.length !== 10) fail("copied review/practice phrases built the wrong number of exercises");
      for (const e of [...exs, ...rv, ...pr]) if (e.kind === "choose" && e.choices.includes(e.answer) === false) fail(`copied lesson ${l.id}: answer missing from choices`);
    } catch (err) {
      fail(`copied lesson ${l.id} threw: ${err.message}`);
    }
  }
}

for (const { n, example } of failKinds.values()) console.log(`  FAIL x${n}: ${example}`);
console.log(`\n${failures ? failures + " check(s) failed" : "All checks passed"}`);
process.exit(failures ? 1 : 0);
