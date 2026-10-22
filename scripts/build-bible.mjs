// Builds public/bible/{fr,en}/<BOOK>.json from eBible.org USFM zips. Run once, then COMMIT public/bible:
// the app fetches these static files at runtime and the scripture screens show a "not installed" notice without them.
//   node scripts/build-bible.mjs                 download both zips and convert (needs access to ebible.org)
//   node scripts/build-bible.mjs fr ./some/dir   convert already-extracted USFM files (lang, dir)
//   node scripts/build-bible.mjs --check         verify the committed output (exits 1 if anything is missing)
// Output per book: an array of chapters, each an array of verse strings (index 0 = verse 1).
//   "" = verse absent from this translation. "=" = verse merged into the previous one (USFM bridge "\v 1-2").
// Sources (all public domain): fr = BIBLE_FR env or frasbl (Sainte Bible libre pour le monde, chosen by the owner; still a draft, so proofread the verses used; set BIBLE_FR=fraLSG for Louis Segond 1910),
//   en = World English Bible (engwebp). Zips are named <id>_usfm.zip at https://ebible.org/Scriptures/.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const SOURCES = { fr: process.env.BIBLE_FR || "frasbl", en: process.env.BIBLE_EN || "engwebp" };
const CODES = new Set(
  "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV".split(" "),
);
// Spot checks: [book, chapter, first verse, last verse]. Must be non-empty in every language after a build.
const CHECKS = [["PSA", 23, 1, 1], ["JHN", 3, 16, 16], ["ROM", 8, 38, 39], ["ISA", 41, 10, 10]];

// Block markers whose text belongs to the current verse. Headings (\s \r \d \ms \mt ...) are skipped, which also drops psalm titles
// written as \d. Titles written as \v 1 stay in verse 1, as in the printed text.
const TEXT_MARKER = /^(p|m|mi|pm|pmo|pmc|pmr|pi\d?|pc|pr|ph\d?|q\d?|qr|qc|qm\d?|qa|li\d?|lim\d?|lh|lf|nb|b)$/;
const VERSE = /\\v\s+(\d+)(?:\s*[-–]\s*(\d+))?\S*\s*/;

const clean = (s) =>
  s.replace(/\\\+?w ([^|\\]*)(\|[^\\]*)?\\\+?w\*/g, "$1")
    .replace(/\\\+?[a-z]+\d*\*?/g, "").replace(/ /g, " ").replace(/\s+/g, " ").trim();

export function parseUsfm(input) {
  const text = input
    .replace(/\\(f|fe|x|fig|rq|va|vp|ef|ex)\s.*?\\\1\*/gs, "") // footnotes, cross refs, figures, alternate verse numbers (may span lines)
    .replace(/\\(esb|esbe)\b.*?\\\1e?\b/gs, "");
  let code = null, ch = null, vi = -1;
  const chapters = [];
  const add = (t) => {
    t = clean(t);
    if (t && ch && vi >= 0) ch[vi] = ch[vi] ? `${ch[vi]} ${t}` : t;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^\\([a-z]+\d*)(?:\s+|$)(.*)$/s);
    let body = line;
    if (m) {
      const [, mk, rest] = m;
      if (mk === "id") { code ??= rest.trim().split(/\s+/)[0]; continue; }
      if (mk === "c") { ch = []; chapters.push(ch); vi = -1; continue; }
      if (mk === "v") body = line;
      else if (TEXT_MARKER.test(mk)) body = rest;
      else if (!/^(w|nd|add|qs|tl|sc|wj|bk|k|pn|sls|em|bd|it|no|sig|ord|\+\w+)$/.test(mk)) continue; // heading, intro, metadata
    }
    if (!ch) continue;
    // A verse marker may appear anywhere on the line (e.g. "\q1 \v 1 text"), several times per line.
    const parts = body.split(new RegExp(VERSE.source, "g")); // [before, n, end, text, n, end, text, ...]
    add(parts[0]);
    for (let i = 1; i < parts.length; i += 3) {
      const a = Number(parts[i]), b = parts[i + 1] ? Number(parts[i + 1]) : a;
      while (ch.length < Math.max(a, b)) ch.push("");
      vi = a - 1;
      for (let n = a + 1; n <= b; n++) ch[n - 1] ||= "=";
      add(parts[i + 2]);
    }
  }
  return { code, chapters: chapters.map((c) => c.map((v) => v.trim())) };
}

function writeBook(lang, { code, chapters }) {
  if (!CODES.has(code) || !chapters.length) return false;
  const dir = join("public", "bible", lang);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${code}.json`), JSON.stringify(chapters));
  return true;
}

/** Returns a list of problems with the output in `root` (default public/bible). */
export function check(root = join("public", "bible")) {
  const bad = [];
  for (const lang of ["fr", "en"]) {
    for (const code of CODES) if (!existsSync(join(root, lang, `${code}.json`))) bad.push(`${lang}/${code}.json is missing`);
    for (const [code, c, from, to] of CHECKS) {
      const f = join(root, lang, `${code}.json`);
      if (!existsSync(f)) continue;
      const ch = JSON.parse(readFileSync(f, "utf8"))[c - 1] ?? [];
      for (let v = from; v <= to; v++) if (!ch[v - 1] || ch[v - 1] === "=") bad.push(`${lang} ${code} ${c}:${v} is empty`);
    }
  }
  return bad;
}

async function download(url) {
  let err;
  for (let i = 1; i <= 3; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (e) { err = e; await new Promise((r) => setTimeout(r, 1000 * i)); }
  }
  throw new Error(`${url}: ${err?.message ?? err}. If ebible.org is blocked here, download the zip elsewhere, extract it, and run: node scripts/build-bible.mjs <fr|en> <dir>`);
}

async function main() {
  const [a, b] = process.argv.slice(2);
  if (a === "--check") {
    const bad = check();
    console.log(bad.length ? bad.slice(0, 30).join("\n") + (bad.length > 30 ? `\n...and ${bad.length - 30} more` : "") : "public/bible OK");
    process.exit(bad.length ? 1 : 0);
  }
  if (a && b) {
    let n = 0;
    for (const f of readdirSync(b).filter((f) => /\.u?sfm$/i.test(f))) if (writeBook(a, parseUsfm(readFileSync(join(b, f), "utf8")))) n++;
    console.log(`${a}: ${n} books from ${b}`);
    return;
  }
  for (const [lang, id] of Object.entries(SOURCES)) {
    const files = unzipSync(await download(`https://ebible.org/Scriptures/${id}_usfm.zip`));
    let n = 0;
    for (const [name, data] of Object.entries(files)) if (/\.u?sfm$/i.test(name) && writeBook(lang, parseUsfm(strFromU8(data)))) n++;
    console.log(`${lang}: ${n} books from ${id}`);
    if (n < 66) console.warn(`  warning: expected 66 books, got ${n}`);
  }
  const bad = check();
  if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
  console.log("Spot checks passed. Now commit public/bible.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
