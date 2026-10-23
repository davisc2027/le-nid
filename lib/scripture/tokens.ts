// Verse text as tokens: one per whitespace-separated piece, so joining every token's `text` with single spaces
// gives back the verse exactly. French elisions stay with the word they belong to ("qu'il", "l’a", "c’est"),
// which is also how they must be spoken: "qu'" or "l’" on its own is not a sound a French voice can say well.
// Punctuation that stands alone (French puts a space before ; : « ») is a token that is shown but never spoken.

export type Tok = {
  /** Exactly as in the verse, punctuation included ("monde,"). */
  text: string;
  /** What to speak when tapped: no surrounding punctuation, plain apostrophe ("qu'il"). Empty for punctuation. */
  say: string;
  /** False for punctuation-only tokens (";", ":", "«"). */
  word: boolean;
};

const PUNCT_ONLY = /^[^\p{L}\p{N}]+$/u;

/** "monde," -> "monde", "« Je" pieces -> "Je", "l’a" -> "l'a". */
export const spoken = (t: string) =>
  t.replace(/[’‘ʼ`´]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

export const pieces = (text: string) => text.split(/\s+/).filter(Boolean);

export function verseTokens(text: string): Tok[] {
  return pieces(text).map((t) => {
    const word = !PUNCT_ONLY.test(t);
    return { text: t, say: word ? spoken(t) : "", word };
  });
}

/** Comparable form of a word: lower case, no accents, œ -> oe, curly apostrophes folded, no punctuation. */
export const fold = (s: string) =>
  s.toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/\p{M}/gu, "")
    .replace(/[’‘ʼ`´]/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();

function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Lenient word match: case, accents and apostrophe style never matter; one slip is fine in words of 5+ letters. */
export function sameWord(given: string, expected: string) {
  const g = fold(given).replace(/'/g, ""), e = fold(expected).replace(/'/g, "");
  if (!e) return true;
  return g === e || (e.length >= 5 && distance(g, e) <= 1);
}

/** "Car Dieu a tant aimé" -> "C D a t a" (elisions keep their letter: "qu'il" -> "q"). */
export const initialOf = (t: Tok) => (t.word ? t.say[0] ?? "" : t.text);
