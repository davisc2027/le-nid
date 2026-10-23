// The path to mastering a verse: six phases, each a short list of steps built from the verse's chunks.
// Pure logic (no React, no storage), so scripts/check-verses.mjs can test it.
//
//   1 Listen and read   hear each chunk with its meaning, then the whole verse            (exposure, no testing)
//   2 Build the chunks  per chunk: fill the blanks (a second, harder pass for 7+ words), then order its words (errorless)
//   3 Chain             chunk 1+2, then 1+2+3...: first letters as cues, then no cues       (cumulative chaining)
//   4 Reassemble        put the chunks in order, then type the gaps across the whole verse (desirable difficulty)
//   5 Recall            type it all from memory; first-letter hint costs a level           (counts as "learned")
//   6 Cement            a retest after a delay (10 minutes or the next visit)              (counts as "mastered")

export const PHASES = [
  { id: "listen", name: "Listen and read", blurb: "Hear it chunk by chunk, with the meaning." },
  { id: "build", name: "Build the chunks", blurb: "Learn each chunk on its own." },
  { id: "chain", name: "Chain them", blurb: "Link chunk to chunk, with fewer cues each time." },
  { id: "reassemble", name: "Reassemble", blurb: "Order the chunks, then fill the gaps." },
  { id: "recall", name: "Recall", blurb: "Type the whole verse from memory." },
  { id: "cement", name: "Cement", blurb: "A short retest later, to make it stick." },
] as const;
export const RECALL = 4;
export const CEMENT = 5;
/** Minutes between passing Recall and the Cement retest. FSRS also brings a new card back after about 10 minutes. */
export const CEMENT_DELAY_MIN = 10;

export type Step =
  | { kind: "listen"; chunk: number }
  | { kind: "listenAll" }
  | { kind: "cloze"; chunk: number; ratio: number; level: 1 | 2 }
  | { kind: "order"; chunk: number }
  | { kind: "chain"; upto: number; cue: "letters" | "none" }
  | { kind: "orderChunks" }
  | { kind: "gaps" }
  | { kind: "recall" }
  | { kind: "cement" };

/** The steps of one phase for a verse whose chunks have `sizes` words each. */
export function planPhase(phase: number, sizes: number[]): Step[] {
  const k = sizes.length;
  switch (phase) {
    case 0: return [...sizes.map((_, chunk) => ({ kind: "listen" as const, chunk })), { kind: "listenAll" }];
    case 1: return sizes.flatMap((n, chunk): Step[] => [
      { kind: "cloze", chunk, ratio: n >= 7 ? 0.34 : 0.4, level: 1 },
      ...(n >= 7 ? [{ kind: "cloze", chunk, ratio: 0.7, level: 2 } as Step] : []), // long chunks get a harder pass
      ...(n >= 2 ? [{ kind: "order", chunk } as Step] : []),
    ]);
    case 2: return k < 2
      ? [{ kind: "chain", upto: 0, cue: "letters" }, { kind: "chain", upto: 0, cue: "none" }]
      : Array.from({ length: k - 1 }, (_, j): Step[] => [{ kind: "chain", upto: j + 1, cue: "letters" }, { kind: "chain", upto: j + 1, cue: "none" }]).flat();
    case 3: return k < 2 ? [{ kind: "gaps" }] : [{ kind: "orderChunks" }, { kind: "gaps" }];
    case 4: return [{ kind: "recall" }];
    case 5: return [{ kind: "cement" }];
    default: return [];
  }
}

export type Progress = {
  v: 1;
  /** 0-5, index into PHASES. */
  phase: number;
  /** Step index inside the phase (for phases 2-3 this is the per-chunk position). */
  step: number;
  /** Chunk word counts this progress was made with, e.g. "6-6-5-3-6". If the split changes, the phase restarts. */
  sig: string;
  /** Phase 5 (Recall): a hint was used or an attempt failed, so the pass is rated Hard. */
  hint?: boolean;
  fails?: number;
  /** When Recall was passed (the verse counts as learned). */
  learnedAt?: string;
  /** When the Cement retest opens. */
  cementAt?: string;
  /** When the Cement retest was passed (the verse counts as mastered). */
  masteredAt?: string;
  updatedAt: string;
};

export const sigOf = (sizes: number[]) => sizes.join("-");

export const fresh = (sizes: number[], now = new Date()): Progress => ({ v: 1, phase: 0, step: 0, sig: sigOf(sizes), updatedAt: now.toISOString() });

const isoOk = (x: unknown): x is string => typeof x === "string" && x.length <= 40 && !Number.isNaN(Date.parse(x));

/** Validates stored progress (from localStorage or the database). Anything malformed becomes null. */
export function parseProgress(raw: unknown): Progress | null {
  let o = raw;
  if (typeof o === "string") { try { o = JSON.parse(o); } catch { return null; } }
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const r = o as Record<string, unknown>;
  if (r.v !== 1 || !Number.isInteger(r.phase) || !Number.isInteger(r.step) || typeof r.sig !== "string" || !isoOk(r.updatedAt)) return null;
  const phase = r.phase as number, step = r.step as number;
  if (phase < 0 || phase > CEMENT || step < 0 || step > 200 || r.sig.length > 40) return null;
  const p: Progress = { v: 1, phase, step, sig: r.sig, updatedAt: r.updatedAt };
  if (r.hint === true) p.hint = true;
  if (Number.isInteger(r.fails) && (r.fails as number) > 0) p.fails = Math.min(r.fails as number, 99);
  if (isoOk(r.learnedAt)) p.learnedAt = r.learnedAt;
  if (isoOk(r.cementAt)) p.cementAt = r.cementAt;
  if (isoOk(r.masteredAt)) p.masteredAt = r.masteredAt;
  return p;
}

/** Compact JSON-safe object for storage (drops empty fields). */
export function serialize(p: Progress): Record<string, unknown> {
  return JSON.parse(JSON.stringify(p));
}

/** The more recently updated of two saved progress records. */
export function newest(a: Progress | null, b: Progress | null): Progress | null {
  if (!a || !b) return a ?? b;
  return Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a;
}

/**
 * Where to start: saved progress fitted to the current chunks. A verse learned before this feature (learned_at set,
 * no progress) starts at the Cement retest. If the chunk split changed, the chunk-based phase restarts at its first step.
 */
export function resolve(saved: Progress | null, sizes: number[], learnedAt: string | null, now = new Date()): Progress {
  const sig = sigOf(sizes);
  if (!saved) {
    if (learnedAt) return { v: 1, phase: CEMENT, step: 0, sig, learnedAt, cementAt: learnedAt, updatedAt: now.toISOString() };
    return fresh(sizes, now);
  }
  const p = { ...saved };
  if (p.sig !== sig) { p.sig = sig; if (p.phase < RECALL) p.step = 0; }
  if (p.step >= planPhase(p.phase, sizes).length) p.step = 0;
  return p;
}

/** After a passed step: the next step, moving to the next phase at the end of one. Never moves past Cement. */
export function advance(p: Progress, sizes: number[], now = new Date()): Progress {
  const len = planPhase(p.phase, sizes).length;
  const next = p.step + 1 < len ? { ...p, step: p.step + 1 } : { ...p, phase: Math.min(p.phase + 1, CEMENT), step: 0 };
  return { ...next, updatedAt: now.toISOString() };
}

/** Recall passed and saved: the verse is learned; the Cement retest opens after the delay. */
export function markLearned(p: Progress, now = new Date()): Progress {
  const rest = { ...p };
  delete rest.hint;
  delete rest.fails;
  return { ...rest, phase: CEMENT, step: 0, learnedAt: now.toISOString(), cementAt: new Date(now.getTime() + CEMENT_DELAY_MIN * 60_000).toISOString(), updatedAt: now.toISOString() };
}

/** Cement retest result: a clean pass masters the verse; a hint or a miss schedules another retest after the delay. */
export function markCement(p: Progress, clean: boolean, now = new Date()): Progress {
  if (clean) return { ...p, phase: CEMENT, step: 0, masteredAt: now.toISOString(), updatedAt: now.toISOString() };
  return { ...p, phase: CEMENT, step: 0, cementAt: new Date(now.getTime() + CEMENT_DELAY_MIN * 60_000).toISOString(), updatedAt: now.toISOString() };
}

/**
 * A clean pass in a normal review session (no hint) also counts as the Cement retest, once the retest is open.
 * Returns the new progress, or null when nothing changes. Verses learned before the path existed have no progress
 * yet: a clean review masters them too.
 */
export function cementFromReview(p: Progress | null, learnedAt: string | null, now = new Date()): Progress | null {
  if (!p) return learnedAt ? markCement({ v: 1, phase: CEMENT, step: 0, sig: "", learnedAt, updatedAt: now.toISOString() }, true, now) : null;
  if (p.phase !== CEMENT || p.masteredAt) return null;
  if (p.cementAt && Date.parse(p.cementAt) > now.getTime()) return null;
  return markCement(p, true, now);
}

/** Start the path again from Phase 1 (keeps the learned/mastered dates, so practising never loses a status). */
export const restart = (p: Progress, sizes: number[], now = new Date()): Progress =>
  ({ ...fresh(sizes, now), learnedAt: p.learnedAt, masteredAt: p.masteredAt });

/** 0..1 along the whole path. A mastered verse is 1. */
export function fraction(p: Progress, sizes: number[]): number {
  if (p.masteredAt && p.phase === CEMENT) return 1;
  const len = Math.max(1, planPhase(p.phase, sizes).length);
  return Math.min(1, (p.phase + p.step / len) / PHASES.length);
}

/** Rough 0..1 progress when the chunk sizes are not known (verse list, Rosace): whole phases plus half a phase once started. */
export const roughFraction = (p: Progress | null) =>
  !p ? 0 : p.masteredAt ? 1 : Math.min(1, (p.phase + (p.step > 0 ? 0.5 : 0)) / PHASES.length);

export type Status =
  | { kind: "new" }
  | { kind: "learning"; phase: number }
  | { kind: "wait"; at: Date }
  | { kind: "retest" }
  | { kind: "mastered" };

/** What the verse list and the path screen show. `learnedAt` is srs_cards.learned_at. */
export function statusOf(p: Progress | null, learnedAt: string | null, now = new Date()): Status {
  if (!p) return learnedAt ? { kind: "retest" } : { kind: "new" };
  if (p.masteredAt) return { kind: "mastered" }; // practising a mastered verse again never takes the status away
  if (p.phase === CEMENT) {
    const at = p.cementAt ? new Date(p.cementAt) : now;
    return at > now ? { kind: "wait", at } : { kind: "retest" };
  }
  if (p.phase === 0 && p.step === 0 && !learnedAt && !p.learnedAt) return { kind: "new" };
  return { kind: "learning", phase: p.phase };
}

/** Phase 4 gaps: one blank per chunk line (two in lines of 7+ words), preferring words of 4+ letters. Keys are "line:token". */
export function pickGaps(lines: { say: string; word: boolean }[][], rand: () => number = Math.random): Set<string> {
  const out = new Set<string>();
  lines.forEach((line, li) => {
    const cands = line.map((t, ti) => ({ t, ti })).filter(({ t }) => t.word && t.say.replace(/'/g, "").length >= 4);
    const pool = cands.length ? cands : line.map((t, ti) => ({ t, ti })).filter(({ t }) => t.word);
    const want = line.filter((t) => t.word).length >= 7 ? 2 : 1;
    const shuffled = [...pool].sort(() => rand() - 0.5);
    for (const c of shuffled.slice(0, want)) out.add(`${li}:${c.ti}`);
  });
  return out;
}
