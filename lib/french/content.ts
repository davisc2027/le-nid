import units from "@/content/french/units.json";

export type Phrase = { fr: string; en: string; note?: string };
export type Lesson = { id: string; title: string; phrases: Phrase[] };
export type Unit = { id: string; title: string; blurb: string; lessons: Lesson[] };

export const UNITS = units as Unit[];
export const ALL_PHRASES: Phrase[] = UNITS.flatMap((u) => u.lessons.flatMap((l) => l.phrases));
export const ALL_LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);
