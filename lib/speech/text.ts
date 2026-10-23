/**
 * Pure text helpers for speaking practice: words, a heuristic syllable count, expected clip length, sound tags and
 * the "does this question rise" rule. See docs/speaking-build-spec.md sections 3 and 6.2.
 */
import { normalize } from "../french/exercises";

export type SoundTag = "u" | "r" | "nasal" | "eu" | "oi" | "liaison" | "question";

/** Alsatian words the device French voice mispronounces. */
export const BLOCKED_WORDS = ["winstub", "bredele", "bretzel"];

const VOWELS = "aeiouyàâäéèêëîïôöùûüœæ";
const VOWEL_GROUPS = new RegExp(`[${VOWELS}]+`, "g");
const MUTE_E = new RegExp(`[^${VOWELS}]es?$`);
const WORD_SPLIT = /[\s'’-]+/;

/** Lowercase words of a phrase, punctuation removed. */
export function speechWords(fr: string): string[] {
  return fr.toLowerCase().replace(/[?!.,:;«»"…]/g, " ").split(WORD_SPLIT).filter(Boolean);
}

/** Words that contain a letter, the same count as the exercise engine uses. */
export const nWords = (fr: string): number => fr.split(/\s+/).filter((t) => /\p{L}/u.test(t)).length;

const simplify = (w: string) => w.replace(/qu/g, "q").replace(/gu(?=[eiéèêy])/g, "g");

/** Heuristic syllable count (mute e and the -ent of ils/elles verbs dropped). At least 1. */
export function syllables(fr: string): number {
  const words = speechWords(fr);
  let sum = 0;
  words.forEach((w, i) => {
    const s = simplify(w);
    let n = (s.match(VOWEL_GROUPS) ?? []).length;
    if (n > 1 && MUTE_E.test(s)) n -= 1;
    else if (n > 1 && s.endsWith("ent") && (words[i - 1] === "ils" || words[i - 1] === "elles")) n -= 1;
    sum += n;
  });
  return Math.max(1, sum);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Generous expected clip length for a phrase of `syl` syllables, and the recorder's hard stop. */
export function durationRange(syl: number): { minSec: number; maxSec: number; capSec: number } {
  const minSec = Math.max(0.15, 0.08 * syl);
  const maxSec = 1.2 + 0.6 * syl;
  const capSec = Math.min(10, Math.max(5, maxSec + 2));
  return { minSec: round2(minSec), maxSec: round2(maxSec), capSec: round2(capSec) };
}

export function speakable(fr: string, maxWords: number, maxSyl: number): boolean {
  if (/\d/.test(fr)) return false;
  const words = speechWords(fr);
  if (words.some((w) => BLOCKED_WORDS.includes(w))) return false;
  return nWords(fr) <= maxWords && syllables(fr) <= maxSyl;
}

// Words whose final consonant is pronounced.
const EXC = new Set((
  "christ ouest bus fils sens sud ours mars hélas huit sept net but stop gaz six dix contact direct correct plus zut foot " +
  "end cher mer fer hier fier hiver super enfer amer ver"
).split(" "));

const VOWEL_START = new RegExp(`^[${VOWELS}h]`);
const WH = new Set(["que", "qu", "quel", "quelle", "quels", "quelles", "qui", "quoi", "quand", "comment", "combien", "pourquoi", "lequel", "laquelle"]);

/** True for yes/no questions where the voice should rise (intonation questions and est-ce que). */
export function isRiseQuestion(fr: string): boolean {
  const t = fr.trim();
  if (!t.endsWith("?")) return false;
  if (/(^|[^\p{L}])où($|[^\p{L}])/iu.test(t)) return false;
  if (/-(vous|nous|il|elle|ils|elles|je|tu|on|t-il|t-elle)\b/i.test(t)) return false;
  const rest = normalize(t).replace(/\best ce qu(e)?\b/g, " ");
  return !rest.split(" ").some((w) => WH.has(w));
}

/** Which sounds a phrase practises. */
export function soundTags(fr: string): SoundTag[] {
  const tags = new Set<SoundTag>();
  const lower = fr.toLowerCase();
  for (const chunk of lower.split(/[,;:.!?«»"…]+/)) {
    const words = chunk.split(WORD_SPLIT).filter(Boolean);
    words.forEach((w, i) => {
      if (w === "monsieur" || w === "messieurs") return;
      const s = simplify(w);
      const prev = words[i - 1];
      const rs = s.length >= 4 && !EXC.has(w) ? s.replace(/er$/, "e") : s;
      if (rs.includes("r")) tags.add("r");
      if (/o[uùû]/.test(s)) tags.add("u");
      else {
        const rest = s.replace(new RegExp(`[uû](?=[nm](?![${VOWELS}nm]))`, "g"), "").replace(/o[uùû]|e[uû]|œu?/g, "");
        if (/(^|[^oaeq])[uûü]/.test(rest)) tags.add("u");
      }
      if (/e[uû]|œ/.test(s) && w !== "eu") tags.add("eu");
      const ent = w.endsWith("ent") && (prev === "ils" || prev === "elles");
      if (!ent && new RegExp(`[aeiouyéè][nm](?![${VOWELS}hnm])`).test(s)) tags.add("nasal");
      if (/o[iîy]/.test(s)) tags.add("oi");
      if (!EXC.has(w)) {
        const next = words[i + 1];
        if (
          (w.length >= 3 && /[tdsxzp]$/.test(w)) ||
          (w.length >= 4 && /(er|ez)$/.test(w)) ||
          (next && VOWEL_START.test(next) && /[sxztdn]$/.test(w))
        ) tags.add("liaison");
      }
    });
  }
  if (lower.includes("il y a")) tags.add("liaison");
  if (isRiseQuestion(fr)) tags.add("question");
  return [...tags];
}
