import { autoChunks } from "./chunks";
import { fold, pieces, sameWord } from "./tokens";

export const words = pieces;
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5);

/** Hides about `ratio` of the words (preferring words of 3+ letters). Returns the hidden word indexes; at least one. */
export function pickBlanks(text: string, ratio: number): Set<number> {
  const w = words(text);
  const real = w.map((x, i) => ({ x, i })).filter(({ x }) => /[\p{L}\p{N}]/u.test(x));
  const long = real.filter(({ x }) => fold(x).replace(/'/g, "").length >= 3);
  const n = Math.max(1, Math.round(real.length * ratio));
  const pool = [...shuffle(long), ...shuffle(real.filter((r) => !long.includes(r)))];
  return new Set(pool.slice(0, n).map((c) => c.i));
}

/** "Car Dieu a tant aimé" -> "C D a t a" */
export const firstLetters = (text: string) => words(text).map((w) => w.replace(/^[^\p{L}\p{N}]*/u, "")[0]).filter(Boolean).join(" ");

/** Automatic phrase chunks (kept for older callers; the learn flow uses chunksFor in ./chunks). */
export const chunks = (text: string) => autoChunks(text);

/** Comparable tokens of a text, each tagged with the index of its whitespace word. Punctuation-only tokens drop out; "l'homme" = "l homme". */
function tokens(text: string) {
  return words(text).flatMap((w, owner) => fold(w).replace(/'/g, " ").split(" ").filter(Boolean).map((t) => ({ t, owner })));
}

/**
 * Word-by-word comparison via longest common subsequence. Lenient: case, accents, punctuation, œ/oe and one slip
 * in a word of 5+ letters never count against you.
 */
export function gradeRecall(input: string, expected: string) {
  const a = tokens(input).map((x) => x.t);
  const e = tokens(expected);
  const en = e.map((x) => x.t);
  const eq = (i: number, j: number) => en[i] === a[j] || sameWord(a[j], en[i]);
  const L = Array.from({ length: en.length + 1 }, () => Array<number>(a.length + 1).fill(0));
  for (let i = en.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      L[i][j] = eq(i, j) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Set<number>();
  for (let i = 0, j = 0; i < en.length && j < a.length; ) {
    if (eq(i, j) && L[i][j] === L[i + 1][j + 1] + 1) { hit.add(i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  const bad = new Set(e.filter((_, i) => !hit.has(i)).map((x) => x.owner));
  return { marks: words(expected).map((word, i) => ({ word, ok: !bad.has(i) })), score: en.length ? hit.size / en.length : 0 };
}

export const PASS = 0.9;
