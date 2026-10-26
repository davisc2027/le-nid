import { ALL_LESSONS, ALL_PHRASES, UNITS, type Lesson, type Phrase } from "./content";
import { FAMILY_NOTE, familyOf, GLOSS, siblings, SUBJECTS, TU_WORDS } from "./lexicon";

/** Wrong option -> one short reason, shown in the feedback card after a miss. */
export type Why = Record<string, string>;

type Base = { key?: string; review?: boolean; note?: string };
/**
 * `key` is the phrase key (see phraseKey); `review` marks an exercise drawn from an earlier lesson.
 * choose: read (or with audioOnly, hear) French, pick the meaning. hear: hear French, pick the written phrase.
 * pick: read English, pick the French. gap: pick the missing word. register: pick tu or vous for a situation.
 * bank: build the French from tiles (with `audio`, hear it instead of reading the English). type: type the French for an
 * English prompt. cloze: type one or two words inside the French sentence. listen: type what you hear.
 * type has two-step help: `gloss` first, then `shapes` (shown from the start when `shapesOpen`).
 */
export type Exercise =
  | (Base & { kind: "choose"; fr: string; choices: string[]; answer: string; why?: Why; hint?: string; audioOnly?: boolean })
  | (Base & { kind: "hear"; fr: string; en: string; choices: string[]; answer: string; why?: Why; hint?: string })
  | (Base & { kind: "pick"; en: string; fr: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "gap"; en: string; fr: string; before: string; after: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "register"; en: string; fr: string; situation: string; choices: string[]; answer: string; why?: Why })
  | (Base & { kind: "bank"; en: string; fr: string; tokens: string[]; audio?: boolean })
  | (Base & { kind: "type"; en: string; fr: string; alt?: string; gloss?: string; shapes: string[]; shapesOpen?: boolean })
  /** `tokens = tokenize(fr)`; `blanks` are token indexes; `shapes[k]` is the placeholder of blank `blanks[k]`. */
  | (Base & { kind: "cloze"; en: string; fr: string; tokens: string[]; blanks: number[]; shapes: string[] })
  | (Base & { kind: "listen"; fr: string })
  | { kind: "match"; pairs: Phrase[]; key?: undefined; review?: undefined; note?: undefined }
  /** Optional spoken step, inserted by lib/speech/select.ts. No key on purpose: it never reaches missed, cards or XP. */
  | { kind: "speak"; fr: string; en: string; note?: string; key?: undefined; review?: undefined };
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

/** Splits a token into its word and trailing punctuation (with the space kept before ? ! : ;). */
const TAIL = /^(.*?)([\s ]*[?!:;,.]+)?$/u;
/** Word and trailing punctuation of a token ("longtemps ?" -> ["longtemps", " ?"]). */
export const splitTail = (tok: string): [string, string] => { const m = tok.match(TAIL); return [m?.[1] ?? tok, m?.[2] ?? ""]; };

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

/** Grading-only normalisation: ligatures become letters. `normalize` itself must not change (phraseKey is built on it). */
const answerCache = new Map<string, string>();
export const normalizeAnswer = (s: string) => {
  let r = answerCache.get(s);
  if (r === undefined) {
    r = normalize(s.replace(/œ/gi, "oe").replace(/æ/gi, "ae"));
    if (answerCache.size > 4000) answerCache.clear();
    answerCache.set(s, r);
  }
  return r;
};

export type Grade = { ok: boolean; fixed?: string; wrong?: { given: string; expected: string; why?: string } };

/** Families whose members mean different things (nous / vous, lundi / mardi): swapping one is never a typo. */
export const MEANING_FAMILIES = ["subject", "number", "day", "time", "direction", "weather", "family", "body", "question"] as const;

/** Case, accents kept, punctuation gone: used to tell "exact" from "right after forgiving spelling". */
const plain = (s: string) => s.toLowerCase().replace(/[’']/g, " ").replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
/** Same words as normalizeAnswer would see, but with their accents (for "it's vous" / "première"). */
const rawWords = (s: string) => plain(s).split(" ").filter(Boolean);

function grade(given: string, expected: string): Grade {
  const g = normalizeAnswer(given), e = normalizeAnswer(expected);
  if (!g || !e) return { ok: false };
  const spelled = plain(given) === plain(expected);
  if (g === e) return spelled ? { ok: true } : { ok: true, fixed: expected };
  // another course phrase is never "close enough" (Dieu nous aime for Dieu vous aime)
  const other = NORM_FR.get(g);
  if (other) {
    const gw = g.split(" "), ew = e.split(" ");
    const k = gw.length === ew.length ? gw.findIndex((w, i) => w !== ew[i]) : -1;
    return { ok: false, wrong: k >= 0 ? { given: gw[k], expected: rawWords(expected)[k] ?? ew[k], why: whyDiffer(other, expected, gw[k], ew[k]) } : undefined };
  }
  if (g.replace(/ /g, "") === e.replace(/ /g, "")) return { ok: true, fixed: expected };
  const gw = g.split(" "), ew = e.split(" ");
  if (gw.length === ew.length) {
    const raw = rawWords(expected);
    const budget = Math.max(1, Math.floor(e.length / 12));
    let total = 0, first = -1;
    for (let i = 0; i < ew.length; i++) {
      if (gw[i] === ew[i]) continue;
      const fa = FAMILY_BY_WORD.get(gw[i]), fb = FAMILY_BY_WORD.get(ew[i]);
      const meaning = !!fa && fa === fb && (MEANING_FAMILIES as readonly string[]).includes(fa);
      const d = distance(gw[i], ew[i]);
      const allowed = ew[i].length >= 5 ? 1 : 0;
      if (meaning || d > allowed) {
        return { ok: false, wrong: { given: gw[i], expected: raw.length === ew.length ? raw[i] : ew[i], why: whyDiffer(undefined, expected, gw[i], ew[i], meaning ? fa : undefined) } };
      }
      total += d;
      if (first < 0) first = i;
    }
    if (total > budget) return { ok: false, wrong: { given: gw[first], expected: raw.length === ew.length ? raw[first] : ew[first] } };
    return { ok: true, fixed: expected };
  }
  // a lost or extra space
  return e.length > 6 && distance(g, e) <= 1 ? { ok: true, fixed: expected } : { ok: false };
}
export { grade };

export const isCorrect = (given: string, expected: string) => grade(given, expected).ok;

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
  ["D'accord", "Je suis d'accord"], ["Oui", "Je suis d'accord"], ["Bien sûr", "Je suis d'accord"], ["C'est vrai", "Je suis d'accord"],
  ["Je comprends", "Je vois"], ["Je ne sais pas", "Je ne sais pas trop"], ["Merci, c'est gentil", "Merci, ça me touche"],
  ["Qu'est-ce que vous recommandez ?", "Qu'est-ce que vous me conseillez de visiter ?"],
  ["Comment allez-vous ?", "Comment vous sentez-vous ?"], ["Ça va ?", "Comment vous sentez-vous ?"],
  ["Je respecte votre point de vue", "Je respecte votre avis"], ["Bonne journée", "Je vous souhaite une belle journée"],
  ["Pas de problème, merci quand même", "Pas de souci"], ["Je suis athée", "Je ne crois pas en Dieu"],
  ["Puis-je prier pour vous ?", "Je peux prier pour vous maintenant ?"], ["Comment puis-je prier pour vous ?", "Avez-vous un sujet de prière ?"],
  // the same person or truth in other words: never offered as a wrong translation of each other
  ["Dieu", "Le Seigneur"], ["Jésus-Christ", "Le Fils de Dieu"], ["Christ est mort pour nous", "Jésus est mort sur la croix pour nous"],
  ["Il est ressuscité", "Dieu l'a ressuscité des morts"], ["Dieu nous aime", "L'amour de Dieu"], ["Dieu vous aime", "L'amour de Dieu"],
  ["Dieu nous aime", "Dieu manifeste son amour envers nous"],
  // the short forms added by the curriculum simplification next to the long ones they lead to
  ["Où est la place Kléber ?", "Comment aller à la place Kléber ?"], ["C'est à cinq minutes", "C'est à cinq minutes à pied"],
  ["Pas de viande, s'il vous plaît", "Je ne mange pas de viande"],
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
  ["Salut", "Le salut", "Salut alone is hi; le salut is salvation."],
  ["La croix", "Je crois en Dieu", "Croix (the cross) and crois (I believe) sound the same: 'krwa'."],
  ["Prier", "La prière", "Prier is the verb, to pray; la prière is the noun, prayer."],
  ["Je vous en prie", "Je prie tous les jours", "Je vous en prie means you're welcome; je prie means I pray."],
  ["Dieu vous aime", "Dieu nous aime", "Vous is you; nous is us."],
  ["Croyez-vous en Dieu ?", "Je crois en Dieu", "Croyez-vous asks; je crois says what you believe."],
  ["Je crois en Dieu", "Je crois en quelque chose", "En Dieu is in God; en quelque chose is in something."],
  ["Le don gratuit de Dieu", "C'est le don de Dieu", "Gratuit means free of charge; c'est means it is."],
  ["Cela ne vient pas de vous", "Cela ne vient pas des œuvres", "De vous is from you; des œuvres is from works."],
  ["Jésus est Seigneur", "Jésus-Christ notre Seigneur", "Est Seigneur says Jesus is Lord; notre Seigneur is our Lord."],
  ["Le culte", "La messe", "Le culte is a Protestant service; la messe is Catholic Mass."],
  ["Je suis catholique", "Je suis protestant", "Catholique is Catholic; protestant is Protestant."],
  ["Nous sommes protestants", "Je suis protestant", "Nous sommes is we are; je suis is I am."],
  ["Merci de votre temps", "Prenez votre temps", "Merci de votre temps thanks someone; prenez votre temps means take your time."],
  ["Ma mère est infirmière", "Ma mère est malade", "Infirmière is a nurse; malade is sick."],
  ["J'ai perdu mon téléphone", "J'ai perdu mon travail", "Mon téléphone is my phone; mon travail is my job."],
  ["Vous êtes d'ici ?", "Vous travaillez dans le quartier ?", "D'ici asks where someone is from; travaillez asks about work."],
  ["Romains, chapitre trois, verset vingt-trois", "Romains, chapitre six, verset vingt-trois", "Trois is 3, six is 6."],
  ["Jean, chapitre trois, verset seize", "Jean, chapitre quatorze, verset six", "Trois seize is 3:16; quatorze six is 14:6."],
  ["Il est deux heures", "Il est deux heures et demie", "Et demie adds half an hour: two o'clock against half past two."],
  ["Tournez à droite", "Tournez à gauche au feu", "Droite is right and gauche is left; au feu adds 'at the traffic light'."],
  ["Un aller simple, s'il vous plaît", "Un aller-retour, s'il vous plaît", "Aller simple is one way; aller-retour is a round trip."],
  ["Lundi", "Samedi", "Lundi is Monday, samedi is Saturday."],
  ["Un chocolat chaud, s'il vous plaît", "Un jus de pomme chaud, s'il vous plaît", "Chocolat is chocolate; jus de pomme is apple juice."],
];

const pairKey = (a: string, b: string) => (a < b ? a + "\u0000" + b : b + "\u0000" + a);
const SAME = new Set(SAME_MEANING.map(([a, b]) => pairKey(a, b)));
const NEAR = new Map(NEAR_MISS.map(([a, b, why]) => [pairKey(a, b), why]));

/** normalizeAnswer(fr) -> phrase, for "never accept another course phrase". */
const NORM_FR = new Map(ALL_PHRASES.map((p) => [normalizeAnswer(p.fr), p]));
/** normalized word -> family name, for every course word and its family mates (so nous / vous are known to be rivals). */
const FAMILY_BY_WORD = new Map<string, string>();
for (const p of ALL_PHRASES) {
  for (const t of tokenize(p.fr)) {
    const low = (t.match(TAIL)?.[1] ?? "").toLowerCase();
    const fam = familyOf(low);
    if (!fam) continue;
    for (const w of [low, ...siblings(low)]) {
      const f = familyOf(w);
      if (f && !FAMILY_BY_WORD.has(normalizeAnswer(w))) FAMILY_BY_WORD.set(normalizeAnswer(w), f.name);
    }
  }
}
/** The reason shown under "One word to fix": the listed near miss for two phrases, else the family's note. */
function whyDiffer(given: Phrase | undefined, expected: string, gWord: string, eWord: string, fam = FAMILY_BY_WORD.get(gWord) === FAMILY_BY_WORD.get(eWord) ? FAMILY_BY_WORD.get(gWord) : undefined) {
  const exp = NORM_FR.get(normalizeAnswer(expected));
  const near = given && exp ? NEAR.get(pairKey(given.fr, exp.fr)) : undefined;
  return near ?? (fam && fam in FAMILY_NOTE ? FAMILY_NOTE[fam as keyof typeof FAMILY_NOTE] : undefined);
}

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
/** Props passed from server to client components arrive as copies, but the caches above are keyed by the course's own
 *  phrase objects. Every builder maps its input back through this, so a copied phrase behaves like the original. */
const canon = (p: Phrase): Phrase => BY_FR.get(p.fr) ?? p;
const BY_EN = new Map(ALL_PHRASES.map((p) => [p.en, p]));
const unitOf = (i: number) => ALL_LESSONS[i].id.split("-")[0];

export type Tier = 0 | 1 | 2 | 3 | 4;

/** Difficulty tier by unit (docs/difficulty-plan.md 3.1): 0 recognise, 1 build, 2 short recall, 3 supported sentences, 4 free recall. */
export const UNIT_TIER: Record<string, Tier> = {
  u0: 0, u1: 0, u11: 1, u12: 1, u5: 1, u13: 1, u2: 2, u3: 2, u9: 2,
  u4: 3, u14: 3, u6: 3, u15: 4, u8: 4, u16: 4, u7: 4, u17: 4, u10: 4, u18: 4,
  // docs/curriculum-simplification-plan.md: part-2 units (u19 small talk, u20 city sentences) and the optional end unit u21
  u19: 3, u20: 4, u21: 4,
};
const TIER_OF_LESSON: Tier[] = (() => {
  let last: Tier = 0; // a unit missing from the map takes the tier of the unit before it
  const byUnit = new Map(UNITS.map((u) => [u.id, (last = UNIT_TIER[u.id] ?? last)]));
  return ALL_LESSONS.map((l) => byUnit.get(l.id.split("-")[0]) ?? 0);
})();
/** The tier of the unit a lesson (by course index) belongs to. */
export const tierOf = (lessonIndex: number): Tier => TIER_OF_LESSON[Math.max(0, Math.min(lessonIndex, TIER_OF_LESSON.length - 1))];

/** Typed-production limits per tier (docs/difficulty-plan.md 3.2). `null` means that kind is never typed in the tier. */
type Cap = { words: number; chars: number } | null;
export const RULES = {
  typedLesson: [0, 2, 3, 4, 5],
  typedReview: [0, 1, 1, 1, 2],
  typedPractice: [0, 2, 3, 3, 4],
  type: [null, { words: 1, chars: 12 }, { words: 3, chars: 18 }, { words: 4, chars: 24 }, { words: 6, chars: 32 }] as Cap[],
  listen: [null, null, { words: 3, chars: 18 }, { words: 4, chars: 24 }, { words: 5, chars: 28 }] as Cap[],
  bankAudioWords: [4, 6, 8, 99, 99],
  bankTiles: [6, 8, 99, 99, 99],
  bankDecoys: [1, 2, 2, 2, 2],
  options: [2, 3, 3, 3, 3],
  audioOnly: [0, 0, 0.25, 0.35, 0.5],
  decoysTaught: [true, true, false, false, false],
};
const typedBudget = (c: Ctx) => (c.budget === "lesson" ? RULES.typedLesson : c.budget === "review" ? RULES.typedReview : RULES.typedPractice)[c.tier];
const fitsCap = (p: Phrase, cap: Cap) => !!cap && nWords(p.fr) <= cap.words && normalizeAnswer(p.fr).length <= cap.chars;

/** Words (normalized) taught in lessons 0..anchor, for tiers whose decoys must be familiar. */
const TAUGHT: Set<string>[] = [];
function taughtThrough(anchor: number): Set<string> {
  for (let i = TAUGHT.length; i <= Math.min(anchor, ALL_LESSONS.length - 1); i++) {
    const set = new Set(TAUGHT[i - 1] ?? []);
    for (const p of ALL_LESSONS[i].phrases) for (const w of normalizeAnswer(p.fr).split(" ")) set.add(w);
    TAUGHT.push(set);
  }
  return TAUGHT[Math.max(0, Math.min(anchor, TAUGHT.length - 1))];
}
const isTaught = (w: string, taught: Set<string>) => normalizeAnswer(w).split(" ").every((x) => !x || taught.has(x));

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
const DISJ_BEFORE = new Set(["pour", "avec", "à", "et", "de", "chez", "sans"]);
const DISJ = ["moi", "nous", "lui", "elle", "eux"];
const matchCase = (model: string, w: string) => (model[0] !== model[0].toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w);

/**
 * Words of a phrase that can be blanked out, each with plausible same-family alternatives that are certainly wrong
 * given the English: no elided or hyphenated words, no proper nouns, no sentence-initial verbs (a tu imperative could
 * be right), no object pronouns (Je le prends / Je la prends), no tu forms.
 */
function gapSlots(p: Phrase, taught?: Set<string>): Slot[] {
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
    const sibs = pool.filter((s) => normalize(s) !== normalize(low) && !inPhrase.has(normalize(s)) && !TU_WORDS.has(s) && (!taught || isTaught(s, taught)));
    // two options only for a true pair (gauche / droite); everything else needs at least two wrong words
    return sibs.length >= (fam.name === "direction" ? 1 : 2) ? [{ k, core, tail, sibs, note: FAMILY_NOTE[fam.name] }] : [];
  });
}

const glossOf = (w: string) => GLOSS[w.toLowerCase()];

function mkGap(p: Phrase, count: number, base: Base, taught?: Set<string>): Exercise | null {
  const slots = gapSlots(p, taught);
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

/**
 * Word bank: the phrase's tiles plus decoys (two, or one in tier 0), preferably same-family words (une for un, droite
 * for gauche). With `taught` the decoys are words already met; null when no decoy is left.
 */
function mkBank(p: Phrase, anchor: number, base: Base, decoys = 2, taught?: Set<string>): Extract<Exercise, { kind: "bank" }> | null {
  const words = tokenize(p.fr);
  const inPhrase = new Set(words.map((w) => normalize(w)));
  const extras: string[] = [];
  const take = (w: string) => {
    const n = normalize(w);
    if (extras.length < decoys && n && !inPhrase.has(n) && !extras.some((e) => normalize(e) === n) && !TU_WORDS.has(w.toLowerCase()) && (!taught || isTaught(w, taught))) extras.push(w);
  };
  for (const s of shuffle(gapSlots(p, taught))) take(matchCase(s.core, s.sibs[0]));
  if (extras.length < decoys) {
    // fall back to words from phrases the learner met most recently, never random leftovers from the whole course
    const near = ALL_PHRASES.filter((q) => q !== p && (!taught || (HOME.get(q) ?? Infinity) <= anchor))
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
  if (taught && !extras.length) return null;
  return { kind: "bank", en: p.en, fr: p.fr, tokens: shuffle([...words, ...extras]), ...base };
}

/** "habitez" -> "h······": the first letter, then a dot per letter; ' and - stay, and the letter after them restarts. */
export const shapeOf = (word: string) =>
  word.replace(/(^|['’-])(\p{L})|\p{L}/gu, (_m, sep, first) => (first !== undefined ? sep + first : "·"));

/** "Je m'appelle Marie" -> "J· m'a······ M····": first letters and word lengths (kept for callers outside this file). */
export const letterHint = (fr: string) => tokenize(fr).map(shapeOf).join(" ");

const CLOZE_STOP = new Set("le la les un une des de du et en ou je il on ce se ne pas que qui me vous nous est ai au aux y a à".split(" "));

/** Token indexes that can be blanked (docs/difficulty-plan.md 3.3), each with a preference flag. */
function clozeCandidates(p: Phrase) {
  const toks = tokenize(p.fr);
  return toks.flatMap((tok, k) => {
    const core = tok.match(TAIL)?.[1] ?? "";
    const low = core.toLowerCase();
    if (!/^\p{L}{2,12}$/u.test(core) || (k > 0 && core !== low) || TU_WORDS.has(low) || CLOZE_STOP.has(low)) return [];
    return [{ k, core, pref: !!GLOSS[low] || !!familyOf(low)?.verb }];
  });
}

/** Chooses up to n non-adjacent blanks (token indexes, ascending) for a cloze, or null when the phrase has no usable word. */
export function clozeBlanks(p: Phrase, n: number): number[] | null {
  let pool = clozeCandidates(p);
  if (!pool.length) return null;
  const picked: number[] = [];
  while (picked.length < n && pool.length) {
    const pref = pool.filter((x) => x.pref);
    const c = pref.length && Math.random() < 0.7 ? shuffle(pref)[0] : [...pool].sort((a, b) => b.core.length - a.core.length || Math.random() - 0.5)[0];
    picked.push(c.k);
    pool = pool.filter((x) => Math.abs(x.k - c.k) > 1);
  }
  return picked.sort((a, b) => a - b);
}

/** Blanks wanted for a phrase in a tier: 1 in tier 1, 2 only for longer phrases after that. */
function blankCount(tier: Tier, p: Phrase) {
  const w = nWords(p.fr);
  if (tier <= 1) return 1;
  if (tier === 2) return w >= 5 && Math.random() < 0.5 ? 2 : 1;
  return w >= 4 && Math.random() < 0.5 ? 2 : 1;
}

function mkCloze(p: Phrase, n: number, base: Base): Exercise | null {
  const blanks = clozeBlanks(p, n);
  if (!blanks) return null;
  const tokens = tokenize(p.fr);
  return { kind: "cloze", en: p.en, fr: p.fr, tokens, blanks, shapes: blanks.map((k) => shapeOf(tokens[k].match(TAIL)?.[1] ?? tokens[k])), ...base };
}

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

type K = Exclude<Kind, "match" | "speak"> | "bankAudio";
type Weights = Partial<Record<K, number>>;
type Budget = "lesson" | "review" | "practice";
type Ctx = { tier: Tier; anchor?: number; review?: boolean; budget: Budget; cards?: CardMap | null };
const TYPED = new Set<Kind>(["type", "cloze", "listen"]);
const exKind = (k: K): Kind => (k === "bankAudio" ? "bank" : k);

/** First pass: every phrase once, right after the introduction. Recognition early in the course, production later. */
const FIRST: Weights[] = [
  { choose: 4, hear: 3, pick: 3 },
  { choose: 3.5, hear: 3, pick: 3, gap: 1.5 },
  { choose: 3, pick: 3, hear: 2.5, gap: 2.5, bank: 1.5 },
  { choose: 2.5, pick: 2.5, gap: 3, hear: 2, bank: 2 },
  { gap: 3, bank: 2.5, pick: 2, choose: 1.5, hear: 1.5, cloze: 1.5, type: 1.5 },
];
/** Second pass: production. Tiles first, a typed blank next, typed answers only late. */
const SECOND: Weights[] = [
  { bank: 3.5, gap: 2.5, bankAudio: 2, pick: 2, register: 2 },
  { bank: 3.5, gap: 2.5, cloze: 2, bankAudio: 2, register: 2, pick: 1 },
  { bank: 3, cloze: 2.5, gap: 2, register: 2, type: 1.5, listen: 1, bankAudio: 1 },
  { bank: 3, type: 2.5, cloze: 2, gap: 1.5, listen: 1.5, register: 2, choose: 0.7 },
  { type: 3.5, bank: 3, listen: 2, register: 2, gap: 1.5, cloze: 1.5, choose: 0.7 },
];
/** Review tail and practice: follows the learner's tier, never a fixed stage. */
const REVIEW: Weights[] = [
  { pick: 3, choose: 2, hear: 2, bank: 2, gap: 1.5, register: 1 },
  { pick: 2, bank: 2.5, gap: 2, cloze: 1.5, bankAudio: 1, hear: 1, choose: 1, register: 1 },
  { pick: 2, gap: 2, bank: 2, cloze: 2, type: 1, listen: 0.5, hear: 1, choose: 1, register: 1.5 },
  { pick: 2, gap: 2, bank: 2, cloze: 2, type: 1.5, listen: 1, hear: 1, choose: 1, register: 1.5 },
  { pick: 2, gap: 2, type: 2, bank: 2, cloze: 1.5, hear: 1, listen: 1, choose: 1, register: 1.5 },
];
const CAP: Partial<Record<Kind, number>> = { listen: 2, hear: 3, register: 1, choose: 4 };

/** Review and practice: full typing only for phrases whose card is steady (2+ reviews, under 2 lapses). */
function steady(p: Phrase, c: Ctx): boolean {
  if (c.budget === "lesson" || !c.cards) return true;
  const st = c.cards[phraseKey(p.fr)]?.state;
  return Number(st?.reps ?? 0) >= 2 && Number(st?.lapses ?? 0) < 2;
}

const tilesOk = (p: Phrase, c: Ctx) => tokenize(p.fr).length >= 2 && tokenize(p.fr).length <= RULES.bankTiles[c.tier];
const taughtFor = (c: Ctx, p: Phrase) => (RULES.decoysTaught[c.tier] ? taughtThrough(c.anchor ?? HOME.get(p) ?? 0) : undefined);

/** In the early tiers a word bank needs at least one decoy the learner has already met. */
const hasDecoy = (p: Phrase, c: Ctx) => !RULES.decoysTaught[c.tier] || !!mkBank(p, c.anchor ?? HOME.get(p) ?? 0, {}, 1, taughtFor(c, p));

function eligible(kind: K, p: Phrase, c: Ctx): boolean {
  switch (kind) {
    case "gap": return gapSlots(p, taughtFor(c, p)).length > 0;
    case "bank": return tilesOk(p, c) && hasDecoy(p, c);
    case "bankAudio": return tilesOk(p, c) && nWords(p.fr) <= RULES.bankAudioWords[c.tier] && hasDecoy(p, c);
    case "type": return fitsCap(p, RULES.type[c.tier]) && steady(p, c);
    case "listen": return fitsCap(p, RULES.listen[c.tier]) && steady(p, c);
    case "cloze": return c.tier >= 1 && nWords(p.fr) >= 2 && clozeCandidates(p).length > 0;
    case "register": return !!p.tu;
    default: return true;
  }
}

function pickKind(w: Weights, p: Phrase, c: Ctx, prev: Kind | undefined, counts: Partial<Record<Kind, number>>): K {
  const typed = [...TYPED].reduce((a, k) => a + (counts[k] ?? 0), 0);
  const open = (k: K) => exKind(k) !== prev && (counts[exKind(k)] ?? 0) < (CAP[exKind(k)] ?? 99) && !(TYPED.has(exKind(k)) && typed >= typedBudget(c)) && eligible(k, p, c);
  const opts = (Object.entries(w) as [K, number][]).filter(([k, wt]) => wt > 0 && open(k));
  if (!opts.length) {
    // a kind outside the tier's weights is a last resort, and never a typed one
    const fallback: K[] = ["pick", "choose", "bank"];
    return fallback.find((k) => (w[k] ?? 0) > 0 && exKind(k) !== prev && eligible(k, p, c)) ?? fallback.find((k) => exKind(k) !== prev && eligible(k, p, c)) ?? "pick";
  }
  let r = Math.random() * opts.reduce((a, [, wt]) => a + wt, 0);
  for (const [k, wt] of opts) if ((r -= wt) <= 0) return k;
  return opts[opts.length - 1][0];
}

function make(kind: K, p: Phrase, c: Ctx, warm = false): Exercise {
  const anchor = c.anchor ?? HOME.get(p) ?? 0;
  const base: Base = { key: phraseKey(p.fr), note: p.note, ...(c.review ? { review: true } : {}) };
  const n = RULES.options[c.tier]; // wrong options per question
  switch (kind) {
    case "choose": {
      const audioOnly = !warm && Math.random() < RULES.audioOnly[c.tier];
      return { kind, fr: p.fr, answer: p.en, ...mc(p, "en", warm ? 2 : n, anchor, { easy: warm }), hint: warm ? glossHint(p) : undefined, audioOnly, ...base };
    }
    case "hear":
      return { kind, fr: p.fr, en: p.en, answer: p.fr, ...mc(p, "fr", warm ? 2 : n, anchor, { sound: true, easy: warm }), hint: warm ? `It means “${p.en}”.` : undefined, ...base };
    case "pick":
      return { kind, en: p.en, fr: p.fr, answer: p.fr, ...mc(p, "fr", n, anchor), ...base };
    case "gap":
      return mkGap(p, n, base, taughtFor(c, p)) ?? make("pick", p, c);
    case "register":
      return mkRegister(p, base) ?? make("pick", p, c);
    case "bank":
      return mkBank(p, anchor, base, RULES.bankDecoys[c.tier], taughtFor(c, p)) ?? make("pick", p, c);
    case "bankAudio": {
      const b = mkBank(p, anchor, base, RULES.bankDecoys[c.tier], taughtFor(c, p));
      return b ? { ...b, audio: true } : make("pick", p, c);
    }
    case "cloze":
      return mkCloze(p, blankCount(c.tier, p), base) ?? make("bank", p, c);
    case "type":
      return { kind, en: p.en, fr: p.fr, alt: p.tu, gloss: glossHint(p), shapes: tokenize(p.fr).map(shapeOf), shapesOpen: c.tier === 1 || c.tier === 2, ...base };
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
 * 3. production on the phrases first seen by recognition: tiles, gap-fill, then typed blanks and answers in later tiers.
 * Kinds are weighted by the unit's tier (tierOf), capped in typed items, and never repeat back to back.
 */
export function buildLesson(input: Lesson): Exercise[] {
  const lesson = { ...input, phrases: input.phrases.map(canon) };
  const li = Math.max(0, ALL_LESSONS.findIndex((l) => l.id === lesson.id));
  const c: Ctx = { tier: tierOf(li), anchor: li, budget: "lesson" };
  const out: Exercise[] = [mkMatch(lesson.phrases)];
  const counts: Partial<Record<Kind, number>> = {};
  const push = (e: Exercise) => {
    // tier 3: the first typed answer of a lesson shows the shapes of its words
    if (e.kind === "type" && c.tier === 3 && !counts.type) e.shapesOpen = true;
    out.push(e); counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  };
  const first = shuffle(lesson.phrases);
  first.forEach((p, k) => {
    const kind: K = k === 0 ? "choose" : k === 1 ? "hear" : pickKind(FIRST[c.tier], p, c, out[out.length - 1].kind, counts);
    push(make(kind, p, c, k < 2));
  });
  const recognised = new Set(out.filter((e) => e.kind === "choose" || e.kind === "hear").map((e) => e.key));
  const rest = lessonSize(lesson.phrases.length) - out.length;
  const byRecognition = shuffle(lesson.phrases).sort((a, b) => Number(!recognised.has(phraseKey(a.fr))) - Number(!recognised.has(phraseKey(b.fr))));
  const second = byRecognition.slice(0, rest);
  // a lesson of 5 phrases would fall short of 12 exercises: the phrases met least by recognition get a second turn
  while (second.length < rest && byRecognition.length) second.push(byRecognition[second.length % byRecognition.length]);
  const ordered = shuffle(second);
  for (let k = 1; k < ordered.length; k++) { // no phrase twice in a row
    if (ordered[k] !== ordered[k - 1]) continue;
    const j = ordered.findIndex((q, m) => m > k && q !== ordered[k] && q !== ordered[k + 1]);
    if (j > 0) [ordered[k], ordered[j]] = [ordered[j], ordered[k]];
  }
  if (ordered.length > 1 && ordered[0] === first[first.length - 1]) ordered.push(ordered.shift()!); // no phrase twice in a row
  for (const p of ordered) push(make(pickKind(SECOND[c.tier], p, c, out[out.length - 1].kind, counts), p, c));
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
  // with saved cards, only phrases that have a card are reviewed: a lesson that gained a phrase after the learner finished
  // it must not quiz them on something they never met (cards are saved for every phrase of a finished lesson)
  const usable = pool.filter((x) => !own.has(x.key) && (!cards || !!cards[x.key]));
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
    const e = make(pickKind(REVIEW[c.tier], p, c, out[out.length - 1]?.kind ?? prev, counts), p, c);
    out.push(e);
    counts[e.kind] = (counts[e.kind] ?? 0) + 1;
  }
  return out;
}

type BuildOpts = { frontier?: number; cards?: CardMap | null };

/**
 * The furthest lesson (by course index) any saved card belongs to, or 0. A fallback only: a phrase that moved later in the
 * course keeps its card, so the cards of someone at lesson 5 can name a lesson 30 phrase. When the furthest finished
 * lesson is known (`finished`, a course index, -1 for none) cards whose home is beyond `finished + 1` are ignored.
 */
export function frontierFromCards(cards: CardMap | null | undefined, finished?: number): number {
  let best = 0;
  for (const key of Object.keys(cards ?? {})) {
    const p = PHRASE_BY_KEY.get(key);
    const home = p ? HOME.get(p) ?? 0 : -1;
    if (home < 0 || (finished !== undefined && home > finished + 1)) continue;
    best = Math.max(best, home);
  }
  return best;
}

/**
 * The course index that sets a Practice session's tier: the furthest finished lesson (from lesson_progress), so moving a
 * phrase later in the course never raises a learner's tier. `completed` null means lesson_progress could not be read;
 * the cards decide then.
 */
export function practiceFrontier(completed: string[] | null | undefined, cards?: CardMap | null): number {
  if (!completed) return frontierFromCards(cards);
  const done = new Set(completed);
  let finished = -1;
  ALL_LESSONS.forEach((l, i) => { if (done.has(l.id)) finished = i; });
  return finished >= 0 ? finished : frontierFromCards(cards, -1);
}

/**
 * Review exercises for phrases from earlier lessons, flagged `review`. `prev` is the kind just before them.
 * `frontier` is the index of the lesson being played; without it the review uses tier 1, never tier 4.
 */
export function buildReview(phrases: Phrase[], prev?: Kind, opts: BuildOpts = {}): Exercise[] {
  const tier: Tier = opts.frontier === undefined ? 1 : tierOf(opts.frontier);
  return sequence(shuffle(phrases.map(canon)), { tier, review: true, budget: "review", cards: opts.cards }, prev);
}

/** A practice session: one exercise per phrase, in the order given, mixed kinds. */
export function buildPractice(phrases: Phrase[], opts: BuildOpts = {}): Exercise[] {
  const frontier = opts.frontier ?? (opts.cards ? frontierFromCards(opts.cards) : undefined);
  const tier: Tier = frontier === undefined ? 1 : tierOf(frontier);
  return sequence(phrases.map(canon), { tier, budget: "practice", cards: opts.cards });
}

const isTyped = (e: Exercise) => TYPED.has(e.kind);
const ctxFor = (ex: Exercise, tier: Tier): Ctx => ({ tier, review: !!ex.review, budget: ex.review ? "review" : "lesson" });

/**
 * The same phrase one rung down (docs/difficulty-plan.md 5.4): type -> cloze (or tiles), listen -> audio tiles (or
 * hear), cloze -> tiles, audio tiles -> hear, tiles -> pick, gap -> pick. Anything else comes back unchanged.
 */
export function stepDown(ex: Exercise, tier: Tier): Exercise {
  if (ex.kind === "match" || ex.kind === "speak") return ex;
  const p = BY_FR.get(ex.fr);
  if (!p) return ex;
  const c = ctxFor(ex, tier);
  const base: Base = { key: ex.key, note: ex.note, ...(ex.review ? { review: true } : {}) };
  const bank = (audio = false) => {
    const b = mkBank(p, HOME.get(p) ?? 0, base, RULES.bankDecoys[tier], taughtFor(c, p));
    return b ? (audio ? { ...b, audio: true } : b) : null;
  };
  switch (ex.kind) {
    case "type": return (tier >= 1 ? mkCloze(p, 1, base) : null) ?? bank() ?? make("pick", p, c);
    case "listen": return (nWords(p.fr) <= RULES.bankAudioWords[tier] ? bank(true) : null) ?? make("hear", p, c);
    case "cloze": return bank() ?? make("pick", p, c);
    case "bank": return ex.audio ? make("hear", p, c) : make("pick", p, c);
    case "gap": return make("pick", p, c);
    default: return ex;
  }
}

/** Step down until nothing is typed: what "Use tiles instead" and a eased lesson show. */
export function toTiles(ex: Exercise, tier: Tier): Exercise {
  let e = ex;
  for (let k = 0; k < 3 && isTyped(e); k++) e = stepDown(e, tier);
  return e;
}

/**
 * Version of an exercise that needs no audio, for "Can't listen now" (null when it already needs none).
 * A typed dictation becomes a typed blank (tier 2), a typed sentence with its shapes open (tier 3 and 4) when the
 * phrase fits the tier's typing cap, otherwise a blank.
 */
export function noAudioFallback(ex: Exercise, tier: Tier = 4): Exercise | null {
  if (ex.kind === "listen") {
    const p = BY_FR.get(ex.fr);
    if (!p) return null;
    const base: Base = { key: ex.key, note: ex.note, ...(ex.review ? { review: true } : {}) };
    if (tier >= 3 && fitsCap(p, RULES.type[tier])) {
      return { kind: "type", en: p.en, fr: p.fr, alt: p.tu, gloss: glossHint(p), shapes: tokenize(p.fr).map(shapeOf), shapesOpen: true, ...base };
    }
    const c = ctxFor(ex, tier);
    return (tier >= 1 ? mkCloze(p, 1, base) : null) ?? mkBank(p, HOME.get(p) ?? 0, base, RULES.bankDecoys[tier], taughtFor(c, p)) ?? make("pick", p, c);
  }
  if (ex.kind === "bank" && ex.audio) return { ...ex, audio: false };
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
