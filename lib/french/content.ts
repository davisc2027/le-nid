import units from "@/content/french/units.json";

/** `tu` is the informal version of a vous phrase, used only by the tu/vous exercise and accepted when typed. */
export type Phrase = { fr: string; en: string; note?: string; tu?: string };
export type Lesson = { id: string; title: string; phrases: Phrase[] };
export type Unit = { id: string; title: string; blurb: string; lessons: Lesson[] };

export const UNITS = units as Unit[];
export const ALL_PHRASES: Phrase[] = UNITS.flatMap((u) => u.lessons.flatMap((l) => l.phrases));
export const ALL_LESSONS: Lesson[] = UNITS.flatMap((u) => u.lessons);
