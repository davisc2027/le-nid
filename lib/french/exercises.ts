import { ALL_PHRASES, type Lesson, type Phrase } from "./content";

export type Exercise =
  | { kind: "choose"; fr: string; choices: string[]; answer: string }
  | { kind: "bank"; en: string; fr: string; tokens: string[] }
  | { kind: "listen"; fr: string }
  | { kind: "match"; pairs: Phrase[] };

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

/** Builds one lesson: a matching round, then choose, word-bank, and listening rounds. */
export function buildLesson(lesson: Lesson): Exercise[] {
  const { phrases } = lesson;
  const others = ALL_PHRASES.filter((p) => !phrases.includes(p));
  const choose = shuffle(phrases).map<Exercise>((p) => ({
    kind: "choose", fr: p.fr, answer: p.en,
    choices: shuffle([p.en, ...shuffle(others).slice(0, 3).map((o) => o.en)]),
  }));
  const bank = shuffle(phrases).map<Exercise>((p) => {
    const words = tokenize(p.fr);
    const extras = shuffle(others.flatMap((o) => tokenize(o.fr))).filter((w) => !words.includes(w)).slice(0, 2);
    return { kind: "bank", en: p.en, fr: p.fr, tokens: shuffle([...words, ...extras]) };
  });
  const listen = shuffle(phrases).map<Exercise>((p) => ({ kind: "listen", fr: p.fr }));
  return [{ kind: "match", pairs: shuffle(phrases).slice(0, 5) }, ...choose, ...bank, ...listen];
}
