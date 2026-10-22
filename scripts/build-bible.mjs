// Builds public/bible/{fr,en}/<BOOK>.json from eBible.org USFM zips.
//   node scripts/build-bible.mjs                 download and convert (needs internet)
//   node scripts/build-bible.mjs fr ./some/dir   convert already-extracted USFM files (lang, dir)
// Output per book: an array of chapters, each an array of verse strings (index 0 = verse 1).
// Sources: fr = Sainte Bible libre pour le monde (frasbl, public domain), en = World English Bible (engwebp, public domain).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { unzipSync, strFromU8 } from "fflate";

const SOURCES = { fr: "frasbl", en: "engwebp" };

export function parseUsfm(text) {
  let code = null;
  const chapters = [];
  let ch = null, vi = -1;
  const clean = (s) =>
    s.replace(/\\f .*?\\f\*/gs, "").replace(/\\x .*?\\x\*/gs, "")
      .replace(/\\w ([^|\\]*)(\|[^\\]*)?\\w\*/g, "$1")
      .replace(/\\\+?[a-z]+\d*\*?/g, "").replace(/\s+/g, " ");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("\\id ")) code = line.split(/\s+/)[1];
    else if (line.startsWith("\\c ")) { ch = []; chapters.push(ch); vi = -1; }
    else if (ch && /^\\v\s/.test(line)) {
      const m = line.match(/^\\v\s+(\d+)\S*\s*(.*)$/);
      const n = Number(m[1]);
      while (ch.length < n) ch.push("");
      vi = n - 1;
      ch[vi] = clean(m[2]);
    } else if (ch && vi >= 0 && /^\\(p|q\d?|m|li\d?|pi\d?|nb)\b/.test(line)) {
      ch[vi] = clean(`${ch[vi]} ${line.replace(/^\\\S+\s*/, "")}`);
    }
  }
  return { code, chapters: chapters.map((c) => c.map((v) => v.trim())) };
}

function writeBook(lang, { code, chapters }) {
  if (!code || !chapters.length) return;
  const dir = join("public", "bible", lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${code}.json`), JSON.stringify(chapters));
}

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a && b) {
    for (const f of readdirSync(b).filter((f) => /\.u?sfm$/i.test(f))) writeBook(a, parseUsfm(readFileSync(join(b, f), "utf8")));
    return;
  }
  for (const [lang, id] of Object.entries(SOURCES)) {
    const url = `https://ebible.org/Scriptures/${id}_usfm.zip`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
    let n = 0;
    for (const [name, data] of Object.entries(files))
      if (/\.u?sfm$/i.test(name)) { writeBook(lang, parseUsfm(strFromU8(data))); n++; }
    console.log(`${lang}: ${n} files from ${id}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
