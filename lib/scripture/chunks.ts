// Splits a verse into 2 to 5 sections ("chunks") a beginner can hold in mind at once: a clause or phrase of
// about 3 to 8 words. Breaks go where a French reader pauses (end of sentence, ; : , then before a conjunction
// such as car, mais, afin que, si, que, et, then before a preposition), never right after a little word that needs
// the next one (le, de, ne, qu'..., afin), and never leave a one-word chunk. A dynamic program picks the split that
// best balances "good break points" against "even lengths", so the result is the same every time.
//
// Hand-tuned splits for the core verses live in content/scripture/chunks.json and win when they match the verse.
import overrides from "@/content/scripture/chunks.json";
import { fold, pieces } from "./tokens";

export type Chunk = { fr: string; en?: string };

const STRONG = new Set(["mais", "car", "afin", "alors", "si", "lorsque", "quand", "parce", "puisque", "donc", "ainsi", "cependant", "or"]);
const MID = new Set(["que", "et", "ou", "ni", "comme", "pour", "dont", "ou"]);
const PREP = new Set(["par", "dans", "en", "avec", "chez", "envers", "sur", "sans", "vers", "selon", "devant", "contre", "a", "au", "aux", "jusqu'a", "parmi", "depuis"]);
// a chunk must not end on one of these: they lean on the next word
const LEAN = new Set([
  "le", "la", "les", "l'", "un", "une", "des", "du", "de", "d'", "au", "aux", "a", "en", "par", "pour", "dans", "sur", "avec", "chez",
  "son", "sa", "ses", "mon", "ma", "mes", "ton", "ta", "tes", "notre", "nos", "votre", "vos", "leur", "leurs", "ce", "cet", "cette", "ces",
  "je", "tu", "il", "elle", "on", "nous", "vous", "ils", "elles", "me", "te", "se", "ne", "n'", "qu'", "que", "qui", "et", "ou", "mais", "car",
  "afin", "alors", "parce", "si", "tant", "tres", "plus", "moins", "lui", "y",
]);
const OPENERS = /^[«“‘(\[—–-]+$/; // opening punctuation that belongs with the following word
const ENDS_SENTENCE = /[.!?…]["»”’)]*$/;
const ENDS_CLAUSE = /[;:]["»”’)]*$/;
const ENDS_COMMA = /,["»”’)]*$/;

type Unit = { toks: string[]; first: string; last: string; tail: string };

/** Words with their attached punctuation tokens: "mort ;" is one unit, "« Je" is one unit. */
function units(text: string): Unit[] {
  const out: Unit[] = [];
  let pending: string[] = [];
  for (const t of pieces(text)) {
    const punct = !/[\p{L}\p{N}]/u.test(t);
    if (punct && !OPENERS.test(t) && out.length && !pending.length) {
      const u = out[out.length - 1];
      u.toks.push(t); u.tail = t;
      continue;
    }
    if (punct) { pending.push(t); continue; }
    const w = fold(t);
    out.push({ toks: [...pending, t], first: w, last: w, tail: t });
    pending = [];
  }
  if (pending.length) {
    if (out.length) { const u = out[out.length - 1]; u.toks.push(...pending); u.tail = pending[pending.length - 1]; }
    else out.push({ toks: pending, first: "", last: "", tail: pending[pending.length - 1] });
  }
  return out;
}

const head = (w: string) => (w.includes("'") ? w.slice(0, w.indexOf("'") + 1) : w); // "qu'il" -> "qu'"

/** How good a break is between unit i and unit i + 1 (higher is better; negative means avoid). */
function breakScore(a: Unit, b: Unit) {
  let s = 0;
  if (ENDS_SENTENCE.test(a.tail)) s += 10;
  else if (ENDS_CLAUSE.test(a.tail)) s += 9;
  else if (ENDS_COMMA.test(a.tail)) s += 7;
  const next = head(b.first);
  if (STRONG.has(next)) s += 5;
  else if (MID.has(next) || next === "qu'") s += 3;
  else if (PREP.has(next)) s += 2;
  if (!ENDS_COMMA.test(a.tail) && !ENDS_CLAUSE.test(a.tail) && !ENDS_SENTENCE.test(a.tail)) {
    if (LEAN.has(a.last) || LEAN.has(head(a.last))) s -= 12;
    if (s === 0) s = -5; // mid-phrase
  }
  return s;
}

/** Automatic split into 2 to 5 chunks (1 for verses under 4 words). Joining the chunks with spaces gives the verse back. */
export function autoChunks(text: string): string[] {
  const u = units(text);
  const n = u.length;
  if (n < 4) return u.length ? [u.flatMap((x) => x.toks).join(" ")] : [];
  const score = u.slice(0, -1).map((a, i) => breakScore(a, u[i + 1]));
  const maxK = Math.min(5, Math.floor(n / 2));
  const ideal = n / 6.5; // about 6 to 7 words per chunk feels right for beginners
  let best: { cost: number; cuts: number[] } | null = null;
  for (let k = 2; k <= maxK; k++) {
    const target = n / k;
    const lenCost = (len: number) => (len < 2 ? Infinity : 0.45 * (len - target) ** 2 + (len > 10 ? 4 * (len - 10) : 0));
    // dp[c][j]: best cost of cutting the first j units into c chunks
    const dp = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(Infinity));
    const from = Array.from({ length: k + 1 }, () => Array<number>(n + 1).fill(-1));
    dp[0][0] = 0;
    for (let c = 1; c <= k; c++)
      for (let j = 1; j <= n; j++)
        for (let i = c - 1; i < j; i++) {
          if (dp[c - 1][i] === Infinity) continue;
          const cut = j < n ? -score[j - 1] : 0; // reward breaking after unit j - 1
          const cost = dp[c - 1][i] + lenCost(j - i) + (c < k ? cut : 0);
          if (cost < dp[c][j]) { dp[c][j] = cost; from[c][j] = i; }
        }
    const total = dp[k][n] + 3 * Math.abs(k - ideal);
    if (total === Infinity) continue;
    const cuts: number[] = [];
    for (let c = k, j = n; c > 0; c--) { cuts.unshift(j); j = from[c][j]; }
    if (!best || total < best.cost) best = { cost: total, cuts };
  }
  if (!best) return [u.flatMap((x) => x.toks).join(" ")];
  const out: string[] = [];
  let start = 0;
  for (const end of best.cuts) { out.push(u.slice(start, end).flatMap((x) => x.toks).join(" ")); start = end; }
  return out;
}

const squash = (s: string) => fold(s).replace(/[\s']+/g, "");

type Override = { fr: string; en?: string }[];
const OVERRIDES = overrides as unknown as Record<string, Override | string>;

/** The hand-tuned entry for a verse key when it matches the verse text, else null (with a console warning in dev). */
export function overrideFor(key: string, text: string): Chunk[] | null {
  const o = OVERRIDES[key];
  if (!Array.isArray(o) || o.length < 1 || o.length > 6 || o.some((c) => !c || typeof c.fr !== "string" || !c.fr.trim())) return null;
  if (squash(o.map((c) => c.fr).join(" ")) !== squash(text)) {
    if (process.env.NODE_ENV !== "production") console.warn(`content/scripture/chunks.json: "${key}" does not match the verse text; using the automatic split.`);
    return null;
  }
  // Display the real verse text, cut where the hand-tuned pieces end (so apostrophe or spacing differences never show).
  const words = pieces(text);
  const out: Chunk[] = [];
  let at = 0;
  for (const c of o) {
    const n = pieces(c.fr).length;
    out.push({ fr: words.slice(at, at + n).join(" "), en: c.en || undefined });
    at += n;
  }
  return at === words.length && out.every((c) => c.fr) ? out : null;
}

/** Chunks for a verse: the hand-tuned split when there is one, otherwise the automatic split. */
export function chunksFor(key: string, text: string): Chunk[] {
  return overrideFor(key, text) ?? autoChunks(text).map((fr) => ({ fr }));
}
