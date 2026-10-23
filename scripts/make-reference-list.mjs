#!/usr/bin/env node
// Prints the phrase list volunteers record from (docs/recording-guide.md).
// Usage: node scripts/make-reference-list.mjs [--format md|csv] [--out file] [--only say-it|sounds|all]
// Imports the real TypeScript modules through small loader hooks (same trick as scripts/check-curriculum.mjs).
import { register } from "node:module";
import { existsSync, readdirSync, writeFileSync } from "node:fs";

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

const arg = (name, dflt) => { const i = process.argv.indexOf("--" + name); return i > 0 ? process.argv[i + 1] : dflt; };
const format = arg("format", "md"), out = arg("out", ""), only = arg("only", "all");
if (!["md", "csv"].includes(format) || !["say-it", "sounds", "all"].includes(only)) {
  console.error("usage: make-reference-list.mjs [--format md|csv] [--out <file>] [--only say-it|sounds|all]");
  process.exit(1);
}

const C = await import("../lib/french/content.ts");
const E = await import("../lib/french/exercises.ts");
const S = await import("../lib/speech/select.ts");
const R = await import("../lib/speech/refs.ts");
const { ALL_LESSONS } = C;

const lessonOf = new Map();
for (const l of ALL_LESSONS) for (const p of l.phrases) if (!lessonOf.has(p)) lessonOf.set(p, l);

const rows = [];
const seen = new Set();
const add = (p, priority) => {
  const key = E.phraseKey(p.fr);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push({ key, p, priority });
};
for (const l of ALL_LESSONS) for (const p of S.speakPhrasesFor(l.id)) add(p, "say-it");
if (only !== "say-it") {
  const all = ALL_LESSONS.map((l) => l.id);
  for (const c of S.SOUND_CARDS) {
    for (const p of S.practiceSet(c.tag, all)) add(p, "sounds");
    for (const p of S.practiceSet(c.tag, [])) add(p, "sounds");
  }
}
if (only === "all") for (const p of C.ALL_PHRASES) add(p, "course");

// which voice folders exist, and which files they hold
const refRoot = new URL("../public/reference/", import.meta.url);
const voices = existsSync(refRoot)
  ? readdirSync(refRoot, { withFileTypes: true }).filter((d) => d.isDirectory() && /^[fm][1-9]$/.test(d.name)).map((d) => d.name).sort()
  : [];
const have = Object.fromEntries(voices.map((v) => [v, new Set(readdirSync(new URL(`${v}/`, refRoot)).map((f) => f.replace(/\.[^.]+$/, "")))]));

const header = ["n", "file", "french", "english", "lesson", "priority", "note", ...voices];
const table = rows.map((r, i) => {
  const stem = R.fileStem(r.key);
  const l = lessonOf.get(r.p);
  return [String(i + 1), stem, r.p.fr, r.p.en, l ? `${l.id} ${l.title}` : "", r.priority, r.p.note ?? "", ...voices.map((v) => (have[v].has(stem) ? "yes" : ""))];
});

let text;
if (format === "csv") {
  const q = (s) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  text = [header, ...table].map((r) => r.map(q).join(",")).join("\r\n") + "\r\n";
} else {
  const cell = (s) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  text = [
    "# Phrases to record", "", "How to record: see docs/recording-guide.md.", "",
    `| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`,
    ...table.map((r) => `| ${r.map(cell).join(" | ")} |`), "",
  ].join("\n");
}
if (out) writeFileSync(out, text); else process.stdout.write(text);

const stems = new Set(rows.map((r) => R.fileStem(r.key)));
const allStems = new Set(C.ALL_PHRASES.map((p) => R.fileStem(E.phraseKey(p.fr))));
for (const v of voices) for (const s of have[v]) if (s && !allStems.has(s) && !stems.has(s)) console.error(`${v}/${s}: matches no phrase key`);
