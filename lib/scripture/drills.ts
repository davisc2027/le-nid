import { normalize } from "@/lib/french/exercises";

export const words = (text: string) => text.split(/\s+/).filter(Boolean);
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/** Hides about `ratio` of the longer words. Returns the hidden word indexes. */
export function pickBlanks(text: string, ratio: number): Set<number> {
  const w = words(text);
  const candidates = w.map((x, i) => ({ x, i })).filter(({ x }) => normalize(x).length >= 3);
  const n = Math.max(1, Math.round(w.length * ratio));
  return new Set(shuffle(candidates).slice(0, n).map((c) => c.i));
}

/** "Car Dieu a tant aimé" -> "C D a t a" */
export const firstLetters = (text: string) => words(text).map((w) => w.replace(/^[^\p{L}\p{N}]*/u, "")[0]).filter(Boolean).join(" ");

/** Splits into 3 to 5 phrase chunks, preferring punctuation breaks. */
export function chunks(text: string): string[] {
  const w = words(text);
  const target = Math.min(5, Math.max(3, Math.round(w.length / 5)));
  const size = Math.ceil(w.length / target);
  const out: string[] = [];
  let cur: string[] = [];
  for (const word of w) {
    cur.push(word);
    if (cur.length >= size || (cur.length >= 3 && /[,;:.!?]$/.test(word))) { out.push(cur.join(" ")); cur = []; }
  }
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/** Normalized comparable tokens of a text, each tagged with the index of its whitespace word. Punctuation-only tokens (":", "«", "»") drop out. */
function tokens(text: string) {
  return words(text).flatMap((w, owner) => normalize(w).split(" ").filter(Boolean).map((t) => ({ t, owner })));
}

/** Word-by-word comparison via longest common subsequence. Lenient on accents, case and punctuation (so "l homme" = "l'homme"). */
export function gradeRecall(input: string, expected: string) {
  const a = tokens(input).map((x) => x.t);
  const e = tokens(expected);
  const en = e.map((x) => x.t);
  const L = Array.from({ length: en.length + 1 }, () => Array<number>(a.length + 1).fill(0));
  for (let i = en.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      L[i][j] = en[i] === a[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Set<number>();
  for (let i = 0, j = 0; i < en.length && j < a.length; ) {
    if (en[i] === a[j]) { hit.add(i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const bad = new Set(e.filter((_, i) => !hit.has(i)).map((x) => x.owner));
  return { marks: words(expected).map((word, i) => ({ word, ok: !bad.has(i) })), score: en.length ? hit.size / en.length : 0 };
}

export const PASS = 0.9;
