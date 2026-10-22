import { keyToRef } from "./reference";

type BookData = string[][];
const cache = new Map<string, Promise<BookData | null>>();

function book(lang: "fr" | "en", code: string) {
  const k = `${lang}/${code}`;
  if (!cache.has(k))
    cache.set(k, fetch(`/bible/${lang}/${code}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  return cache.get(k)!;
}

/** Verse text for a key like "JHN 3:16-17". `en` is null when the English file is missing. */
export async function loadVerse(key: string): Promise<{ fr: string; en: string | null } | null> {
  const r = keyToRef(key);
  if (!r) return null;
  const pick = (b: BookData | null) => {
    const verses = b?.[r.chapter - 1]?.slice(r.from - 1, r.to);
    return verses && verses.length === r.to - r.from + 1 && verses.every(Boolean) ? verses.join(" ") : null;
  };
  const [fr, en] = await Promise.all([book("fr", r.code), book("en", r.code)]);
  const frText = pick(fr);
  return frText ? { fr: frText, en: pick(en) } : null;
}
