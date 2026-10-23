/** Language helpers for Conversation mode. Whisper may answer "fr", "french" or "French". */

export type Side = "en" | "fr";
export type DeepLTarget = "FR" | "EN-US";

const NAMES: Record<string, string> = { english: "en", french: "fr", francais: "fr", "français": "fr" };

/** Two-letter lowercase code ("fr", "en", "de"...), or "" when unknown. */
export function normalizeLang(lang: unknown): string {
  if (typeof lang !== "string") return "";
  const l = lang.trim().toLowerCase();
  if (!l) return "";
  if (NAMES[l]) return NAMES[l];
  const code = l.split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? code : "";
}

/** French is translated to English; anything else (English, or a misdetected language) is translated to French. */
export function targetFor(lang: unknown): DeepLTarget {
  return normalizeLang(lang) === "fr" ? "EN-US" : "FR";
}

/** Which side of the conversation spoke: the French speaker or the English speaker. */
export function sideFor(lang: unknown): Side {
  return normalizeLang(lang) === "fr" ? "fr" : "en";
}

export const targetForSide = (side: Side): DeepLTarget => (side === "fr" ? "EN-US" : "FR");
export const otherSide = (side: Side): Side => (side === "fr" ? "en" : "fr");
export const isSide = (v: unknown): v is Side => v === "en" || v === "fr";

// ----- text-based English / French check (free, no network) -----
// Function words that are clearly one language. Words that exist in both (a, on, me, son, plus, as, an, no, pain...)
// are left out on purpose, so a "hit" is a real signal.

const EN_WORDS = new Set((
  "the and is are was were be been being am i you he she it we they my your his her its our their him them this that these those " +
  "what who whom whose which where when why how with without from for of to in at by about into over under before after " +
  "have has had having do does did done will would can could should shall may might must not don't doesn't didn't isn't aren't wasn't " +
  "yes please thanks thank hello hi hey sorry okay great good very really just also but because if then than so too here there " +
  "some any all every each many much more most other another only own same such like want need know think see say said tell " +
  "going go come get got make made take let look give find call work help love pray church bible god jesus lord friend friends " +
  "today tomorrow yesterday tonight morning evening time day week year people person where's what's how's i'm you're we're they're " +
  "it's that's there's i'll i've i'd you'll we'll"
).split(/\s+/));

const FR_WORDS = new Set((
  "le la les un une des du de et est sont était étaient être suis es sommes êtes je tu il elle nous vous ils elles mon ma mes " +
  "ton ta tes sa ses notre nos votre vos leur leurs ce cet cette ces qui que quoi dont où quand comment pourquoi combien " +
  "avec sans pour par dans sur sous chez vers entre avant après depuis pendant à au aux en y ne pas jamais rien personne " +
  "aucun oui non merci bonjour bonsoir salut beaucoup très bien mal aussi mais parce car donc alors si comme ou ni " +
  "ai avons avez ont avait aura aurait fait faire fais faites vais vas va allons allez vont peux peut pouvez veux veut voulez " +
  "dois doit devez sais sait savez voudrais pourriez pourrais s'il t'es c'est j'ai ça cela ceci voici voilà " +
  "tout tous toute toutes autre autres même chaque quelque quelques peu trop assez déjà encore toujours souvent " +
  "aujourd'hui demain hier ce soir matin soir temps jour semaine année gens personne ami amis amie église dieu seigneur prier prière " +
  "désolé bienvenue enchanté excusez pardon"
).split(/\s+/));

const EN_CONTRACTION_TAIL = new Set(["s", "re", "ll", "ve", "m", "d", "t"]);
const FR_ELIDED_HEAD = new Set(["l", "j", "qu", "d", "n", "s", "c", "m", "t"]);
const FR_DIACRITICS = /[éèêëàâçùûîïôœü]/g;

export type TextLanguage = {
  lang: Side | "";
  /** Winning margin in hits (diacritics and elisions count). 0 when undecided. */
  score: number;
  en: number;
  fr: number;
  words: number;
  /** Clear enough to overrule Whisper's own language label. */
  strong: boolean;
};

/**
 * Scores how English or French a text looks. Short or neutral text ("OK", names) is "" with score 0: callers keep
 * Whisper's label in that case.
 */
export function textLanguage(text: string): TextLanguage {
  const lower = text.toLowerCase().replace(/[‘’`´]/g, "'");
  const tokens = lower.match(/[\p{L}]+(?:'[\p{L}]+)*/gu) ?? [];
  let en = 0, fr = 0;
  for (const tok of tokens) {
    const parts = tok.split("'");
    if (parts.length > 1) {
      // Elision "l'église", "j'ai", "qu'il": French. Contraction "don't", "I'm", "they're": English.
      const head = parts[0], tail = parts[parts.length - 1];
      if (FR_ELIDED_HEAD.has(head)) { fr += 1; continue; }
      if (EN_CONTRACTION_TAIL.has(tail)) { en += 1; continue; }
    }
    if (EN_WORDS.has(tok)) en += 1;
    else if (FR_WORDS.has(tok)) fr += 1;
    else if (parts.length > 1) { if (EN_WORDS.has(parts[0])) en += 1; else if (FR_WORDS.has(parts[0])) fr += 1; }
  }
  fr += (lower.match(FR_DIACRITICS)?.length ?? 0) * 0.75;
  const words = tokens.length;
  const margin = Math.abs(en - fr);
  const lang: Side | "" = margin < 0.75 ? "" : en > fr ? "en" : "fr";
  const strong = lang !== "" && (margin >= 2 || (words <= 3 && margin >= 1 && margin / Math.max(1, words) >= 0.5));
  return { lang, score: lang ? margin : 0, en, fr, words, strong };
}

export type SideResolution = { side: Side; source: "whisper" | "text" | "default"; text: TextLanguage };

/**
 * Which side spoke, from Whisper's language label and the transcript itself.
 *  - Whisper says en/fr and the text agrees or is unsure: keep Whisper.
 *  - They disagree and the text is clear: believe the text (Whisper sometimes labels one language and writes another).
 *  - Whisper says something else (de, nl, "" ...): use the text; with nothing to go on, English (the old behaviour).
 */
export function resolveSideDetail(whisperLang: unknown, text: string): SideResolution {
  const w = normalizeLang(whisperLang);
  const t = textLanguage(text);
  if (w === "en" || w === "fr") {
    if (t.lang && t.lang !== w && t.strong) return { side: t.lang, source: "text", text: t };
    return { side: w, source: "whisper", text: t };
  }
  if (t.lang) return { side: t.lang, source: "text", text: t };
  return { side: "en", source: "default", text: t };
}

export const resolveSide = (whisperLang: unknown, text: string): Side => resolveSideDetail(whisperLang, text).side;
