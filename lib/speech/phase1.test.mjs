// Pure-logic tests for speaking practice (docs/speaking-build-spec.md section 11.1).
// Run from the repo root: node lib/speech/phase1.test.mjs   (Node 22.18+, or add --experimental-strip-types)
import { register } from "node:module";
import assert from "node:assert/strict";

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
register("data:text/javascript," + encodeURIComponent(hooks), import.meta.url, { data: { root: new URL("../../", import.meta.url).href } });

let passed = 0;
const test = async (name, fn) => {
  try { await fn(); passed++; } catch (e) { console.error("FAIL", name, "\n", e.message); process.exitCode = 1; }
};

const T = await import("./text.ts");
const C = await import("../french/content.ts");
const { ALL_LESSONS, ALL_PHRASES } = C;
const { phraseKey } = await import("../french/exercises.ts");

await test("syllables", () => {
  const want = {
    "Oui": 1, "Non": 1, "S'il vous plaît": 3, "D'accord": 2, "Bien sûr": 2, "Je ne sais pas": 4, "Un peu": 2,
    "Vous avez": 3, "Il y a": 3, "Bonne journée": 3, "Où sont les toilettes ?": 5, "Excusez-moi": 4,
    "Pouvez-vous répéter, s'il vous plaît ?": 9, "Je voudrais goûter la choucroute": 8, "Ils prient": 2, "Quatre": 1,
    "Une tarte flambée, s'il vous plaît": 7,
  };
  for (const [fr, n] of Object.entries(want)) assert.equal(T.syllables(fr), n, fr);
});

await test("durationRange", () => {
  const v = { 1: [0.15, 1.8, 5], 2: [0.16, 2.4, 5], 5: [0.4, 4.2, 6.2], 8: [0.64, 6.0, 8], 13: [1.04, 9.0, 10] };
  for (const [s, [a, b, c]] of Object.entries(v)) assert.deepEqual(T.durationRange(+s), { minSec: a, maxSec: b, capSec: c }, s);
});

await test("soundTags", () => {
  const want = {
    "Oui": ["u"], "Non": ["nasal"], "S'il vous plaît": ["u", "liaison"], "D'accord": ["r", "liaison"],
    "Bien sûr": ["nasal", "r", "u"], "Un peu": ["nasal", "eu"], "La rue": ["r", "u"], "Moi": ["oi"], "Il y a": ["liaison"],
    "Monsieur": [], "Où sont les toilettes ?": ["u", "nasal", "liaison", "oi"], "Vous êtes d'ici ?": ["u", "liaison", "question"],
  };
  for (const [fr, tags] of Object.entries(want)) assert.deepEqual([...T.soundTags(fr)].sort(), [...tags].sort(), fr);
});

await test("isRiseQuestion", () => {
  for (const fr of ["Ça va ?", "Vous êtes d'ici ?", "Est-ce qu'il y a du porc ?", "On se tutoie ?"]) assert.ok(T.isRiseQuestion(fr), fr);
  for (const fr of ["D'où venez-vous ?", "Qu'est-ce que vous recommandez ?", "Où est la gare ?", "Pouvez-vous répéter, s'il vous plaît ?", "Merci"])
    assert.ok(!T.isRiseQuestion(fr), fr);
});

const S = await import("./select.ts");
const E = await import("../french/exercises.ts");

const SAY_IT = {
  "u0-l1": ["bien sur", "d accord", "voila"], "u0-l2": ["tres", "un peu", "moi"],
  "u0-l3": ["je vous en prie", "excusez moi", "merci"], "u1-l3": ["ca va", "pas mal"],
  "u11-l2": ["ah bon", "c est vrai"], "u13-l3": ["la croix", "bienvenue"], "u5-l1": ["un", "deux"],
  "u5-l4": ["lundi", "dimanche"], "u2-l1": ["c est loin", "c est pres d ici"],
  "u2-l4": ["la rue", "je cherche mon groupe"], "u3-l3": ["le plat du jour", "une tarte aux pommes"],
  "u9-l2": ["j ai deux freres", "j ai un chien"], "u9-l5": ["mon pere est pasteur", "ma mere est infirmiere"],
  "u19-l3": ["c est interessant", "vous pouvez l ecrire"], "u4-l3": ["jesus a change ma vie"],
  "u14-l2": ["le peche", "tous ont peche"], "u6-l1": ["en especes", "trois euros cinquante"],
  "u15-l2": ["dieu m a pardonne", "je prie tous les jours"], "u8-l1": ["c est urgent", "laissez moi tranquille"],
  "u16-l1": ["pas de souci", "peut etre une autre fois"], "u7-l1": ["le chauffage ne marche pas"],
  "u17-l2": ["la resurrection", "jesus est seigneur"],
  "u10-l1": ["c est quoi ce batiment", "voici l horloge astronomique"],
  "u18-l1": ["voici l adresse", "voulez vous venir avec nous"], "u21-l1": ["joyeux noel"],
};
const names = (l) => S.speakPhrasesFor(l.id).map((p) => phraseKey(p.fr));

await test("say-it table (spec 3.1)", () => {
  const got = {};
  for (const l of ALL_LESSONS) { const k = names(l); if (k.length) got[l.id] = k; }
  assert.deepEqual(got, SAY_IT);
  assert.equal(Object.values(got).flat().length, 50);
});

const CARDS = {
  u: ["Oui", "S'il vous plaît", "Bien sûr", "Tu", "Vous", "Vous avez"],
  r: ["D'accord", "Bien sûr", "Très", "Merci", "Merci beaucoup", "De rien"],
  nasal: ["Non", "Bien sûr", "Un peu", "De rien", "Je vous en prie", "Pardon"],
  eu: ["Un peu", "Je parle un peu français", "Qu'est-ce que ça veut dire ?", "Dieu", "Le Seigneur", "Le pasteur"],
  oi: ["Voilà", "Moi", "Excusez-moi", "Bonsoir", "Au revoir", "Moi aussi !"],
  liaison: ["S'il vous plaît", "D'accord", "Je ne sais pas", "Très", "Vous", "Vous avez"],
  question: ["Et vous ?", "Ça va ?", "Ça va bien, et vous ?", "Vous êtes d'ici ?", "Vous comprenez ?", "Ah bon ?"],
};
const CARDS_DONE = {
  ...CARDS,
  eu: ["Un peu", "Dieu", "Deux", "Neuf", "Il pleut", "Au feu !"],
  oi: ["Voilà", "Moi", "Excusez-moi", "Trois", "Bonsoir", "Je vois"],
  question: ["Et vous ?", "Ça va ?", "Ah bon ?", "C'est loin ?", "Vous êtes d'ici ?", "Vous comprenez ?"],
};
await test("practice sets (spec 3.2)", () => {
  const all = ALL_LESSONS.map((l) => l.id);
  assert.deepEqual(S.SOUND_CARDS.map((c) => c.tag), ["u", "r", "nasal", "eu", "oi", "liaison", "question"]);
  for (const c of S.SOUND_CARDS) {
    assert.deepEqual(S.practiceSet(c.tag, []).map((p) => p.fr), CARDS[c.tag], c.tag + " new");
    assert.deepEqual(S.practiceSet(c.tag, all).map((p) => p.fr), CARDS_DONE[c.tag], c.tag + " done");
  }
});

await test("tag counts", () => {
  const n = {};
  for (const p of ALL_PHRASES) if (T.speakable(p.fr, 6, 10)) for (const t of T.soundTags(p.fr)) n[t] = (n[t] ?? 0) + 1;
  assert.equal(ALL_PHRASES.length, 488);
  assert.deepEqual(n, { u: 245, r: 270, nasal: 238, eu: 83, oi: 69, liaison: 329, question: 41 });
});

await test("withSpeakSteps", () => {
  for (const l of ALL_LESSONS) {
    const picks = S.speakPhrasesFor(l.id);
    for (let rep = 0; rep < (picks.length ? 30 : 3); rep++) {
      const input = E.buildLesson(l);
      const out = S.withSpeakSteps(input, l);
      if (!picks.length) { assert.equal(out, input); continue; }
      const P = l.phrases.length;
      const steps = out.map((e, i) => [e, i]).filter(([e]) => e.kind === "speak");
      assert.equal(steps.length, picks.length, l.id);
      assert.deepEqual(out.filter((e) => e.kind !== "speak"), input);
      out.filter((e) => e.kind !== "speak").forEach((e, i) => assert.equal(e, input[i]));
      for (const [e, i] of steps) {
        assert.ok(i > P && i < out.length - 1, `${l.id} position ${i}/${out.length}`);
        assert.equal(e.key, undefined);
        if (out[i - 1].fr === e.fr) assert.equal(i, out.length - 2, `${l.id}: repeated phrase only when clamped`);
      }
    }
  }
});

const EP = await import("./endpoint.ts");
const W = await import("./wav.ts");
const F = await import("./flow.ts");
const CP = await import("./copy.ts");
const K = await import("./checks.ts");
const FX = await import("../../e2e/make-fixtures.mjs");

/** Feeds constant-rms chunks of ~43 ms; returns [event, t] of the first stop or speech. */
function drive(segments, cfg) {
  const ep = EP.createEndpointer(cfg);
  const events = [];
  let t = 0;
  for (const [rms, sec] of segments) {
    for (const end = t + sec * 1000; t < end; ) {
      t += 25;
      const e = ep.step(rms, t);
      if (e !== "none") { events.push([e, t]); if (e.startsWith("stop")) return events; }
    }
  }
  return events;
}
const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

await test("endpointer", () => {
  let ev = drive([[0.0005, 7]]);
  assert.equal(ev.at(-1)[0], "stop-no-speech"); near(ev.at(-1)[1], 6000, 50);
  ev = drive([[0.0005, 0.5], [0.1, 1], [0.0005, 3]]);
  assert.equal(ev[0][0], "speech"); assert.equal(ev.at(-1)[0], "stop-silence"); near(ev.at(-1)[1], 2400, 50);
  ev = drive([[0.1, 20]], { capSec: 5 });
  assert.equal(ev.at(-1)[0], "stop-cap"); near(ev.at(-1)[1], 5000, 50);
  ev = drive([[0.0005, 0.5], [0.1, 0.025], [0.0005, 0.3]]);
  assert.ok(!ev.some((e) => e[0] === "speech"));
  assert.equal(EP.levelFromRms(0.001), 0);
  assert.ok(EP.levelFromRms(0.1) > 0.5 && EP.levelFromRms(1) === 1);
});

await test("analyzeAttempt", () => {
  const SR = FX.SR;
  const run = (samples, fr, extra = {}) => K.analyzeAttempt({ samples, sampleRate: SR, fr, stoppedBy: "silence", attempt: 1, ...extra });
  const flat = FX.synth("flat");
  let r = run(flat, "Très");
  assert.equal(r.state, "success"); assert.equal(r.rose, null);
  assert.equal(run(FX.synth("silence"), "Très").state, "no-speech");
  assert.equal(run(flat.map((x) => x * 0.02), "Très").state, "too-quiet");
  let x = 7; const white = () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296 * 2 - 1; };
  const noisy = Float32Array.from(flat, (v) => v + white() * 0.15);
  assert.equal(run(noisy, "Très").state, "too-noisy");
  const burst = FX.synth("flat", { voiced: 0.1 });
  assert.equal(run(burst, "Je voudrais goûter la choucroute").state, "too-short");
  assert.equal(run(FX.synth("flat", { voiced: 9 }), "Très").state, "too-long");
  assert.equal(run(flat, "Très", { stoppedBy: "cap" }).state, "too-long");
  r = run(FX.synth("rising"), "Ça va ?");
  assert.equal(r.state, "success"); assert.equal(r.rose, true); assert.ok(r.riseSt >= 2, "riseSt " + r.riseSt);
  r = run(FX.synth("falling"), "Ça va ?");
  assert.equal(r.state, "near-miss"); assert.ok(r.contour && r.contour.length > 5);
  assert.equal(run(FX.synth("falling"), "Ça va ?", { attempt: 3 }).state, "thanks");
  assert.equal(run(FX.synth("rising"), "Très").rose, null);
  assert.deepEqual(run(FX.synth("rising"), "Ça va ?"), run(FX.synth("rising"), "Ça va ?"));
});

await test("step reducer", () => {
  const R = F.stepReducer;
  const res = { state: "success" };
  let s = F.INITIAL_STEP;
  assert.equal(F.canContinue(s), false);
  s = R(s, { type: "recorded" }); assert.equal(s.tag, "ready");
  s = R(s, { type: "start" }); assert.equal(s.tag, "recording");
  assert.equal(R(s, { type: "cancel" }).tag, "ready");
  s = R(s, { type: "recorded" }); assert.equal(s.tag, "processing");
  assert.equal(R(s, { type: "start" }), s);
  s = R(s, { type: "analyzed", result: res }); assert.equal(s.tag, "result"); assert.equal(s.attempts, 1);
  assert.ok(F.canContinue(s));
  assert.equal(R(s, { type: "start" }), s);
  s = R(s, { type: "retry" }); assert.equal(s.tag, "ready"); assert.equal(s.attempts, 1);
  const b = R(F.INITIAL_STEP, { type: "blocked", why: "denied" });
  assert.equal(b.tag, "blocked"); assert.ok(F.canContinue(b));
  assert.equal(R(b, { type: "retry" }).tag, "ready");
  assert.equal(R(R(F.INITIAL_STEP, { type: "start" }), { type: "blocked", why: "error" }).tag, "blocked");
});

await test("copy has no blaming words", () => {
  const strings = [
    ...Object.values(CP.RESULT_COPY).flatMap((c) => [c.title, c.body]), CP.ROSE_BODY,
    ...Object.values(CP.BLOCKED_COPY).flatMap((c) => [c.title, c.body]), ...Object.values(CP.PROMPT_COPY),
  ].filter(Boolean);
  assert.ok(strings.length > 20);
  for (const s of strings) assert.ok(!/wrong|fail|incorrect|score|%|error|bad/i.test(s), s);
});

await test("wav", () => {
  const b = W.encodeWavBytes(new Float32Array([0, 0.5, -0.5, 1]), 44100);
  const v = new DataView(b.buffer);
  const tag = (o) => String.fromCharCode(...b.slice(o, o + 4));
  assert.deepEqual([tag(0), tag(8), tag(12), tag(36)], ["RIFF", "WAVE", "fmt ", "data"]);
  assert.equal(v.getUint16(34, true), 16); assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint32(24, true), 44100); assert.equal(v.getUint32(40, true), 8); assert.equal(b.length, 52);
});

const R = await import("./refs.ts");
const ST = await import("./settings.ts");

await test("refs", async () => {
  assert.equal(R.fileStem("s il vous plait"), "s-il-vous-plait");
  for (const j of [null, {}, { version: 2 }, "x", { version: 1 }]) assert.deepEqual(R.parseManifest(j), R.EMPTY_MANIFEST);
  const m = R.parseManifest({ version: 1, voices: {
    m1: { "ca va": { file: "ca-va.m4a", v: "abc12345" } }, f1: { "ca va": { file: "ca-va.m4a", v: "3f9a1c2e" } },
    f2: { "ca va": { file: "ca-va.mp3", v: "00000000" } }, x9: { "ca va": { file: "ca-va.m4a", v: "1" } } } });
  assert.deepEqual(R.voicesFor(m, "Ça va ?"), ["f1", "m1", "f2"]);
  assert.equal(R.referenceUrl(m, "Ça va ?"), "/reference/f1/ca-va.m4a?v=3f9a1c2e");
  assert.equal(R.referenceUrl(m, "Ça va ?", "m1"), "/reference/m1/ca-va.m4a?v=abc12345");
  assert.equal(R.referenceUrl(m, "Merci"), null);
  const only = R.parseManifest({ version: 1, voices: { m1: { "ca va": { file: "ca-va.m4a", v: "abc12345" } } } });
  assert.equal(R.referenceUrl(only, "Ça va ?"), "/reference/m1/ca-va.m4a?v=abc12345");
  // loader: failures give null, a hit is fetched once
  let calls = 0;
  const made = [], revoked = [];
  globalThis.URL.createObjectURL = () => { const u = "blob:" + made.length; made.push(u); return u; };
  globalThis.URL.revokeObjectURL = (u) => revoked.push(u);
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).includes("manifest")) return { ok: true, json: async () => ({ version: 1, voices: { f1: { "ca va": { file: "ca-va.m4a", v: "aa" }, "pas mal": { file: "pas-mal.m4a", v: "bb" } } } }) };
    if (String(url).includes("pas-mal")) return { ok: false };
    return { ok: true, blob: async () => ({}) };
  };
  R.resetRefsForTests();
  assert.equal(await R.referenceBlobUrl("Ça va ?"), "blob:0");
  assert.equal(await R.referenceBlobUrl("Ça va ?"), "blob:0");
  assert.equal(calls, 2);
  assert.equal(await R.referenceBlobUrl("Pas mal"), null);
  assert.equal(await R.referenceBlobUrl("Merci"), null);
  globalThis.fetch = async () => { throw new Error("offline"); };
  R.resetRefsForTests();
  assert.equal(await R.referenceBlobUrl("Ça va ?"), null);
});

await test("settings", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  assert.equal(ST.speakingOn(), true);
  ST.setSpeakingOn(false); assert.equal(store.get("le-nid-speaking"), "0"); assert.equal(ST.speakingOn(), false);
  ST.setSpeakingOn(true); assert.equal(ST.speakingOn(), true);
  globalThis.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.equal(ST.speakingOn(), true); ST.setSpeakingOn(false);
  delete globalThis.localStorage;
});

const LAB = await import("./lab.ts");
await test("lab csv", () => {
  assert.equal(LAB.LAB_COLUMNS.length, 37);
  const csv = LAB.toCsv([{ tester: 'a"b', fr: "Ça va ?", words: "ça:1|va:1.2", raterLabel: "" }]);
  const [head, row] = csv.split("\r\n");
  assert.ok(head.startsWith("timestamp,tester,voiceGroup,room,attemptType,key,fr,syllables") && head.endsWith("analysisMs,userAgent,raterLabel"));
  assert.ok(row.includes('"a""b"') && row.split(",").length >= 37);
  const many = Array.from({ length: 510 }, (_, i) => ({ tester: String(i) }));
  assert.equal(many.reduce((acc, r) => LAB.addRow(acc, r), []).at(0).tester, "10");
});

//@@MORE@@

console.log(`speech phase1: ${passed} test groups passed${process.exitCode ? " (with failures)" : ""}`);
