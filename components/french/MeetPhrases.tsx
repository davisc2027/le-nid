"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronLeft, Lightbulb } from "lucide-react";
import { ALL_LESSONS, type Phrase } from "@/lib/french/content";
import { refLabel } from "@/lib/bible/reference";
import { speak } from "@/lib/french/speech";
import TapWords from "@/components/scripture/TapWords";
import CultureNote from "@/components/culture/CultureNote";
import Speaker from "./Speaker";

/**
 * "Meet the phrases": one card per new phrase (French, audio, English, the note, the tu form when there is one)
 * before any question, so a first exposure is teaching rather than guessing. Next speaks the following phrase
 * (it runs inside the tap, which iOS needs for audio); Skip jumps straight to the exercises.
 */
export default function MeetPhrases({ phrases, onDone }: { phrases: Phrase[]; onDone: () => void }) {
  const [k, setK] = useState(0);
  const p = phrases[k];
  const last = k === phrases.length - 1;
  const go = (n: number) => { setK(n); speak(phrases[n].fr); };
  // verse lessons name their Bible verse; the hint links to the memory drill for it
  const lesson = ALL_LESSONS.find((l) => l.phrases[0]?.fr === phrases[0]?.fr);
  const verse = lesson?.verse;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="label">New phrase {k + 1} of {phrases.length}</p>
        <button className="min-h-11 px-3 text-sm text-muted underline" onClick={onDone}>Skip intro</button>
      </div>
      {verse && k === 0 && (
        <Link href={`/scripture/learn?ref=${encodeURIComponent(verse)}`} className="flex items-center gap-1.5 self-start text-sm text-muted underline">
          <BookOpen size={16} className="shrink-0 text-accent" aria-hidden="true" />Words from {refLabel(verse)} · learn the verse by heart
        </Link>
      )}
      {/* the lesson's "À savoir" culture card, if it has one before the phrases: folded, one tap to read */}
      {lesson && k === 0 && <CultureNote lessonId={lesson.id} moment="intro" />}
      <div key={k} className="card flex flex-col gap-3">
        <TapWords text={p.fr} className="text-2xl font-extrabold" />
        <p className="text-lg font-semibold">{p.en}</p>
        <Speaker text={p.fr} />
        {p.tu && <p className="text-sm text-muted">With a friend your age: <b lang="fr" className="text-foreground">{p.tu}</b></p>}
        {p.note && <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{p.note}</span></p>}
      </div>
      <div className="flex gap-2">
        {k > 0 && (
          <button className="btn ghost" onClick={() => go(k - 1)} aria-label="Previous phrase"><ChevronLeft size={20} aria-hidden="true" /></button>
        )}
        <button className="btn flex-1" onClick={() => (last ? onDone() : go(k + 1))}>{last ? "Start the exercises" : "Next"}</button>
      </div>
    </div>
  );
}
