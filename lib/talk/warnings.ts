/**
 * Cheap sanity checks on a translation (server side, after the provider answered). A flagged turn gets a small
 * "may be off" chip in the app, with a "Check meaning" action (back-translation). Pure.
 */
import { textLanguage } from "./lang";

export type TranslationWarning = "length" | "negation" | "numbers" | "language";

const EN_NEG = /\b(not|never|no|nobody|nothing|none|neither|nor|cannot|without)\b|n['’]t\b/i;
const FR_NEG = /\b(ne|non|pas|jamais|rien|personne|aucun|aucune|nulle part|sans)\b|\b[nN]['’]/i;

const digitRuns = (s: string) => (s.match(/\d+/g) ?? []).sort();

export function translationWarnings(input: string, output: string, target: "FR" | "EN-US"): TranslationWarning[] {
  const out: TranslationWarning[] = [];
  const inp = input.trim(), res = output.trim();
  if (!inp || !res) return out;

  // 1. Length: French usually runs 10-30% longer than English; far outside 0.5x..2.2x means something was lost or added.
  if (inp.length > 20) {
    const ratio = res.length / inp.length;
    if (ratio < 0.5 || ratio > 2.2) out.push("length");
  }

  // 2. Negation present on one side only ("Je n'ai pas le temps" must not become "I have time").
  const [en, fr] = target === "FR" ? [inp, res] : [res, inp];
  if (EN_NEG.test(en) !== FR_NEG.test(fr)) out.push("negation");

  // 3. Digits must survive (Bible references, times, prices). Clock times change digits (3 pm = 15 h): skip those.
  const clock = /\b[ap]\.?m\.?\b/i.test(en) || /\d\s*h(\s*\d{2})?\b/i.test(fr);
  if (!clock) {
    const a = digitRuns(inp), b = digitRuns(res);
    if (a.length !== b.length || a.some((d, i) => d !== b[i])) out.push("numbers");
  }

  // 4. The output must be in the target language and not just the input handed back.
  const t = textLanguage(res);
  const wrong = t.strong && t.lang === (target === "FR" ? "en" : "fr");
  const unchanged = inp.length > 12 && inp.toLowerCase() === res.toLowerCase();
  if (wrong || unchanged) out.push("language");
  return out;
}

export const WARNING_TEXT: Record<TranslationWarning, string> = {
  length: "The translation is much shorter or longer than the original.",
  negation: "A \"not\" or \"no\" may have been lost or added.",
  numbers: "A number may not match.",
  language: "The translation may be in the wrong language.",
};
