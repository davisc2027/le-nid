import { createEmptyCard, fsrs, Rating, type Card } from "ts-fsrs";

export { Rating };
const f = fsrs();

type Stored = Record<string, unknown>;
const revive = (s: Stored): Card => ({ ...s, due: new Date(s.due as string), last_review: s.last_review ? new Date(s.last_review as string) : undefined }) as Card;

/** Next review state for a card after a rating. Pass null for a brand-new card. */
export function schedule(state: Stored | null, rating: Rating.Again | Rating.Hard | Rating.Good | Rating.Easy, now = new Date()) {
  const card = state ? revive(state) : createEmptyCard(now);
  const next = f.next(card, now, rating).card;
  return { state: JSON.parse(JSON.stringify(next)) as Stored, due: next.due.toISOString() };
}
