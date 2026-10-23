/** Exact matches against the curated phrases of the French course: instant, free and exact. Pure. */
import { normalizeTranscript } from "./hallucination";

type Phrase = { fr: string; en: string; tu?: string };
type Unit = { lessons?: { phrases?: Phrase[] }[] };
export type Phrasebook = { toEn: Map<string, string>; toFr: Map<string, string> };

// Glosses like "(informal)" or alternatives with "/" are notes, not sentences to speak.
const NOTE = /[(/…+[=]|\.\.\./;

export function buildPhrasebook(units: Unit[]): Phrasebook {
  const toEn = new Map<string, string | null>();
  const toFr = new Map<string, string | null>();
  const put = (m: Map<string, string | null>, key: string, value: string) => {
    if (key.length < 2) return;
    const old = m.get(key);
    m.set(key, old === undefined || old === value ? value : null); // two different answers: ambiguous, skip
  };
  for (const u of units) for (const l of u.lessons ?? []) for (const p of l.phrases ?? []) {
    if (!p.fr || !p.en || NOTE.test(p.fr) || NOTE.test(p.en)) continue;
    put(toEn, normalizeTranscript(p.fr), p.en);
    if (p.tu && !NOTE.test(p.tu)) put(toEn, normalizeTranscript(p.tu), p.en);
    put(toFr, normalizeTranscript(p.en), p.fr); // always the vous form
  }
  const clean = (m: Map<string, string | null>) => new Map([...m].filter((e): e is [string, string] => e[1] !== null));
  return { toEn: clean(toEn), toFr: clean(toFr) };
}

/** The curated translation when the whole sentence matches a course phrase, else null. */
export function lookupPhrase(book: Phrasebook, text: string, target: "FR" | "EN-US"): string | null {
  const key = normalizeTranscript(text);
  return (target === "FR" ? book.toFr : book.toEn).get(key) ?? null;
}
