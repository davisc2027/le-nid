import { ALL_LESSONS, ALL_PHRASES, type Lesson, type Phrase } from "./content";

/** `key` is the phrase key (see phraseKey); `review` marks an exercise drawn from an earlier lesson. */
export type Exercise =
  | { kind: "choose"; fr: string; choices: string[]; answer: string; note?: string; key?: string; review?: boolean }
  | { kind: "bank"; en: string; fr: string; tokens: string[]; key?: string; review?: boolean }
  | { kind: "listen"; fr: string; key?: string; review?: boolean }
  | { kind: "match"; pairs: Phrase[]; key?: undefined; review?: undefined };

/** A saved spaced-repetition card (public.vocab_cards row, minus the user). */
export type StoredCard = { state: Record<string, unknown>; due: string; last_review?: string | null };
export type CardMap = Record<string, StoredCard>;

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

/** French words as tiles; a space before ? ! : ; is kept attached to the previous word. */
export const tokenize = (fr: string) => fr.replace(/ ([?!:;])/g, " $1").split(" ");

/** Lenient comparison: ignores case, accents, punctuation, and one typo. */
export const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function isCorrect(given: string, expected: string) {
  const g = normalize(given), e = normalize(expected);
  return g === e || (e.length > 6 && distance(g, e) <= 1);
}

/** Stable key for a phrase in vocab_cards: the normalized French, max 120 characters. */
export const phraseKey = (fr: string) => normalize(fr).slice(0, 120).trim();

export const PHRASE_BY_KEY: Map<string, Phrase> = new Map(ALL_PHRASES.map((p) => [phraseKey(p.fr), p]));

const mkChoose = (p: Phrase, others: Phrase[]): Exercise => ({
  kind: "choose", fr: p.fr, answer: p.en, note: p.note, key: phraseKey(p.fr),
  choices: shuffle([p.en, ...shuffle(others).slice(0, 3).map((o) => o.en)]),
});
const mkBank = (p: Phrase, others: Phrase[]): Exercise => {
  const words = tokenize(p.fr);
  const extras = shuffle(others.flatMap((o) => tokenize(o.fr))).filter((w) => !words.includes(w)).slice(0, 2);
  return { kind: "bank", en: p.en, fr: p.fr, key: phraseKey(p.fr), tokens: shuffle([...words, ...extras]) };
};
const mkListen = (p: Phrase): Exercise => ({ kind: "listen", fr: p.fr, key: phraseKey(p.fr) });
const distractors = (p: Phrase) => ALL_PHRASES.filter((o) => o.en !== p.en && o.fr !== p.fr);

/** Builds one lesson: a matching round, then choose, word-bank, and listening rounds. */
export function buildLesson(lesson: Lesson): Exercise[] {
  const { phrases } = lesson;
  const others = ALL_PHRASES.filter((p) => !phrases.includes(p));
  const choose = shuffle(phrases).map((p) => mkChoose(p, others));
  const bank = shuffle(phrases).map((p) => mkBank(p, others));
  const listen = shuffle(phrases).map(mkListen);
  return [{ kind: "match", pairs: shuffle(phrases).slice(0, 5) }, ...choose, ...bank, ...listen];
}

const REVIEW_KINDS = ["choose", "bank", "listen", "choose"] as const;

/**
 * Picks up to `n` phrases from completed lessons (never the current one) to review: cards that are due first
 * (oldest due first), then phrases missed before (lapses > 0), then random ones.
 */
export function pickReviewPhrases(
  completed: string[], currentId: string | undefined, cards: CardMap | null, n = 4, now = new Date(),
): Phrase[] {
  const done = new Set(completed);
  const seen = new Set<string>();
  const pool: { p: Phrase; key: string }[] = [];
  for (const l of ALL_LESSONS) {
    if (!done.has(l.id) || l.id === currentId) continue;
    for (const p of l.phrases) {
      const key = phraseKey(p.fr);
      if (!seen.has(key)) { seen.add(key); pool.push({ p, key }); }
    }
  }
  // phrases of the lesson being played are excluded even when an earlier lesson repeats them
  const current = ALL_LESSONS.find((l) => l.id === currentId);
  const own = new Set(current?.phrases.map((p) => phraseKey(p.fr)));
  const usable = pool.filter((x) => !own.has(x.key));
  const due = usable.filter((x) => cards?.[x.key] && new Date(cards[x.key].due) <= now)
    .sort((a, b) => +new Date(cards![a.key].due) - +new Date(cards![b.key].due));
  const dueKeys = new Set(due.map((x) => x.key));
  const missed = shuffle(usable.filter((x) => !dueKeys.has(x.key) && Number(cards?.[x.key]?.state?.lapses ?? 0) > 0));
  const taken = new Set([...dueKeys, ...missed.map((x) => x.key)]);
  const rest = shuffle(usable.filter((x) => !taken.has(x.key)));
  return [...due, ...missed, ...rest].slice(0, n).map((x) => x.p);
}

/** Review exercises for phrases from earlier lessons: mixed types (choose, word-bank, listen), flagged `review`. */
export function buildReview(phrases: Phrase[]): Exercise[] {
  return shuffle(phrases).map((p, i) => {
    const kind = REVIEW_KINDS[i % REVIEW_KINDS.length];
    const ex = kind === "choose" ? mkChoose(p, distractors(p)) : kind === "bank" ? mkBank(p, distractors(p)) : mkListen(p);
    return { ...ex, review: true } as Exercise;
  });
}

/** A practice session: one random exercise (choose / word-bank / listen) per phrase, in the order given. */
export function buildPractice(phrases: Phrase[]): Exercise[] {
  const kinds = ["choose", "bank", "listen"] as const;
  return phrases.map((p) => {
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    return kind === "choose" ? mkChoose(p, distractors(p)) : kind === "bank" ? mkBank(p, distractors(p)) : mkListen(p);
  });
}

/**
 * Chooses the phrase keys for a practice session: due cards first (by due date), then, only when something is due,
 * the least recently reviewed learned phrases. Returns [] when nothing is due.
 */
export function pickPracticeKeys(
  rows: { key: string; due: string; last_review?: string | null }[], now = new Date(), n = 10,
): string[] {
  const known = rows.filter((r) => PHRASE_BY_KEY.has(r.key));
  const due = known.filter((r) => new Date(r.due) <= now).sort((a, b) => +new Date(a.due) - +new Date(b.due));
  if (!due.length) return [];
  const dueKeys = new Set(due.map((r) => r.key));
  const t = (r: { last_review?: string | null }) => (r.last_review ? +new Date(r.last_review) : 0);
  const rest = known.filter((r) => !dueKeys.has(r.key)).sort((a, b) => t(a) - t(b));
  return [...due, ...rest].slice(0, n).map((r) => r.key);
}
