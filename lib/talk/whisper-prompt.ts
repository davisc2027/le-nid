/**
 * Builds the optional Whisper `prompt` (vocabulary hints) and guards against Whisper echoing it back.
 * Pure: the prompt texts come from content/talk/prompts.json and are passed in.
 */

export type PromptBook = { fr: string; en: string; auto: string };
export const MAX_CONTEXT_CHARS = 120;

/** The last ~120 characters of the previous same-language sentence, cut at a word boundary. */
export function trimContext(context: unknown): string {
  if (typeof context !== "string") return "";
  const c = context.replace(/\s+/g, " ").trim();
  if (c.length <= MAX_CONTEXT_CHARS) return c;
  const tail = c.slice(-MAX_CONTEXT_CHARS);
  const sp = tail.indexOf(" ");
  return sp > 0 && sp < 30 ? tail.slice(sp + 1) : tail;
}

/**
 * Forced language: that language's word list, then the previous turn in the same language (it is the text right
 * before the new audio). Auto-detect: only neutral names, and never the other language's text (it invites translation).
 */
export function buildWhisperPrompt(book: PromptBook, lang: "en" | "fr" | "", context?: string): string {
  if (lang === "") return book.auto.trim();
  const ctx = trimContext(context);
  return [book[lang].trim(), ctx].filter(Boolean).join(" ");
}

const words = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);

/** Whisper sometimes returns the prompt (or a chunk of it) for silence or noise. */
export function isPromptEcho(transcript: string, prompt: string, clip: { durationSec?: number; peakRms?: number } = {}): boolean {
  const t = words(transcript), p = words(prompt);
  if (t.length < 3 || !p.length) return false;
  // 1. A contiguous copy of six or more prompt words.
  const N = 6;
  if (t.length >= N) {
    const pj = ` ${p.join(" ")} `;
    for (let i = 0; i + N <= t.length; i++) if (pj.includes(` ${t.slice(i, i + N).join(" ")} `)) return true;
  }
  // 2. Mostly words that only the prompt would explain, from a short or quiet clip.
  const rare = new Set(p.filter((w) => w.length >= 5));
  const inPrompt = t.filter((w) => rare.has(w)).length;
  const shortOrQuiet = (clip.durationSec !== undefined && clip.durationSec < 2) || (clip.peakRms !== undefined && clip.peakRms < 0.045);
  return shortOrQuiet && inPrompt / t.length >= 0.6;
}
