"use client";

import { useState } from "react";
import Link from "next/link";
import { Maximize2 } from "lucide-react";
import { STEP_IDS, type GospelContent, type Lang } from "@/lib/gospel";
import CirclesDiagram from "./CirclesDiagram";
import { UI, VerseChips, VerseSheet } from "./shared";

export const labelsOf = (c: GospelContent, lang: Lang) => ({
  design: c.circles.design[lang], brokenness: c.circles.brokenness[lang], gospel: c.circles.gospel[lang],
  believe: c.arrows.believe[lang], recover: c.arrows.recover[lang],
});

/** The circles build up one step at a time, with what to say, the verse to open, and a full-screen "Show them". */
export default function CirclesWatch({ content, lang, startStep }: { content: GospelContent; lang: Lang; startStep: number }) {
  const [i, setI] = useState(Math.min(Math.max(startStep, 0), STEP_IDS.length - 1));
  const [verse, setVerse] = useState<string | null>(null);
  const t = UI[lang];
  const step = content.steps[STEP_IDS[i]];
  const last = i === STEP_IDS.length - 1;
  return (
    <>
      <CirclesDiagram step={i} lang={lang} labels={labelsOf(content, lang)} className="mx-auto max-h-[38svh] landscape:max-h-[70svh]" />
      <section className="rounded-2xl border border-border bg-surface px-4 py-3" aria-live="polite" lang={lang}>
        <p className="text-xs font-extrabold uppercase text-primary">{step.title[lang]}</p>
        <p className="mt-1 text-base leading-snug">{step.say[lang]}</p>
        {i === 0 && <p className="mt-2 text-sm text-muted">{content.intro[lang]}</p>}
        {last && content.closing[0] && <p className="mt-2 text-sm font-bold"><span className="text-muted">{t.ask}: </span>{content.closing[0][lang]}</p>}
        <VerseChips verses={step.verses} lang={lang} onOpen={setVerse} />
      </section>
      <div className="flex justify-center gap-1.5" role="group" aria-label={`${i + 1} / ${STEP_IDS.length}`}>
        {STEP_IDS.map((id, n) => (
          <button key={id} type="button" aria-label={`${t.step} ${n + 1}`} aria-current={n === i} onClick={() => setI(n)} className="grid h-11 place-items-center px-0.5">
            <span className={`block h-2.5 rounded-full transition-all motion-reduce:transition-none ${n === i ? "w-6 bg-primary" : "w-2.5 bg-border"}`} />
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn ghost flex-1" disabled={i === 0} onClick={() => setI(i - 1)}>{t.back}</button>
        <button type="button" className="btn flex-1" onClick={() => setI(last ? 0 : i + 1)}>{last ? t.again : t.next}</button>
      </div>
      <Link href={`/learn/three-circles/show?step=${i}`} className="btn ghost w-full"><Maximize2 size={18} aria-hidden="true" />{t.show}</Link>
      {verse && <VerseSheet key={verse} verse={verse} lang={lang} onClose={() => setVerse(null)} />}
    </>
  );
}
