// Odile's motion vocabulary: what she can do, how long each takes, and pickers that never repeat
// the previous choice. Keyframes live in app/globals.css under "Odile motion"; each class there reads
// its duration from --odile-d, which OdileActor (and useOdileIdle) set from the numbers below, so the two never drift.
import type { Fx, Mood } from "@/components/art/Stork";

export type Reaction =
  // right answer
  | "jump" | "twirl" | "bounce" | "salute" | "dance" | "hearts"
  // wrong answer
  | "tumble" | "dizzy" | "shrug" | "feather" | "tear" | "slip"
  // lesson / streak finished
  | "victory" | "loop" | "confetti"
  // small utility moves
  | "walk" | "wave";

export type Idle = "blink" | "tilt" | "peck" | "ruffle" | "hop" | "look" | "legs" | "sleepy";

type Spec = { ms: number; mood: Mood; fx?: Fx };

/** Reactions stay under ~1.2s; the finish set is allowed to be bigger. */
export const REACTIONS: Record<Reaction, Spec> = {
  jump: { ms: 900, mood: "cheer" },
  twirl: { ms: 850, mood: "happy", fx: "sparkle" },
  bounce: { ms: 950, mood: "cheer", fx: "sparkle" },
  salute: { ms: 1000, mood: "happy" },
  dance: { ms: 1100, mood: "cheer" },
  hearts: { ms: 1100, mood: "happy", fx: "hearts" },
  tumble: { ms: 1200, mood: "oops" },
  dizzy: { ms: 1150, mood: "dizzy", fx: "stars" },
  shrug: { ms: 1000, mood: "oops", fx: "sweat" },
  feather: { ms: 1150, mood: "oops", fx: "feather" },
  tear: { ms: 1150, mood: "sulk" },
  slip: { ms: 950, mood: "oops" },
  victory: { ms: 1800, mood: "cheer", fx: "confetti" },
  loop: { ms: 1700, mood: "fly", fx: "sparkle" },
  confetti: { ms: 1600, mood: "cheer", fx: "confetti" },
  walk: { ms: 600, mood: "happy" },
  wave: { ms: 700, mood: "happy" },
};

export const IDLES: Record<Idle, number> = {
  blink: 450, tilt: 1500, peck: 900, ruffle: 700, hop: 600, look: 1700, legs: 2800, sleepy: 9000,
};

export const POOLS = {
  right: ["jump", "twirl", "bounce", "salute", "dance", "hearts"],
  wrong: ["tumble", "dizzy", "shrug", "feather", "tear", "slip"],
  // a wrong pair inside a matching round: small and quick, no pratfalls
  miss: ["shrug", "slip", "feather"],
  // scripture drills are the calm skin: no spinning or pratfalls
  calmRight: ["bounce", "hearts", "salute"],
  calmWrong: ["feather", "tear", "shrug"],
  finish: ["victory", "loop", "confetti"],
} satisfies Record<string, Reaction[]>;

export const IDLE_POOLS = {
  perch: ["blink", "tilt", "peck", "ruffle", "hop", "look", "legs"],
  nest: ["blink", "tilt", "peck", "ruffle", "look"],
  // streak at risk: she keeps nodding off
  sleepy: ["sleepy", "blink", "sleepy", "tilt"],
  // streak lost: quiet and a bit droopy, no hops
  sad: ["blink", "peck", "tilt"],
} satisfies Record<string, Idle[]>;

/** Random pick that is never the same as `last` (when the pool has a choice). */
export function pickFresh<T>(pool: readonly T[], last: T | null | undefined): T {
  const options = pool.length > 1 ? pool.filter((x) => x !== last) : pool;
  return options[Math.floor(Math.random() * options.length)];
}

const lastPick: Partial<Record<string, unknown>> = {};
/** pickFresh with memory per pool name, shared across screens so back-to-back lessons vary too. */
export function pickReaction(pool: keyof typeof POOLS): Reaction {
  const r = pickFresh(POOLS[pool], lastPick[pool] as Reaction | undefined);
  lastPick[pool] = r;
  return r;
}

/** Idle cadence: rare, with jitter (6 to 15 seconds). */
export const idleDelay = () => 6000 + Math.random() * 9000;

/** Idles that change the drawn pose, not just move parts. */
export const IDLE_MOOD: Partial<Record<Idle, Mood>> = { sleepy: "sleepy" };

/** Ever-increasing id so a repeated cue (two walks in a row) still restarts its CSS animation. */
let cueId = 0;
export type Cue = { name: Reaction; key: number };
export const cue = (name: Reaction): Cue => ({ name, key: ++cueId });

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
