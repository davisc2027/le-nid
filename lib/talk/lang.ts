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
