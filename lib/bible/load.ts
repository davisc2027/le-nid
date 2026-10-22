import { keyToRef } from "./reference";

type BookData = string[][];
const cache = new Map<string, Promise<BookData | null>>();

function book(lang: "fr" | "en", code: string) {
  const k = `${lang}/${code}`;
  if (!cache.has(k)) {
    const p = fetch(`/bible/${lang}/${code}.json`).then((r) => (r.ok ? (r.json() as Promise<BookData>) : null)).catch(() => null);
    cache.set(k, p);
    p.then((b) => { if (!b) cache.delete(k); }); // do not cache failures, so a retry can succeed
  }
  return cache.get(k)!;
}

/** True when the French Bible JSON has been installed (checks John, always present in the build). */
export async function bibleInstalled() {
  return (await book("fr", "JHN")) !== null;
}

/** "=" marks a verse merged into the previous one (USFM bridge like \v 1-2). */
function pick(b: BookData | null, r: { chapter: number; from: number; to: number }) {
  const ch = b?.[r.chapter - 1];
  if (!ch) return null;
  const parts: string[] = [];
  for (let n = r.from; n <= r.to; n++) {
    let k = n - 1;
    if (ch[k] === "=") {
      if (n > r.from) continue; // already included with its head verse
      while (k > 0 && ch[k] === "=") k--;
    }
    if (!ch[k] || ch[k] === "=") return null;
    parts.push(ch[k]);
  }
  return parts.length ? parts.join(" ") : null;
}

/** Verse text for a key like "JHN 3:16-17". `en` is null when the English file is missing. */
export async function loadVerse(key: string): Promise<{ fr: string; en: string | null } | null> {
  const r = keyToRef(key);
  if (!r) return null;
  const [fr, en] = await Promise.all([book("fr", r.code), book("en", r.code)]);
  const frText = pick(fr, r);
  return frText ? { fr: frText, en: pick(en, r) } : null;
}
