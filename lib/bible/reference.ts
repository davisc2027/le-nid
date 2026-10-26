import { bookByCode, findBook } from "./books";

export type Ref = { code: string; chapter: number; from: number; to: number };

/** Parses "Jean 3:16", "Jean 3:16-17", "1 Jean 4:7-8", "John 3.16". Returns null when it does not parse. */
export function parseRef(input: string): Ref | null {
  const m = input.trim().match(/^(.+?)\s+(\d+)\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const from = Number(m[3]);
  const to = m[4] ? Number(m[4]) : from;
  if (to < from || to - from > 6) return null;
  return { code: book.code, chapter: Number(m[2]), from, to };
}

/** Canonical key stored in the database, e.g. "JHN 3:16-17". */
export const refKey = (r: Ref) => `${r.code} ${r.chapter}:${r.from}${r.to > r.from ? `-${r.to}` : ""}`;

export function keyToRef(key: string): Ref | null {
  const m = key.match(/^(\w{3}) (\d+):(\d+)(?:-(\d+))?$/);
  return m ? { code: m[1], chapter: Number(m[2]), from: Number(m[3]), to: Number(m[4] ?? m[3]) } : null;
}

/** French display label, e.g. "Jean 3:16-17". */
export function refLabel(key: string) {
  const r = keyToRef(key);
  const b = r && bookByCode(r.code);
  return r && b ? `${b.fr} ${r.chapter}:${r.from}${r.to > r.from ? `-${r.to}` : ""}` : key;
}

/** English display label, e.g. "John 3:16-17". */
export function refLabelEn(key: string) {
  const r = keyToRef(key);
  const b = r && bookByCode(r.code);
  return r && b ? `${b.en} ${r.chapter}:${r.from}${r.to > r.from ? `-${r.to}` : ""}` : key;
}
