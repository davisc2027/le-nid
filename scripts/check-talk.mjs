#!/usr/bin/env node
// Standalone checks for the pure logic of Conversation mode (no framework, no network, no microphone):
//   node --experimental-strip-types scripts/check-talk.mjs        (Node 22; the flag is optional from 22.18)
// Imports the real TypeScript modules under lib/talk and lib/translate. Exits 1 on the first failed group.
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
// Let extensionless relative imports and "@/..." aliases resolve to .ts files, the way the bundler does.
const hook = `
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = ${JSON.stringify(root)};
export async function resolve(spec, ctx, next) {
  let target = null;
  if (spec.startsWith("@/")) target = root + spec.slice(2);
  else if ((spec.startsWith("./") || spec.startsWith("../")) && ctx.parentURL) target = fileURLToPath(new URL(spec, ctx.parentURL));
  if (target && !/\\.[a-z]+$/.test(target) && existsSync(target + ".ts")) return next(pathToFileURL(target + ".ts").href, ctx);
  return next(spec, ctx);
}`;
register("data:text/javascript," + encodeURIComponent(hook), import.meta.url);

const load = (p) => import(pathToFileURL(root + p).href);
const { textLanguage, resolveSide, resolveSideDetail } = await load("lib/talk/lang.ts");
const hall = await load("lib/talk/hallucination.ts");
const { encodeWav } = await load("lib/talk/wav.ts");
const { createRing, assembleClip } = await load("lib/talk/ring.ts");
const { createVad, rmsFromFloats, bandRatio } = await load("lib/talk/vad.ts");
const { buildPhrasebook, lookupPhrase } = await load("lib/talk/phrasebook.ts");
const { createTranslationCache } = await load("lib/talk/cache.ts");
const { createLimiter } = await load("lib/talk/queue.ts");
const { translationWarnings } = await load("lib/talk/warnings.ts");
const { buildWhisperPrompt, isPromptEcho, trimContext } = await load("lib/talk/whisper-prompt.ts");
const glossary = await load("lib/translate/glossary.ts");
const script = await import(pathToFileURL(root + "scripts/sync-deepl-glossary.mjs").href);

let failed = 0, passed = 0;
const groups = [];
const group = (name, fn) => groups.push([name, fn]);
function eq(a, b, msg = "") { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function ok(c, msg) { if (!c) throw new Error(msg); }

group("text language check", () => {
  const cases = [
    ["Hello, how are you today?", "en"], ["I don't know where the church is", "en"], ["Thank you very much", "en"],
    ["Bonjour, comment allez-vous ?", "fr"], ["Je ne sais pas où est l'église", "fr"], ["Merci beaucoup", "fr"], ["Nous allons au culte dimanche", "fr"],
    ["Où est la cathédrale ?", "fr"],
  ];
  for (const [t, lang] of cases) eq(textLanguage(t).lang, lang, t);
  eq(textLanguage("OK").lang, "", "OK is neutral");
  eq(textLanguage("Homme de Fer").strong, false, "a place name is not strong evidence");
  ok(textLanguage("Where is the cathedral?").strong, "clear English is strong");
});

group("resolveSide", () => {
  eq(resolveSide("fr", "Je suis content de vous voir"), "fr");
  eq(resolveSide("en", "Hello, how are you today?"), "en");
  eq(resolveSide("en", "Je suis content de vous voir aujourd'hui"), "fr", "strong French text overrules an en label");
  eq(resolveSide("fr", "OK"), "fr", "weak text keeps Whisper's label");
  eq(resolveSide("de", "Bonjour, je voudrais un café"), "fr", "German label, French text");
  eq(resolveSide("de", "Where is the station?"), "en");
  eq(resolveSide("", "xyz"), "en", "nothing to go on: English like before");
  eq(resolveSideDetail("nl", "Merci beaucoup").source, "text");
});

group("segment filtering", () => {
  const seg = (text, lp, nsp, cr = 1.2) => ({ text, avg_logprob: lp, no_speech_prob: nsp, compression_ratio: cr, start: 0, end: 2 });
  const a = hall.summarizeSegments("", [seg(" Bonjour tout le monde.", -0.3, 0.02), seg(" Sous-titres réalisés par la communauté d'Amara.org", -1.4, 0.9)]);
  eq(a.text, "Bonjour tout le monde.", "silence-failed segment dropped, rest kept");
  eq(a.droppedCount, 1);
  ok(!a.lowConfidence && a.confidence > 0.6, "confident");
  const loop = hall.summarizeSegments("", [seg(" la la la la la la la la", -0.5, 0.1, 3.1)]);
  eq(loop.text, "", "looping segment dropped");
  const low = hall.summarizeSegments("", [seg(" Je crois en Dieu", -0.9, 0.1)]);
  ok(low.lowConfidence && low.text === "Je crois en Dieu", "kept but marked low confidence");
  const sus = hall.summarizeSegments("", [seg(" Thank you.", -0.4, 0.85)]);
  eq(sus.text, "", "a suspect phrase with high no_speech_prob is dropped");
  eq(hall.summarizeSegments("plain text", undefined).text, "plain text", "no segments: text untouched");
});

group("short replies are no longer dropped ('oui' fix)", () => {
  const d = hall.shouldDropTranscript;
  eq(d("Oui.", { durationSec: 0.8, peakRms: 0.2, noSpeechProb: 0.05 }), false, "oui, short, loud");
  eq(d("Merci.", { durationSec: 0.9, peakRms: 0.2, noSpeechProb: 0.1 }), false, "merci, short, confident");
  eq(d("Thank you.", { durationSec: 0.9, peakRms: 0.2, noSpeechProb: 0.1 }), false);
  eq(d("Thank you.", { durationSec: 3, peakRms: 0.02, noSpeechProb: 0.1 }), true, "quiet clip");
  eq(d("Thank you.", { durationSec: 3, peakRms: 0.2, noSpeechProb: 0.7 }), true, "doubted by Whisper");
  eq(d("Merci.", { durationSec: 0.9, peakRms: 0.2 }), true, "short and no confidence info");
  eq(d("Oui", { durationSec: 0.5, peakRms: 0.2 }), false, "oui is not a known hallucination");
  eq(d("Sous-titrage ST' 501", { durationSec: 5, peakRms: 0.3 }), true, "always-list");
});

group("de-looping", () => {
  eq(hall.deloop("je crois en Dieu je crois en Dieu je crois en Dieu je crois en Dieu"), "je crois en Dieu");
  eq(hall.deloop("it is what it is"), "it is what it is", "a normal repeat is kept");
  eq(hall.deloop("Merci merci merci beaucoup"), "Merci merci merci beaucoup", "short repeats are left to the other rule");
});

group("WAV encoder (16 kHz mono 16-bit)", () => {
  const samples = new Float32Array(16000).fill(0.5);
  const buf = encodeWav(samples, 16000), v = new DataView(buf);
  const tag = (o) => String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  eq([tag(0), tag(8), tag(12), tag(36)], ["RIFF", "WAVE", "fmt ", "data"]);
  eq([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true)], [1, 1, 16000, 32000, 2, 16]);
  eq(v.getUint32(40, true), 32000, "data bytes");
  eq(buf.byteLength, 44 + 32000);
  eq(v.getInt16(44, true), Math.floor(0.5 * 0x7fff), "sample value");
  eq(new DataView(encodeWav(new Float32Array([2, -2]))).getInt16(44, true), 32767, "clips instead of wrapping");
});

group("ring buffer and pre-roll assembly", () => {
  const ring = createRing(10);
  ring.push(Float32Array.from([1, 2, 3, 4]));
  eq(Array.from(ring.snapshot()), [1, 2, 3, 4]);
  ring.push(Float32Array.from([5, 6, 7, 8, 9, 10, 11, 12]));
  eq(Array.from(ring.snapshot()), [3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "keeps the newest 10, oldest first");
  ring.clear();
  eq(ring.size(), 0);
  const clip = assembleClip(Float32Array.from([1, 2]), [Float32Array.from([3, 4]), Float32Array.from([5, 6])], 0);
  eq(Array.from(clip), [1, 2, 3, 4, 5, 6]);
  eq(Array.from(assembleClip(Float32Array.from([1, 2]), [Float32Array.from([3, 4, 5, 6])], 3)), [1, 2, 3], "trailing silence trimmed");
  eq(assembleClip(new Float32Array(2), [], 99).length, 0, "over-trim is safe");
});

group("VAD: adaptive end silence, soft cap, learn()", () => {
  function run(speechMs, cfg = {}) {
    const vad = createVad({ initialFloor: 0.006, ...cfg });
    let t = 0, end = null;
    for (; t < 500; t += 50) vad.step(0.006, t);
    const t0 = t;
    let lastVoice = t0;
    for (; t < t0 + speechMs; t += 50) { const dip = ((t - t0) / 50) % 4 === 3; if (!dip) lastVoice = t; const e = vad.step(dip ? 0.008 : 0.1, t); if (e.type === "end") end = e; }
    for (; t < lastVoice + 3000 && !end; t += 50) { const e = vad.step(0.004, t); if (e.type === "end") end = e; }
    return { end, hang: end ? t - 50 - lastVoice : null };
  }
  const short = run(1000), mid = run(3000), long = run(8000);
  ok(short.end && mid.end && long.end, "all end");
  eq([short.hang, mid.hang, long.hang], [1100, 900, 700], "hang time 1100 / 900 / 700 ms");
  eq(run(1000, { adaptiveEnd: false }).hang, 900, "fixed hang when adaptive is off");
  // A long monologue with brief pauses is cut at a pause after 12 s, not mid-word at the hard cap.
  const vad = createVad();
  let t = 0, ended = null;
  for (; t < 500; t += 50) vad.step(0.006, t);
  const start = t;
  for (; t < start + 30000 && !ended; t += 50) {
    const pause = (t - start) % 4000 >= 3600; // 400 ms pause every 4 s
    const e = vad.step(pause ? 0.004 : ((t - start) / 50) % 4 === 3 ? 0.008 : 0.1, t);
    if (e.type === "end") ended = { ...e, at: t - start };
  }
  ok(ended && ended.reason === "softcap" && ended.at >= 12000 && ended.at < 17000, `soft cap ended at ${ended?.at} (${ended?.reason})`);
  const l = createVad();
  for (let i = 0; i < 40; i++) l.learn(0.02);
  ok(l.floor() > 0.015 && l.phase() === "idle", "learn() raises the floor and never arms");
  ok(Math.abs(rmsFromFloats(new Float32Array(100).fill(0.5)) - 0.5) < 1e-9, "rms");
  const bins = new Float32Array(512).fill(-100);
  for (let i = 20; i < 100; i++) bins[i] = -30; // about 430 Hz .. 2.2 kHz at 16 kHz sample rate? (hz per bin = 15.6)
  ok(bandRatio(bins, 16000) > 0.9, "speech band ratio high");
  const rumble = new Float32Array(512).fill(-100);
  for (let i = 1; i < 8; i++) rumble[i] = -30;
  ok(bandRatio(rumble, 16000) < 0.1, "rumble ratio low");
});

group("phrasebook (real units.json)", () => {
  const units = JSON.parse(readFileSync(root + "content/french/units.json", "utf8"));
  const pb = buildPhrasebook(units);
  ok(pb.toEn.size > 200 && pb.toFr.size > 200, `phrasebook size ${pb.toEn.size}/${pb.toFr.size}`);
  eq(lookupPhrase(pb, "Je ne crois pas en Dieu.", "EN-US"), "I don't believe in God");
  eq(lookupPhrase(pb, "je ne crois pas en dieu", "EN-US"), "I don't believe in God", "case and punctuation ignored");
  eq(lookupPhrase(pb, "I don't know", "FR"), "Je ne sais pas");
  eq(lookupPhrase(pb, "S'il te plaît", "EN-US"), "Please", "tu variant is understood");
  eq(lookupPhrase(pb, "Please", "FR"), "S'il vous plaît", "English becomes the vous form");
  eq(lookupPhrase(pb, "The cathedral is closed on Mondays because of renovation", "FR"), null);
  eq(lookupPhrase(pb, "Tu", "EN-US"), null, "glossed notes are skipped");
});

group("translation cache", () => {
  const c = createTranslationCache(2);
  c.set("Hello there", "FR", "Bonjour");
  eq(c.get("  hello   THERE ", "FR"), "Bonjour", "normalised key");
  eq(c.get("Hello there", "EN-US"), undefined, "direction is part of the key");
  c.set("a", "FR", "A"); c.get("Hello there", "FR"); c.set("b", "FR", "B");
  eq([c.get("a", "FR"), c.get("Hello there", "FR"), c.get("b", "FR")], [undefined, "Bonjour", "B"], "least recently used leaves first");
});

group("limiter (pipelined transcription)", () => {
  let active = 0, peak = 0;
  const lim = createLimiter(2);
  const job = () => lim.run(async () => { active++; peak = Math.max(peak, active); await new Promise((r) => setTimeout(r, 10)); active--; return 1; });
  return Promise.all([job(), job(), job(), job()]).then(() => { eq(peak, 2); });
});

group("translation warnings", () => {
  eq(translationWarnings("I don't have time today", "J'ai le temps aujourd'hui", "FR"), ["negation"]);
  eq(translationWarnings("I don't have time today", "Je n'ai pas le temps aujourd'hui", "FR"), []);
  eq(translationWarnings("Je n'ai pas le temps", "I have time", "EN-US").includes("negation"), true);
  ok(translationWarnings("We read Romans 3:23 today at church", "Nous lisons Romains 3:25 aujourd'hui à l'église", "FR").includes("numbers"), "digit mismatch");
  eq(translationWarnings("Let's meet at 3 pm tomorrow", "Retrouvons-nous demain à 15 h", "FR"), [], "clock times are not flagged");
  ok(translationWarnings("Where can I find a good coffee shop?", "Where can I find a good coffee shop?", "FR").includes("language"), "unchanged output");
  ok(translationWarnings("This is a very long sentence about the weather in Strasbourg today", "Oui", "FR").includes("length"));
});

group("Whisper prompt and echo guard", () => {
  const book = { fr: "Jésus-Christ, le Saint-Esprit, l'Évangile, la Bible", en: "Jesus Christ, the Holy Spirit, the Gospel", auto: "Strasbourg, Kléber" };
  eq(buildWhisperPrompt(book, ""), "Strasbourg, Kléber", "auto mode: neutral names only");
  eq(buildWhisperPrompt(book, "fr", "Bonjour tout le monde"), "Jésus-Christ, le Saint-Esprit, l'Évangile, la Bible Bonjour tout le monde");
  ok(trimContext("x ".repeat(200)).length <= 120, "context capped");
  ok(isPromptEcho("Jésus-Christ le Saint-Esprit l'Évangile la Bible", book.fr), "contiguous copy");
  ok(isPromptEcho("Jesus Christ Holy Spirit Gospel", book.en, { durationSec: 1.1 }), "mostly prompt words, short clip");
  eq(isPromptEcho("The Holy Spirit gave us grace today in church", book.en, { durationSec: 5, peakRms: 0.2 }), false, "real speech with a prompt term");
  eq(isPromptEcho("Jesus", book.en, { durationSec: 1 }), false, "one word is never an echo");
});

group("glossary: pairs, text selection, script parity", () => {
  const data = JSON.parse(readFileSync(root + "content/talk/glossary.json", "utf8"));
  const e = data.entries;
  eq(glossary.pairsFor(e, "fr-en").find((p) => p.from === "culte")?.to, "worship service", "culte -> worship service (not cult)");
  ok(!glossary.pairsFor(e, "fr-en").some((p) => p.from === "grâce"), "grâce is one-way (grâce à = thanks to)");
  ok(glossary.pairsFor(e, "en-fr").some((p) => p.from === "grace"), "grace -> grâce");
  ok(!e.some((x) => ["Jean", "Marc", "Luc", "Job", "John", "Mark", "Luke"].includes(x.fr) || ["John", "Mark", "Luke", "Job"].includes(x.en)), "no first-name-like books");
  ok(e.every((x) => x.reviewed === false), "every entry marked for review");
  eq(glossary.selectForText(e, "fr-en", "Nous allons au culte et à l'étude biblique").map((p) => p.to), ["worship service", "Bible study"]);
  eq(glossary.selectForText(e, "fr-en", "Je suis en train de cultiver mon jardin"), [], "whole words only");
  eq(glossary.selectForText(e, "en-fr", "the Holy Spirit and Romans 8").map((p) => p.to).sort(), ["Romains", "Saint-Esprit"]);
  for (const d of ["en-fr", "fr-en"]) {
    const ours = new Set(glossary.pairsFor(e, d).map((p) => `${p.from}\t${p.to}`));
    const theirs = new Set(script.buildPairs(e, d).map((p) => `${p.from}\t${p.to}`));
    ok([...ours].every((x) => theirs.has(x)), `${d}: sync script contains every pair`);
  }
});

for (const [name, fn] of groups) {
  try { await fn(); console.log(`ok   ${name}`); passed++; }
  catch (e) { console.log(`FAIL ${name}\n     ${e.message}`); failed++; }
}
console.log(`\n${passed} groups passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
