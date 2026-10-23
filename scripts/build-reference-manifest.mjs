#!/usr/bin/env node
// Lists the volunteer recordings in public/reference/<voice>/ into public/reference/manifest.json.
// Run by `npm run dev` and `npm run build` (predev / prebuild). Plain Node, no imports from the app, exit code 0 always.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../public/reference/", import.meta.url);
const EXT = ["m4a", "mp3", "wav"];
const voices = {};
const counts = [];

if (existsSync(root)) {
  const folders = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const voice of folders) {
    if (!/^[fm][1-9]$/.test(voice)) { console.warn(`skipped folder ${voice}: voice folders are named f1, m1, f2, m2, ...`); continue; }
    const files = readdirSync(new URL(`${voice}/`, root)).filter((f) => !f.startsWith(".")).sort();
    const best = new Map(); // stem -> file
    for (const f of files) {
      const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(m4a|mp3|wav)$/.exec(f);
      if (!m) { console.warn(`skipped ${voice}/${f}: name it with the phrase key, e.g. bien-sur.m4a`); continue; }
      const old = best.get(m[1]);
      if (old) {
        const keep = EXT.indexOf(m[2]) < EXT.indexOf(old.split(".").pop()) ? f : old;
        console.warn(`${voice}/${m[1]} has two formats; keeping ${keep}`);
        best.set(m[1], keep);
      } else best.set(m[1], f);
    }
    const entries = {};
    for (const [stem, file] of [...best].sort(([a], [b]) => (a < b ? -1 : 1))) {
      const v = createHash("sha1").update(readFileSync(new URL(`${voice}/${file}`, root))).digest("hex").slice(0, 8);
      entries[stem.replace(/-/g, " ")] = { file, v };
    }
    voices[voice] = entries;
    counts.push(`${voice} ${Object.keys(entries).length}`);
  }
} else mkdirSync(root, { recursive: true });

writeFileSync(new URL("manifest.json", root), JSON.stringify({ version: 1, voices }, null, 2) + "\n");
console.log("reference manifest: " + (counts.join(", ") || "no voices"));
