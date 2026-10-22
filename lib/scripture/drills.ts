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
export const firstLetters = (text: string) => words(text).map((w) => w.replace(/^[^\p{L}\p{N}]*/u, "")[0] ?? w[0]).join(" ");

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

/** Word-by-word comparison via longest common subsequence. Lenient on accents and case. */
export function gradeRecall(input: string, expected: string) {
  const a = words(input).map(normalize), e = words(expected);
  const en = e.map(normalize);
  const L = Array.from({ length: en.length + 1 }, () => Array<number>(a.length + 1).fill(0));
  for (let i = en.length - 1; i >= 0; i--)
    for (let j = a.length - 1; j >= 0; j--)
      L[i][j] = en[i] === a[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Set<number>();
  for (let i = 0, j = 0; i < en.length && j < a.length; ) {
    if (en[i] === a[j]) { hit.add(i); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return { marks: e.map((word, i) => ({ word, ok: hit.has(i) })), score: en.length ? hit.size / en.length : 0 };
}

export const PASS = 0.9;
