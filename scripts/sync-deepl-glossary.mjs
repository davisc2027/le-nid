#!/usr/bin/env node
// Creates (or refreshes) the two DeepL glossaries from content/talk/glossary.json and prints their ids.
//   DEEPL_API_KEY=xxxx:fx node scripts/sync-deepl-glossary.mjs            # real sync
//   node scripts/sync-deepl-glossary.mjs --dry-run                          # print what would be sent, no key needed
// Then put the printed ids in Vercel as DEEPL_GLOSSARY_EN_FR and DEEPL_GLOSSARY_FR_EN and redeploy.
// A DeepL (v2) glossary cannot be edited in place, so each run creates a fresh glossary, then deletes the older one
// with the same name. The ids therefore change on every run: update the two env vars each time. Until you do, the
// app still translates (a stale id is rejected by DeepL and the app asks again without a glossary).
// Free keys (ending in :fx) use api-free.deepl.com, paid keys api.deepl.com, as lib/translate/providers.ts does.
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const NAMES = { "en-fr": "le-nid-en-fr", "fr-en": "le-nid-fr-en" };
const upperFirst = (s) => (s ? s[0].toLocaleUpperCase("fr") + s.slice(1) : s);

/** [{from, to}] for one direction, plus capitalised copies where allowed. Same rules as lib/translate/glossary.ts. */
export function buildPairs(entries, direction) {
  const out = new Map();
  for (const e of entries) {
    const dir = e.dir ?? "both";
    if (dir !== "both" && dir !== direction) continue;
    const from = (direction === "en-fr" ? e.en : e.fr).trim();
    const to = (direction === "en-fr" ? e.fr : e.en).trim();
    if (!from || !to || /[\t\n\r]/.test(from + to)) continue;
    if (!out.has(from)) out.set(from, to);
    const capFrom = upperFirst(from), capTo = upperFirst(to);
    if (e.capVariant !== false && capFrom !== from && !out.has(capFrom)) out.set(capFrom, capTo);
  }
  return [...out].map(([from, to]) => ({ from, to }));
}

export const toTsv = (pairs) => pairs.map((p) => `${p.from}\t${p.to}`).join("\n");

async function api(host, key, method, path, body) {
  const res = await fetch(`https://${host}${path}`, {
    method,
    headers: { Authorization: `DeepL-Auth-Key ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const file = fileURLToPath(new URL("../content/talk/glossary.json", import.meta.url));
  const entries = JSON.parse(readFileSync(file, "utf8")).entries;
  const sets = { "en-fr": buildPairs(entries, "en-fr"), "fr-en": buildPairs(entries, "fr-en") };
  if (!sets["en-fr"].length || !sets["fr-en"].length) throw new Error("Glossary has no entries for one direction.");

  const key = process.env.DEEPL_API_KEY?.trim();
  if (dry || !key) {
    if (!dry) console.log("DEEPL_API_KEY is not set: showing a dry run.\n");
    for (const d of ["en-fr", "fr-en"]) console.log(`${NAMES[d]} (${sets[d].length} entries)\n${toTsv(sets[d])}\n`);
    return;
  }
  const host = key.endsWith(":fx") ? "api-free.deepl.com" : "api.deepl.com";
  const existing = (await api(host, key, "GET", "/v2/glossaries"))?.glossaries ?? [];
  const ids = {};
  for (const d of ["en-fr", "fr-en"]) {
    const [src, tgt] = d.split("-");
    const created = await api(host, key, "POST", "/v2/glossaries", {
      name: NAMES[d], source_lang: src, target_lang: tgt, entries: toTsv(sets[d]), entries_format: "tsv",
    });
    ids[d] = created.glossary_id;
    for (const old of existing.filter((g) => g.name === NAMES[d] && g.glossary_id !== created.glossary_id)) {
      await api(host, key, "DELETE", `/v2/glossaries/${old.glossary_id}`).catch((e) => console.warn(`Could not delete old glossary ${old.glossary_id}: ${e.message}`));
    }
    console.log(`${NAMES[d]}: ${sets[d].length} entries`);
  }
  console.log("\nSet these environment variables (Vercel -> Settings -> Environment Variables), then redeploy:\n");
  console.log(`DEEPL_GLOSSARY_EN_FR=${ids["en-fr"]}`);
  console.log(`DEEPL_GLOSSARY_FR_EN=${ids["fr-en"]}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
