// The culture and etiquette layer: content/french/culture.json, typed. See docs/culture-track.md.
// Checked by scripts/check-curriculum.mjs (ids, lesson and phrase references, sources, question shape).
import culture from "@/content/french/culture.json";

export type CardType = "fact" | "etiquette" | "history" | "faith-context" | "alsace";
export type Theme = { id: string; title: string; blurb: string };
export type CultureCard = {
  id: string;
  type: CardType;
  theme: string;
  title: string;
  /** 2 to 4 short sentences, plain English. */
  text: string;
  /** A French phrase that ties the point to language; `fr` is the exact text of a units.json phrase unless `extra`. */
  phrase?: { fr: string; gloss: string; extra?: boolean };
  unit: string;
  /** The lesson whose intro or completion screen shows this card (at most one card per lesson). */
  lesson?: string;
  moment?: "intro" | "done";
  /** Odile's line; `odileSass` replaces it unless gentle mode is on. */
  odile?: string;
  odileSass?: string;
  source: string[];
  /** Needs confirmation by a native speaker, a leader, or both before the trip. */
  review?: "native" | "leader" | "both";
  reviewNote?: string;
};
export type Question = {
  id: string;
  card: string;
  scenario: string;
  options: string[];
  /** Index of the one correct option. */
  answer: number;
  explain: string;
  fact?: string;
};
export type ChecklistItem = { id: string; kind: "do" | "dont"; text: string; card: string };

const data = culture as { themes: Theme[]; cards: CultureCard[]; questions: Question[]; checklist: ChecklistItem[] };

export const THEMES = data.themes;
export const CARDS = data.cards;
export const QUESTIONS = data.questions;
export const CHECKLIST = data.checklist;
export const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));

/** The card shown in a lesson's intro or on its completion screen, if any. */
export function cardForLesson(lessonId: string, moment: "intro" | "done"): CultureCard | undefined {
  return CARDS.find((c) => c.lesson === lessonId && c.moment === moment);
}

export const TYPE_LABEL: Record<CardType, string> = {
  fact: "Fun fact",
  etiquette: "Etiquette",
  history: "History",
  "faith-context": "Faith context",
  alsace: "Alsace",
};
