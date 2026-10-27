// Pure helpers for polls (no imports, so node can test them directly: npm run test:polls).

export type Poll = {
  id: string; question: string; options: string[]; multiple: boolean; anonymous: boolean;
  show_results: boolean; closes_at: string | null; closed: boolean; created_at: string;
};
export type ResultRow = { option_idx: number; votes: number | string; voters: number | string };
export type Tally = { counts: number[]; voters: number };

export const MAX_QUESTION = 300;
export const MAX_OPTION = 100;

/** Current time in ms (a function so server components can read the clock without tripping the render-purity lint). */
export const nowMs = (): number => Date.now();

/** Is the poll still accepting answers at `now` (ms)? */
export function isOpen(p: Pick<Poll, "closed" | "closes_at">, now: number): boolean {
  return !p.closed && (p.closes_at === null || Date.parse(p.closes_at) > now);
}

/** Turns poll_results rows into counts per option and the number of people who answered. */
export function toTally(rows: ResultRow[] | null | undefined, optionCount: number): Tally {
  const counts = Array.from({ length: optionCount }, () => 0);
  let voters = 0;
  for (const r of rows ?? []) {
    if (r.option_idx >= 0 && r.option_idx < optionCount) counts[r.option_idx] = Number(r.votes) || 0;
    voters = Math.max(voters, Number(r.voters) || 0);
  }
  return { counts, voters };
}

/**
 * Whole-number percentages for the bars.
 * Single answer: each option's share of all answers, rounded with the largest remainder method so the bars always total exactly 100.
 * Several answers allowed: each option's share of the people who answered (these overlap, so they can total more than 100).
 */
export function percentages(counts: number[], voters: number, multiple: boolean): number[] {
  if (multiple) return counts.map((c) => (voters > 0 ? Math.round((100 * c) / voters) : 0));
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (100 * c) / total);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) out[order[k].i]++;
  return out;
}

/** "3 of 8 answered (38%)" style rate; 0 when nobody is expected. */
export function rate(voters: number, expected: number): number {
  return expected > 0 ? Math.round((100 * voters) / expected) : 0;
}

/** Offset of Europe/Paris from UTC in minutes at the given instant. */
function parisOffsetMin(at: Date): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" })
    .formatToParts(at).find((x) => x.type === "timeZoneName")?.value ?? "GMT+1";
  const m = part.match(/GMT([+-])(\d+)(?::(\d+))?/);
  return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 60;
}

/** The last second of a calendar day (YYYY-MM-DD) in Paris time, as an ISO string; null if the date is not valid. */
export function parisEndOfDay(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const base = new Date(`${day}T23:59:59Z`);
  if (Number.isNaN(base.getTime())) return null;
  return new Date(base.getTime() - parisOffsetMin(base) * 60_000).toISOString();
}
