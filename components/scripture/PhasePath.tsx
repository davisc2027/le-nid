"use client";

import { Blocks, Check, Ear, Gem, Languages, Link2, PenLine, Puzzle } from "lucide-react";
import { PHASES } from "@/lib/scripture/mastery";

export const PHASE_ICONS = [Ear, Blocks, Link2, Puzzle, PenLine, Gem];

/** Where the English-first stage stands, when the verse has one: not started or in progress, finished. */
export type EnglishState = "active" | "done";

/**
 * One English dot, a divider, then six French dots: done (filled), current (ringed), later (outline).
 * `english` is left out for verses that skip the English stage.
 */
export function PhaseDots({ phase, mastered, english }: { phase: number; mastered?: boolean; english?: EnglishState }) {
  const inEn = english === "active";
  return (
    <div className="flex items-center gap-1.5">
      {english && (
        <>
          <span className="flex flex-col items-center gap-0.5" aria-hidden="true">
            <span className={`grid size-7 place-items-center rounded-full border-2 text-[10px] font-extrabold ${inEn ? "border-primary bg-tint text-primary" : "border-accent bg-accent text-primary-fg"}`}>
              {inEn ? "EN" : <Check size={14} strokeWidth={3} />}
            </span>
          </span>
          <span className="h-5 w-px bg-border" aria-hidden="true" />
        </>
      )}
      <ol className="flex items-center" aria-label={inEn ? `English first, then ${PHASES.length} phases in French` : `French phase ${phase + 1} of ${PHASES.length}: ${PHASES[phase].name}`}>
        <Dots phase={inEn ? -1 : phase} mastered={mastered} />
      </ol>
    </div>
  );
}

function Dots({ phase, mastered }: { phase: number; mastered?: boolean }) {
  return (
    <>
      {PHASES.map((p, i) => {
        const done = mastered || i < phase, cur = !mastered && i === phase;
        const Icon = PHASE_ICONS[i];
        return (
          <li key={p.id} className="flex items-center" aria-hidden="true">
            {i > 0 && <span className={`h-0.5 w-3 sm:w-5 ${i <= phase || mastered ? "bg-accent" : "bg-border"}`} />}
            <span className={`grid size-7 place-items-center rounded-full border-2 ${done ? "border-accent bg-accent text-primary-fg" : cur ? "border-primary bg-tint text-primary" : "border-border bg-surface text-muted"}`}>
              {done ? <Check size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.5} />}
            </span>
          </li>
        );
      })}
    </>
  );
}

/** The whole path as a list, for the start / resume screen. With `english`, an "In English" row comes first, then "Then in French". */
export function PhaseList({ phase, step, steps, mastered, english, enStep = 0, enSteps = 0 }: {
  phase: number; step: number; steps: number; mastered?: boolean; english?: EnglishState; enStep?: number; enSteps?: number;
}) {
  const inEn = english === "active";
  const rows = (
    <ol className="flex flex-col">
      {PHASES.map((p, i) => {
        const done = mastered || (!inEn && i < phase);
        const cur = !mastered && !inEn && i === phase;
        const Icon = PHASE_ICONS[i];
        return (
          <li key={p.id} className="relative flex gap-3 pb-3 last:pb-0" aria-current={cur ? "step" : undefined}>
            {i < PHASES.length - 1 && <span aria-hidden="true" className={`absolute left-[17px] top-9 bottom-0 w-0.5 ${done ? "bg-accent" : "bg-border"}`} />}
            <span aria-hidden="true" className={`z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 ${done ? "border-accent bg-accent text-primary-fg" : cur ? "border-primary bg-tint text-primary" : "border-border bg-surface text-muted"}`}>
              {done ? <Check size={18} strokeWidth={3} /> : <Icon size={18} strokeWidth={2.25} />}
            </span>
            <div className="flex min-w-0 flex-col pt-1">
              <span className={`font-extrabold ${cur ? "text-primary" : done ? "" : "text-muted"}`}>
                <span className="sr-only">{done ? "Done: " : cur ? "Current: " : ""}</span>{i + 1}. {p.name}
              </span>
              <span className="text-sm text-muted">{cur && steps > 1 && step > 0 ? `Step ${step + 1} of ${steps} · ` : ""}{p.blurb}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
  if (!english) return rows;
  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby="path-en" className="flex flex-col gap-1.5">
        <h2 id="path-en" className="label">First, in English</h2>
        <div className="flex gap-3" aria-current={inEn ? "step" : undefined}>
          <span aria-hidden="true" className={`grid size-9 shrink-0 place-items-center rounded-full border-2 ${inEn ? "border-primary bg-tint text-primary" : "border-accent bg-accent text-primary-fg"}`}>
            {inEn ? <Languages size={18} strokeWidth={2.25} /> : <Check size={18} strokeWidth={3} />}
          </span>
          <div className="flex min-w-0 flex-col pt-1">
            <span className={`font-extrabold ${inEn ? "text-primary" : ""}`}><span className="sr-only">{inEn ? "Current: " : "Done: "}</span>English warm-up</span>
            <span className="text-sm text-muted">{inEn && enSteps > 1 && enStep > 0 ? `Step ${enStep + 1} of ${enSteps} · ` : ""}Read it, build it, type it. No score, no pressure.</span>
          </div>
        </div>
      </section>
      <hr className="border-border" />
      <section aria-labelledby="path-fr" className="flex flex-col gap-2">
        <h2 id="path-fr" className="label">Then, in French</h2>
        {rows}
      </section>
    </div>
  );
}
