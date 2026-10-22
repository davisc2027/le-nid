import { ALL_LESSONS, ALL_PHRASES, type Lesson, type Phrase } from "./content";
import { FAMILY_NOTE, familyOf, GLOSS, siblings, SUBJECTS, TU_WORDS } from "./lexicon";

/** Wrong option -> one short reason, shown in the feedback card after a miss. */
export type Why = Record<string, string>;

type Base = { key?: string; review?: boolean; note?: string };
/**
 * `key` is the phrase key (see phraseKey); `review` marks an exercise drawn from an earlier lesson.
 * choose: read (or with audioOnly, hear) French, pick the meaning. hear: hear French, pick the written phrase.
 * pick: read English, pick the French. gap: pick the missing word. register: pick tu or vous for a situation.
 * bank: build the French from tiles. type: type the French for an English prompt. listen: type what you hear.
 * `hint` is revealed by a tap, or shown from the start when `hintOpen`.
 */
export type Exercise =
  | (Base & { kind: "choose"; fr: string; choices: string[]; answer: string; why?: Why; hint?: string; audioOnly?: boolean })
  | (Base & { kind: "hear"; fr: string; en: string; choices: string[]; answer: string; why?: Why; hint?: string })
  | (Base & { kind: "pick"; en: string; fr: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "gap"; en: string; fr: string; before: string; after: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "register"; en: string; fr: string; situation: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "bank"; en: string; fr: string; tokens: string[] })
  | (Base & { kind: "type"; en: string; fr: string; alt?: string; hint?: string; hintOpen?: boolean })
  | (Base & { kind: "listen"; fr: string })
  | { kind: "match"; pairs: Phrase[]; key?: undefined; review?: undefined; note?: undefined };
export type Kind = Exercise["kind"];

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
export const tokenize = (fr: string) => fr.replace(/ ([?!:;])/g, " $1").split(" ");

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

// ---------------------------------------------------------------------------------------------------------------
// Meaning guards and near misses

/**
 * Pairs whose glosses could both be right (Salut is also goodbye, Pardon is also excuse me). They are never offered
 * as wrong options for each other, and never share a matching round.
 */
export const SAME_MEANING: [string, string][] = [
  ["Salut", "Bonjour"], ["Salut", "Au revoir"], ["Salut", "Bonsoir"], ["Salut", "Bonjour, madame"], ["Salut", "À plus tard"],
  ["Bonsoir", "Au revoir"], ["Bonsoir", "Bonne soirée"], ["Au revoir", "À bientôt"], ["Au revoir", "À plus tard"],
  ["À bientôt", "À plus tard"], ["Ça va ?", "Comment allez-vous ?"], ["Pardon", "Excusez-moi"],
  ["Pardon", "Pouvez-vous répéter, s'il vous plaît ?"], ["Courage !", "Ne perdez pas espoir"],
  ["Prenez soin de vous", "Bonne continuation"], ["Bonne continuation", "Bonne chance !"], ["Merci", "Merci pour tout"],
  ["Oui", "D'accord"], ["Oui", "Bien sûr"], ["D'accord", "Bien sûr"],
];

/** Classic confusions, used as preferred wrong options, each with the reason shown after a miss. */
export const NEAR_MISS: [string, string, string][] = [
  ["Bonjour", "Bonsoir", "Bonjour is the daytime hello; bonsoir is for the evening."],
  ["Bonsoir", "Bonne nuit", "Bonne nuit is only for bedtime; bonsoir greets in the evening."],
  ["Bonne journée", "Bonne soirée", "Journée is the day, soirée the evening."],
  ["Bonne soirée", "Bonne nuit", "Bonne soirée wishes a good evening; bonne nuit is for bedtime."],
  ["Bonjour", "Bonne journée", "Bonjour says hello; bonne journée is a goodbye: have a good day."],
  ["À gauche", "À droite", "Gauche is left, droite is right."],
  ["Tout droit", "À droite", "Tout droit is straight ahead; à droite is to the right."],
  ["Merci", "De rien", "Merci says thank you; de rien answers it."],
  ["De rien", "Je vous en prie", "De rien is the casual reply; je vous en prie is the polite one."],
  ["Tu", "Vous", "Tu is for friends and children; vous is for strangers, older people and groups."],
  ["Je ne comprends pas", "Je ne sais pas", "Comprendre is to understand; savoir is to know."],
  ["Oui", "Non", "Oui is yes, non is no."],
  ["À demain", "À bientôt", "Demain is tomorrow; bientôt is soon."],
  ["Cent", "Cinq", "Cent is 100; cinq is 5."],
  ["Six", "Dix", "Six is 6, dix is 10."],
  ["Six", "Seize", "Six is 6, seize is 16."],
  ["Deux", "Douze", "Deux is 2, douze is 12."],
  ["Trois", "Trente", "Trois is 3, trente is 30."],
  ["Quatre", "Quarante", "Quatre is 4, quarante is 40."],
  ["Quatre", "Quatre-vingts", "Quatre is 4; quatre-vingts (four twenties) is 80."],
  ["Quinze", "Cinquante", "Quinze is 15, cinquante is 50."],
  ["Soixante", "Soixante-dix", "Soixante is 60; soixante-dix (sixty-ten) is 70."],
  ["J'ai vingt ans", "J'ai dix-neuf ans", "Vingt is 20, dix-neuf is 19."],
  ["Ça fait cinq euros", "Ça fait vingt euros", "Cinq is 5, vingt is 20."],
  ["Un café, s'il vous plaît", "Deux cafés, s'il vous plaît", "Un is one, deux is two."],
  ["Il fait froid", "Il fait chaud", "Chaud means hot, not cold: froid is cold."],
  ["Demain matin", "Hier soir", "Demain is tomorrow, hier is yesterday."],
  ["J'ai mal à la tête", "J'ai mal au ventre", "Tête is head, ventre is stomach."],
  ["Au secours !", "Au feu !", "Au secours is help; au feu is fire."],
  ["Tournez à gauche au feu", "Au feu !", "In directions au feu means at the traffic light; shouted alone it means fire."],
  ["Un aller simple pour Colmar, s'il vous plaît", "Un aller-retour pour Paris, s'il vous plaît", "Aller simple is one-way; aller-retour is a round trip."],
  ["Je joue de la guitare", "J'aime jouer au foot", "Jouer de is for instruments, jouer au for sports."],
  ["Je suis en retard", "Le train a du retard", "Je suis en retard is about you; le train a du retard is about the train."],
  ["Où sont les toilettes ?", "Je peux utiliser les toilettes ?", "One asks where they are; the other asks permission."],
  ["Pouvez-vous me montrer sur le plan ?", "La carte, s'il vous plaît", "A city map is un plan; la carte is the menu."],
  ["Vous avez de la monnaie ?", "En espèces", "Monnaie is change or coins; espèces is cash."],
  ["Quelle heure est-il ?", "À quelle heure part le train ?", "Quelle heure est-il asks the time now; à quelle heure asks when something happens."],
  ["Où est la gare ?", "Où est l'arrêt de tram ?", "La gare is the train station; l'arrêt is a tram stop."],
  ["Dieu vous aime", "Dieu est fidèle", "Aime is loves; fidèle is faithful."],
  ["Je pense à vous", "Je vais prier pour vous", "Penser à is to think of; prier pour is to pray for."],
  ["Ce week-end", "Bon week-end !", "Ce week-end is this weekend; bon week-end wishes someone a good one."],
];

const pairKey = (a: string, b: string) => (a < b ? a + "\u0000" + b : b + "\u0000" + a);
const SAME = new Set(SAME_MEANING.map(([a, b]) => pairKey(a, b)));
const NEAR = new Map(NEAR_MISS.map(([a, b, why]) => [pairKey(a, b), why]));

const enWords = new Map(ALL_PHRASES.map((p) => [p, new Set(normalize(p.en).split(" ").filter(Boolean))]));
const frWords = new Map(ALL_PHRASES.map((p) => [p, new Set(normalize(p.fr).split(" ").filter(Boolean))]));
const subset = (a: Set<string>, b: Set<string>) => [...a].every((w) => b.has(w));

/**
 * True when b must not be a wrong option for a (or share a matching round with it): same text, a listed
 * near-synonym, or one gloss contained in the other ("Thank you" inside "Thank you very much").
 */
export function blocked(a: Phrase, b: Phrase): boolean {
  if (a === b) return true;
  if (normalize(a.fr) === normalize(b.fr) || normalize(a.en) === normalize(b.en)) return true;
  if (SAME.has(pairKey(a.fr, b.fr))) return true;
  const A = enWords.get(a) ?? new Set(normalize(a.en).split(" ")), B = enWords.get(b) ?? new Set(normalize(b.en).split(" "));
  return subset(A, B) || subset(B, A);
}

// ---------------------------------------------------------------------------------------------------------------
// Where each phrase lives in the course

const HOME = new Map<Phrase, number>();
ALL_LESSONS.forEach((l, i) => l.phrases.forEach((p) => HOME.set(p, i)));
const BY_FR = new Map(ALL_PHRASES.map((p) => [p.fr, p]));
const BY_EN = new Map(ALL_PHRASES.map((p) => [p.en, p]));
const unitOf = (i: number) => ALL_LESSONS[i].id.split("-")[0];

/** 0 early (recognition-heavy), 1 middle, 2 late (production-heavy), by position in the course. */
export const stageOf = (lessonIndex: number): 0 | 1 | 2 => {
  const t = lessonIndex / Math.max(1, ALL_LESSONS.length - 1);
  return t < 0.3 ? 0 : t < 0.65 ? 1 : 2;
};

/** How familiar a phrase from lesson ci is when practicing lesson `anchor`: this lesson > this unit > recent > old > unseen. */
function locality(anchor: number, ci: number) {
  if (ci === anchor) return 4;
  const sameUnit = unitOf(ci) === unitOf(anchor);
  if (ci < anchor) return sameUnit ? 3 : 1 + 1.5 * Math.exp(-(anchor - ci) / 4);
  return sameUnit ? -1 : -5; // not met yet
}

// ---------------------------------------------------------------------------------------------------------------
// Distractor engine

type Side = "fr" | "en";
const endType = (s: string) => (/\?\s*$/.test(s) ? "?" : /!\s*$/.test(s) ? "!" : ".");
const jaccard = (a: Set<string>, b: Set<string>) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n / (a.size + b.size - n || 1);
};
const bigrams = (s: string) => {
  const t = normalize(s).replace(/ /g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
};
const nWords = (fr: string) => tokenize(fr).filter((t) => /\p{L}/u.test(t)).length;
const hasDigits = (s: string) => /\d/.test(s);
const hasVous = (p: Phrase) => frWords.get(p)?.has("vous") ?? false;

type PickOpts = { sound?: boolean; easy?: boolean };

/**
 * Scores a candidate wrong option. Hard mode rewards what makes a wrong option tempting: met recently, same
 * sentence type, shared words and structure, similar length, same register, digits with digits, similar sound
 * (listening), and listed near misses. Easy mode (warm-ups) stays inside the lesson but prefers contrast.
 */
function score(t: Phrase, c: Phrase, side: Side, anchor: number, o: PickOpts) {
  const loc = locality(anchor, HOME.get(c) ?? anchor + 1);
  let s = (endType(t[side]) === endType(c[side]) ? 3 : -3) + Math.random() * 1.5;
  const shared = jaccard(frWords.get(t)!, frWords.get(c)!);
  if (o.easy) return s + 2 * loc - 3 * shared;
  s += loc + 5 * shared + 2 * jaccard(enWords.get(t)!, enWords.get(c)!);
  s -= Math.min(4, 0.8 * Math.abs(nWords(t.fr) - nWords(c.fr)));
  if (hasVous(t) === hasVous(c)) s += 0.5;
  s += hasDigits(t.en) === hasDigits(c.en) ? (hasDigits(t.en) ? 4 : 0.5) : -2;
  if (o.sound) s += 6 * jaccard(bigrams(t.fr), bigrams(c.fr));
  if (NEAR.has(pairKey(t.fr, c.fr))) s += 8;
  return s;
}

/**
 * Takes `count` items from a best-first list so that a random number of them (0..count) are shorter than the answer
 * and the rest longer: across many questions the answer's length rank is uniform, so length gives nothing away.
 */
function balanceLength<T>(ranked: T[], len: (x: T) => number, answerLen: number, count: number, ok: (x: T, chosen: T[]) => boolean): T[] {
  const shorterWanted = Math.floor(Math.random() * (count + 1));
  const out: T[] = [];
  const add = (x: T) => { if (out.length < count && !out.includes(x) && ok(x, out)) out.push(x); };
  const top = ranked.slice(0, Math.max(10, count * 3)); // relevance first: never reach far down the list for length
  const side = new Map(top.map((x) => [x, len(x) < answerLen || (len(x) === answerLen && Math.random() < 0.5)])); // ties: either side
  const shorter = top.filter((x) => side.get(x));
  const longer = top.filter((x) => !side.get(x));
  for (const x of shorter) if (out.length < shorterWanted) add(x);
  for (const x of longer) add(x);
  for (const x of ranked) add(x);
  return out;
}

/**
 * Chooses `count` wrong options for t. From the best-scoring candidates it picks a random number that are
 * shorter than the answer and the rest longer, so the answer's length rank is uniform (no "longest one" tell);
 * at least one wrong option shares the answer's end punctuation; no two options mean the same thing.
 */
function pickDistractors(t: Phrase, side: Side, count: number, anchor: number, o: PickOpts): Phrase[] {
  const scored = ALL_PHRASES.filter((c) => !blocked(t, c))
    .map((c) => ({ c, s: score(t, c, side, anchor, o) }))
    .sort((a, b) => b.s - a.s);
  const out = balanceLength(scored.map((x) => x.c), (c) => c[side].length, t[side].length, count, (c, chosen) => !chosen.some((d) => blocked(d, c)));
  const end = endType(t[side]);
  if (out.length && !out.some((d) => endType(d[side]) === end)) {
    const keep = out.slice(0, -1);
    const alt = scored.find((x) => endType(x.c[side]) === end && !out.includes(x.c) && !keep.some((d) => blocked(d, x.c)));
    if (alt) out[out.length - 1] = alt.c;
  }
  return out;
}

function explain(t: Phrase, d: Phrase, side: Side) {
  const near = NEAR.get(pairKey(t.fr, d.fr));
  if (near) return near;
  return side === "en" ? `“${d.en}” would be ${d.fr}.` : `${d.fr} means “${d.en}”.`;
}

function mc(t: Phrase, side: Side, count: number, anchor: number, o: PickOpts = {}) {
  const ds = pickDistractors(t, side, count, anchor, o);
  return {
    choices: shuffle([t[side], ...ds.map((d) => d[side])]),
    why: Object.fromEntries(ds.map((d) => [d[side], explain(t, d, side)])) as Why,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Gap-fill and word-bank words

type Slot = { k: number; core: string; tail: string; sibs: string[]; note: string };
const TAIL = /^(.*?)([\s ]*[?!:;,.]+)?$/u;
const DISJ_BEFORE = new Set(["pour", "avec", "à", "et", "de", "chez", "sans"]);
const DISJ = ["moi", "nous", "lui", "elle", "eux"];
const matchCase = (model: string, w: string) => (model[0] !== model[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w);

/**
 * Words of a phrase that can be blanked out, each with plausible same-family alternatives that are certainly wrong
 * given the English: no elided or hyphenated words, no proper nouns, no sentence-initial verbs (a tu imperative could
 * be right), no object pronouns (Je le prends / Je la prends), no tu forms.
 */
function gapSlots(p: Phrase): Slot[] {
  const toks = tokenize(p.fr);
  if (toks.length < 2) return [];
  const inPhrase = new Set(toks.map((t) => normalize(t)));
  return toks.flatMap((tok, k): Slot[] => {
    const [, core = "", tail = ""] = tok.match(TAIL) ?? [];
    const low = core.toLowerCase();
    if (!core || /['’-]/.test(core) || (k > 0 && core !== low)) return [];
    const fam = familyOf(low);
    if (!fam || (fam.verb && k === 0)) return [];
    if (["le", "la", "les"].includes(low) && k > 0 && SUBJECTS.has(toks[k - 1].toLowerCase())) return [];
    let pool = siblings(low);
    if (fam.name === "subject" && k > 0) {
      if (!DISJ_BEFORE.has(toks[k - 1].toLowerCase()) || !DISJ.includes(low)) return [];
      pool = shuffle(DISJ.filter((w) => w !== low));
    }
    const sibs = pool.filter((s) => normalize(s) !== normalize(low) && !inPhrase.has(normalize(s)) && !TU_WORDS.has(s));
    // two options only for a true pair (gauche / droite); everything else needs at least two wrong words
    return sibs.length >= (fam.name === "direction" ? 1 : 2) ? [{ k, core, tail, sibs, note: FAMILY_NOTE[fam.name] }] : [];
  });
}

const glossOf = (w: string) => GLOSS[w.toLowerCase()];

function mkGap(p: Phrase, count: number, base: Base): Exercise | null {
  const slots = gapSlots(p);
  if (!slots.length) return null;
  // Prefer slots whose family has words both no longer and no shorter than the answer (otherwise the answer is
  // always the shortest option, as with à or parle), then meaning words (numbers, days, directions) over articles.
  const fair = slots.filter((x) => x.sibs.some((w) => w.length <= x.core.length) && x.sibs.some((w) => w.length >= x.core.length));
  const usable = fair.length ? fair : slots;
  const meaningful = usable.filter((x) => glossOf(x.core));
  const s = shuffle(meaningful.length && Math.random() < 0.7 ? meaningful : usable)[0];
  const toks = tokenize(p.fr);
  const wrong = balanceLength(s.sibs, (w) => w.length, s.core.length, count, () => true).map((w) => matchCase(s.core, w));
  const why: Why = {};
  for (const w of wrong) {
    const gw = glossOf(w), ga = glossOf(s.core);
    why[w] = gw && ga && gw !== ga ? `${w} means “${gw}”; here you need ${s.core} (“${ga}”).` : s.note;
  }
  return {
    kind: "gap", en: p.en, fr: p.fr, answer: s.core, choices: shuffle([s.core, ...wrong]), why,
    before: toks.slice(0, s.k).join(" "), after: s.tail + (s.k < toks.length - 1 ? " " + toks.slice(s.k + 1).join(" ") : ""),
    ...base,
  };
}

const FILLERS = new Set(["bien", "très", "beaucoup", "aussi", "ici", "vraiment", "merci", "s'il", "plaît", "oui", "non", "vous", "nous"]);

/** Word bank: the phrase's tiles plus two decoys, preferably same-family words (une for un, droite for gauche). */
function mkBank(p: Phrase, anchor: number, base: Base): Exercise {
  const words = tokenize(p.fr);
  const inPhrase = new Set(words.map((w) => normalize(w)));
  const extras: string[] = [];
  const take = (w: string) => {
    const n = normalize(w);
    if (extras.length < 2 && n && !inPhrase.has(n) && !extras.some((e) => normalize(e) === n) && !TU_WORDS.has(w.toLowerCase())) extras.push(w);
  };
  for (const s of shuffle(gapSlots(p))) take(matchCase(s.core, s.sibs[0]));
  if (extras.length < 2) {
    // fall back to words from phrases the learner met most recently, never random leftovers from the whole course
    const near = ALL_PHRASES.filter((q) => q !== p)
      .map((q) => ({ q, s: locality(anchor, HOME.get(q) ?? anchor + 1) + Math.random() * 2 }))
      .sort((a, b) => b.s - a.s).slice(0, 12);
    for (const { q } of near) {
      for (const [k, tok] of shuffle(tokenize(q.fr).map((t, k) => [k, t] as const))) {
        const core = (tok.match(TAIL)?.[1] ?? "").trim();
        const low = core.toLowerCase();
        if (!core || /\d/.test(core) || FILLERS.has(low)) continue;
        if (core !== low && (k > 0 || !(familyOf(low) || GLOSS[low]))) continue; // proper nouns stay out
        take(low);
      }
    }
  }
  return { kind: "bank", en: p.en, fr: p.fr, tokens: shuffle([...words, ...extras]), ...base };
}

/** "Je m'appelle Marie" -> "J_ m'a_____ M____": first letters and word lengths. */
export const letterHint = (fr: string) =>
  tokenize(fr).map((t) => t.replace(/(^|['’-])(\p{L})|\p{L}/gu, (_m, sep, first) => (first !== undefined ? sep + first : "_"))).join(" ");

function glossHint(p: Phrase) {
  if (nWords(p.fr) < 2) return undefined;
  const seen = new Set<string>();
  const parts = tokenize(p.fr).flatMap((t) => {
    const core = (t.match(TAIL)?.[1] ?? "").toLowerCase();
    const g = GLOSS[core];
    if (!g || seen.has(core)) return [];
    seen.add(core);
    return [`${core} = ${g}`];
  });
  return parts.length ? parts.join(" · ") : undefined;
}

const VOUS_SITUATIONS = ["To a shopkeeper", "To an older person on the tram", "To someone you just met on the street", "To a waiter", "To an older person at church"];
const TU_SITUATIONS = ["To a French student your age", "To a new friend who just asked: On se tutoie ?", "To a friend from the youth group"];

function mkRegister(p: Phrase, base: Base): Exercise | null {
  if (!p.tu) return null;
  const wantTu = Math.random() < 0.5;
  const pickOne = (a: string[]) => a[Math.floor(Math.random() * a.length)];
  return {
    kind: "register", en: p.en, fr: p.fr, situation: pickOne(wantTu ? TU_SITUATIONS : VOUS_SITUATIONS),
    answer: wantTu ? p.tu : p.fr, choices: shuffle([p.fr, p.tu]),
    why: wantTu
      ? { [p.fr]: "With friends your age, tu is natural; vous would sound distant." }
      : { [p.tu]: "With strangers and older people, use vous." },
    key: base.key, review: base.review,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Exercise mix

type K = Exclude<Kind, "match">;
type Weights = Partial<Record<K, number>>;
type Ctx = { stage: 0 | 1 | 2; anchor?: number; review?: boolean };

/** First pass: every phrase once, right after the introduction. Recognition early in the course, production later. */
const FIRST: Weights[] = [
  { choose: 4, hear: 3, pick: 3 },
  { choose: 3, hear: 2.5, pick: 3, gap: 2.5, bank: 1.5 },
  { choose: 1.5, hear: 1.5, pick: 2, gap: 3, bank: 2.5, type: 2.5 },
];
/** Second pass: production. Typing takes over in the later units. */
const SECOND: Weights[] = [
  { pick: 1.5, gap: 2.5, bank: 3.5, listen: 1.5, type: 1, register: 3 },
  { gap: 2, bank: 3, type: 2.5, listen: 2, register: 3, choose: 0.7 },
  { gap: 1.5, bank: 3, type: 4, listen: 2, register: 3, choose: 0.7 },
];
const REVIEW: Weights = { pick: 2, gap: 2, type: 2, bank: 2, hear: 1, listen: 1, choose: 1, register: 1.5 };
const CAP: Partial<Record<K, number>> = { listen: 2, hear: 3, register: 1, choose: 4 };
const TYPE_MAX = [4, 6, 8], LISTEN_MAX = [5, 7, 8];

function eligible(kind: K, p: Phrase, c: Ctx): boolean {
  switch (kind) {
    case "gap": return gapSlots(p).length > 0;
    case "bank": return tokenize(p.fr).length >= 2;
    case "type": return nWords(p.fr) <= TYPE_MAX[c.stage];
    case "listen": return nWords(p.fr) <= LISTEN_MAX[c.stage];
    case "register": return !!p.tu;
    default: return true;
  }
}

function pickKind(w: Weights, p: Phrase, c: Ctx, prev: Kind | undefined, counts: Partial<Record<Kind, number>>): K {
  const opts = (Object.entries(w) as [K, number][])
    .filter(([k, wt]) => wt > 0 && k !== prev && (counts[k] ?? 0) < (CAP[k] ?? 99) && eligible(k, p, c));
  if (!opts.length) return (["pick", "choose", "type"] as K[]).find((k) => k !== prev && eligible(k, p, c)) ?? "pick";
  let r = Math.random() * opts.reduce((a, [, wt]) => a + wt, 0);
  for (const [k, wt] of opts) if ((r -= wt) <= 0) return k;
  return opts[opts.length - 1][0];
}

function make(kind: K, p: Phrase, c: Ctx, warm = false): Exercise {
  const anchor = c.anchor ?? HOME.get(p) ?? 0;
  const base: Base = { key: phraseKey(p.fr), note: p.note, ...(c.review ? { review: true } : {}) };
  const n = c.stage === 0 ? 2 : 3; // wrong options per question
  switch (kind) {
    case "choose": {
      const audioOnly = !warm && c.stage > 0 && Math.random() < (c.stage === 1 ? 0.35 : 0.5);
      return { kind, fr: p.fr, answer: p.en, ...mc(p, "en", warm ? 2 : 3, anchor, { easy: warm }), hint: warm ? glossHint(p) : undefined, audioOnly, ...base };
    }
    case "hear":
      return { kind, fr: p.fr, en: p.en, answer: p.fr, ...mc(p, "fr", warm ? 2 : 3, anchor, { sound: true, easy: warm }), hint: warm ? `It means “${p.en}”.` : undefined, ...base };
    case "pick":
      return { kind, en: p.en, fr: p.fr, answer: p.fr, ...mc(p, "fr", 3, anchor), ...base };
    case "gap":
      return mkGap(p, n, base) ?? make("pick", p, c);
    case "register":
      return mkRegister(p, base) ?? make("pick", p, c);
    case "bank":
      return mkBank(p, anchor, base);
    case "type":
      return { kind, en: p.en, fr: p.fr, alt: p.tu, hint: c.stage < 2 || c.review ? letterHint(p.fr) : undefined, hintOpen: c.stage === 0, ...base };
    case "listen":
      return { kind, fr: p.fr, ...base };
  }
}

/** Matching round: up to five pairs, shorter phrases first, never two that could share a meaning. */
function mkMatch(phrases: Phrase[]): Exercise {
  const pool = shuffle(phrases).sort((a, b) => Number(nWords(a.fr) > 6) - Number(nWords(b.fr) > 6));
  const pairs: Phrase[] = [];
  for (const p of pool) if (pairs.length < 5 && !pairs.some((q) => blocked(p, q))) pairs.push(p);
  return { kind: "match", pairs };
}

/** Lesson size: 12 to 15 exercises before review (review adds up to 3). */
const lessonSize = (n: number) => Math.max(12, Math.min(15, n + 6));

/**
 * Builds one lesson (shown after the "meet the phrases" cards):
 * 1. a matching round on the phrases just introduced;
 * 2. every phrase once: two warm-ups (fewer options, a hint), then recognition-leaning kinds;
 * 3. production on the phrases first seen by recognition: word bank, gap-fill, typing, listening, tu/vous.
 * Kinds are weighted by course stage and never repeat back to back.
 */
export function buildLesson(lesson: Lesson): Exercise[] {
  const li = Math.max(0, ALL_LESSONS.findIndex((l) => l.id === lesson.id));
  const c: Ctx = { stage: stageOf(li), anchor: li };
  const out: Exercise[] = [mkMatch(lesson.phrases)];
  const counts: Partial<Record<Kind, number>> = {};
  const push = (e: Exercise) => { out.push(e); counts[e.kind] = (counts[e.kind] ?? 0) + 1; };
  const first = shuffle(lesson.phrases);
  first.forEach((p, k) => {
    const kind: K = k === 0 ? "choose" : k === 1 ? "hear" : pickKind(FIRST[c.stage], p, c, out[out.length - 1].kind, counts);
    push(make(kind, p, c, k < 2));
  });
  const recognised = new Set(out.filter((e) => e.kind === "choose" || e.kind === "hear").map((e) => e.key));
  const rest = lessonSize(lesson.phrases.length) - out.length;
  const second = shuffle(lesson.phrases).sort((a, b) => Number(!recognised.has(phraseKey(a.fr))) - Number(!recognised.has(phraseKey(b.fr)))).slice(0, rest);
  const ordered = shuffle(second);
  if (ordered.length > 1 && ordered[0] === first[first.length - 1]) ordered.push(ordered.shift()!); // no phrase twice in a row
  for (const p of ordered) push(make(pickKind(SECOND[c.stage], p, c, out[out.length - 1].kind, counts), p, c));
  return out;
}

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

/** One exercise per phrase, production-leaning, distractors from each phrase's own lesson and earlier ones. */
function sequence(phrases: Phrase[], c: Ctx, prev?: Kind): Exercise[] {
  const out: Exercise[] = [];
  const counts: Partial<Record<Kind, number>> = {};
  for (const p of phrases) {
    const e = make(pickKind(REVIEW, p, c, out[out.length - 1]?.kind ?? prev, counts), p, c);
    out.push(e);
    counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  }
  return out;
}

/** Review exercises for phrases from earlier lessons, flagged `review`. `prev` is the kind just before them. */
export function buildReview(phrases: Phrase[], prev?: Kind): Exercise[] {
  return sequence(shuffle(phrases), { stage: 1, review: true }, prev);
}

/** A practice session: one exercise per phrase, in the order given, mixed kinds. */
export function buildPractice(phrases: Phrase[]): Exercise[] {
  return sequence(phrases, { stage: 1 });
}

/** Version of an exercise that needs no audio, for "Can't listen now" (null when it already needs none). */
export function noAudioFallback(ex: Exercise): Exercise | null {
  if (ex.kind === "listen") {
    const p = BY_FR.get(ex.fr);
    return p ? { kind: "type", en: p.en, fr: p.fr, alt: p.tu, hint: letterHint(p.fr), key: ex.key, review: ex.review, note: ex.note } : null;
  }
  if (ex.kind === "hear") {
    return { kind: "pick", en: ex.en, fr: ex.fr, choices: ex.choices, answer: ex.answer, why: ex.why, key: ex.key, review: ex.review, note: ex.note };
  }
  if (ex.kind === "choose" && ex.audioOnly) return { ...ex, audioOnly: false };
  return null;
}

/** Test helper: true when a wrong option could also be a right answer for the exercise. */
export function ambiguousOption(e: Exercise, o: string): boolean {
  if (e.kind === "choose") {
    const t = BY_FR.get(e.fr), d = BY_EN.get(o);
    return !t || !d || blocked(t, d);
  }
  if (e.kind === "pick" || e.kind === "hear") {
    const t = BY_FR.get(e.fr), d = BY_FR.get(o);
    return !t || !d || blocked(t, d) || (!!t.tu && normalize(t.tu) === normalize(o));
  }
  if (e.kind === "gap") return TU_WORDS.has(o.toLowerCase()) || normalize(`${e.before} ${o} ${e.after}`) === normalize(e.fr);
  return false;
}

/** Test helper: true when a word bank's decoy tiles could build another correct sentence (a tu form). */
export function ambiguousTiles(e: Exercise): boolean {
  if (e.kind !== "bank") return false;
  const words = tokenize(e.fr);
  const extras = [...e.tokens];
  for (const w of words) extras.splice(extras.indexOf(w), 1);
  return extras.some((x) => TU_WORDS.has(x.toLowerCase()));
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
