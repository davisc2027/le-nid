"use client";

import { Blocks, Check, Ear, Gem, Link2, PenLine, Puzzle } from "lucide-react";
import { PHASES } from "@/lib/scripture/mastery";

export const PHASE_ICONS = [Ear, Blocks, Link2, Puzzle, PenLine, Gem];

/** Six linked dots, one per phase: done (filled), current (ringed), later (outline). */
export function PhaseDots({ phase, mastered }: { phase: number; mastered?: boolean }) {
  return (
    <ol className="flex items-center" aria-label={`Phase ${phase + 1} of ${PHASES.length}: ${PHASES[phase].name}`}>
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
    </ol>
  );
}

/** The whole path as a list, for the start / resume screen. */
export function PhaseList({ phase, step, steps, mastered }: { phase: number; step: number; steps: number; mastered?: boolean }) {
  return (
    <ol className="flex flex-col">
      {PHASES.map((p, i) => {
        const done = mastered || i < phase;
        const cur = !mastered && i === phase;
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
}
