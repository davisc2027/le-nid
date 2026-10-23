import Link from "next/link";
import { ChevronLeft, CircleHelp, ListChecks } from "lucide-react";
import { UNITS } from "@/lib/french/content";
import { CARDS, THEMES } from "@/components/culture/data";
import CultureLibrary, { type LibraryTheme } from "@/components/culture/CultureLibrary";

// Where each card sits in the course, e.g. "after Hello and goodbye (Bonjour !)" or "before Who we are".
const lessonInfo = new Map(UNITS.flatMap((u) => u.lessons.map((l) => [l.id, { lesson: l.title, unit: u.title }])));
const unitTitle = new Map(UNITS.map((u) => [u.id, u.title]));

export default function Culture() {
  const themes: LibraryTheme[] = THEMES.map((t) => ({
    ...t,
    cards: CARDS.filter((c) => c.theme === t.id).map((c) => {
      const info = c.lesson ? lessonInfo.get(c.lesson) : undefined;
      const where = info
        ? `${c.moment === "intro" ? "before" : "after"} the lesson ${info.lesson} (${info.unit})`
        : `goes with the unit ${unitTitle.get(c.unit) ?? c.unit}`;
      return { ...c, where };
    }),
  }));
  return (
    <div className="flex flex-col gap-4">
      <Link href="/learn" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-muted"><ChevronLeft size={18} aria-hidden="true" />Learn</Link>
      <div>
        <p className="label">À savoir</p>
        <h1 className="text-2xl font-extrabold">Culture</h1>
        <p className="mt-1 text-sm text-muted">What to know walking into Strasbourg: etiquette, faith context, history and Alsatian life. Cards also appear in the French lessons at the right moment.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link href="/culture/quiz" className="btn"><CircleHelp size={18} aria-hidden="true" />Quiz</Link>
        <Link href="/culture/checklist" className="btn ghost"><ListChecks size={18} aria-hidden="true" />Before you go</Link>
      </div>
      <CultureLibrary themes={themes} />
    </div>
  );
}
