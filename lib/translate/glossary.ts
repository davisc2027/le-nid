/**
 * Team glossary (content/talk/glossary.json): faith terms and local names. DeepL gets it as two glossaries
 * (scripts/sync-deepl-glossary.mjs); the Groq fallback gets the entries that occur in the sentence. Pure.
 */

export type GlossaryEntry = {
  en: string;
  fr: string;
  /** "both" (default), "en-fr" or "fr-en". */
  dir?: "both" | "en-fr" | "fr-en";
  capVariant?: boolean;
  reviewed?: boolean;
  question?: string;
};
export type GlossaryDirection = "en-fr" | "fr-en";
export type GlossaryPair = { from: string; to: string };

/** The term pairs for one direction. */
export function pairsFor(entries: GlossaryEntry[], direction: GlossaryDirection): GlossaryPair[] {
  const out: GlossaryPair[] = [];
  for (const e of entries) {
    const dir = e.dir ?? "both";
    if (dir !== "both" && dir !== direction) continue;
    const from = (direction === "en-fr" ? e.en : e.fr).trim();
    const to = (direction === "en-fr" ? e.fr : e.en).trim();
    if (from && to) out.push({ from, to });
  }
  return out;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’]/g, "'");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pairs whose source term occurs in the text (case and accent insensitive, whole words, simple plural). */
export function selectForText(entries: GlossaryEntry[], direction: GlossaryDirection, text: string, max = 12): GlossaryPair[] {
  const hay = fold(text);
  const seen = new Set<string>();
  const out: GlossaryPair[] = [];
  for (const p of pairsFor(entries, direction)) {
    const key = fold(p.from);
    if (seen.has(key)) continue;
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(key)}(?:s|x)?(?![\\p{L}\\p{N}])`, "u");
    if (re.test(hay)) { seen.add(key); out.push(p); if (out.length >= max) break; }
  }
  return out;
}

export function formatPairs(pairs: GlossaryPair[]): string {
  return pairs.map((p) => `- "${p.from}" -> "${p.to}"`).join("\n");
}
