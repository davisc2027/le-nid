/**
 * Which phrases get a spoken step, where the step goes in a lesson, and the Pronunciation practice sets.
 * See docs/speaking-build-spec.md sections 3 and 4.
 */
import { ALL_LESSONS, type Lesson, type Phrase } from "../french/content";
import type { Exercise } from "../french/exercises";
import { nWords, soundTags, speakable, syllables, type SoundTag } from "./text";

export const SOUND_CARDS: { tag: SoundTag; label: string; tip: string }[] = [
  { tag: "u", label: "u and ou", tip: 'For u (tu, la rue), say "ee" with your lips rounded as if to whistle. For ou (vous, bonjour), say "oo" as in "food".' },
  { tag: "r", label: "The French r", tip: "Keep the tip of your tongue down behind your lower teeth and make a soft sound at the back of your throat, close to a gentle gargle." },
  { tag: "nasal", label: "Nasal vowels", tip: "Let the vowel go through your nose and stop before the n or m: non, bon, un. Don't say the n." },
  { tag: "eu", label: "eu", tip: 'Say "uh" with your lips rounded, as if to whistle: un peu, deux.' },
  { tag: "oi", label: 'oi sounds like "wa"', tip: 'Oi always sounds like "wa": moi is "mwa", voilà is "vwa-la".' },
  { tag: "liaison", label: "Silent letters and liaison", tip: 'Final letters are usually silent (plaît, d\'accord, très). Before a vowel, a silent s can wake up and join the next word: vous avez sounds like "voo-za-vay".' },
  { tag: "question", label: "Questions that go up", tip: "In a yes/no question, let your voice go up at the end: Ça va ?" },
];

/** How many lessons the u0 unit has: they pick sound-coverage phrases; the every-third-lesson rule starts after them. */
const U0_COUNT = ALL_LESSONS.filter((l) => l.id.startsWith("u0-")).length;

type Pos = { li: number; pos: number };
const POS = new Map<Phrase, Pos>();
ALL_LESSONS.forEach((l, li) => l.phrases.forEach((p, pos) => POS.set(p, { li, pos })));
const order = (p: Phrase) => { const x = POS.get(p) ?? { li: 1e9, pos: 0 }; return x.li * 1000 + x.pos; };

/** The phrases of a lesson that get a Say-it step (rule in spec 3.1). */
export function speakPhrasesFor(lessonId: string): Phrase[] {
  const li = ALL_LESSONS.findIndex((l) => l.id === lessonId);
  if (li < 0) return [];
  const eligible = ALL_LESSONS[li].phrases.filter((p) => speakable(p.fr, 5, 8));
  if (lessonId.startsWith("u0-")) {
    const covered = new Set<SoundTag>();
    const chosen: Phrase[] = [];
    for (let n = 0; n < 3; n++) {
      let best: Phrase | null = null, bestGain = -1;
      for (const p of eligible) {
        if (chosen.includes(p)) continue;
        const gain = soundTags(p.fr).filter((t) => !covered.has(t)).length;
        const better = gain > bestGain || (gain === bestGain && best && syllables(p.fr) < syllables(best.fr));
        if (better) { best = p; bestGain = gain; }
      }
      if (!best) break;
      chosen.push(best);
      soundTags(best.fr).forEach((t) => covered.add(t));
    }
    return chosen;
  }
  const k = li - U0_COUNT;
  if (k >= 0 && k % 3 === 2) {
    return eligible
      .map((p, idx) => ({ p, idx }))
      .sort((a, b) => syllables(a.p.fr) - syllables(b.p.fr) || nWords(a.p.fr) - nWords(b.p.fr) || a.idx - b.idx)
      .slice(0, 2).map((x) => x.p);
  }
  return [];
}

/**
 * Inserts the Say-it steps into the second (production) pass of a built lesson. Never first, never last, never in
 * review. Returns the input array itself when the lesson has no steps.
 */
export function withSpeakSteps(exs: Exercise[], lesson: Lesson): Exercise[] {
  const picks = speakPhrasesFor(lesson.id);
  if (!picks.length) return exs;
  const L = exs.length;
  const first = 1 + lesson.phrases.length;
  const at = new Map<number, Exercise[]>();
  picks.forEach((p, j) => {
    let a = Math.min(first + j, L - 2);
    const e = exs[a] as { fr?: string } | undefined;
    if (e && e.fr === p.fr && a + 1 <= L - 2) a += 1;
    const step: Exercise = { kind: "speak", fr: p.fr, en: p.en, ...(p.note ? { note: p.note } : {}) };
    at.set(a, [...(at.get(a) ?? []), step]);
  });
  const out: Exercise[] = [];
  exs.forEach((e, k) => { out.push(e); out.push(...(at.get(k) ?? [])); });
  return out;
}

/** Up to 6 phrases for a sound card, easiest and most familiar first (spec 3.2). */
export function practiceSet(tag: SoundTag, completed: string[]): Phrase[] {
  const done = new Set(completed);
  const tier = (p: Phrase) => {
    const li = POS.get(p)?.li ?? -1;
    const id = ALL_LESSONS[li]?.id ?? "";
    return id.startsWith("u0-") ? 0 : done.has(id) ? 1 : 2;
  };
  return ALL_LESSONS.flatMap((l) => l.phrases)
    .filter((p) => speakable(p.fr, 6, 10) && soundTags(p.fr).includes(tag))
    .sort((a, b) => {
      const ta = tier(a), tb = tier(b);
      if (ta !== tb) return ta - tb;
      if (ta === 1 && syllables(a.fr) !== syllables(b.fr)) return syllables(a.fr) - syllables(b.fr);
      return order(a) - order(b);
    })
    .slice(0, 6);
}
