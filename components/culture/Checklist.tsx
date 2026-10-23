"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Ban, Check } from "lucide-react";
import type { ChecklistItem } from "./data";
import { CHECK_KEY, readSet, writeSet } from "./storage";

/** "Before you go": the do and don't summary, ticked off on this device. */
export default function Checklist({ items, titles }: { items: ChecklistItem[]; titles: Record<string, string> }) {
  const [done, setDone] = useState<Set<string>>(new Set());
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ticks live in localStorage, unknown during SSR
  useEffect(() => setDone(readSet(CHECK_KEY)), []);

  function toggle(id: string) {
    const next = new Set(done);
    if (next.has(id)) next.delete(id); else next.add(id);
    setDone(next);
    writeSet(CHECK_KEY, next);
  }

  const count = items.filter((i) => done.has(i.id)).length;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-bold text-muted">{count} of {items.length} ready</p>
      {(["do", "dont"] as const).map((kind) => (
        <section key={kind} className="flex flex-col gap-2" aria-labelledby={`check-${kind}`}>
          <h2 id={`check-${kind}`} className="flex items-center gap-2 font-extrabold text-primary">
            {kind === "do" ? <Check size={20} aria-hidden="true" /> : <Ban size={20} aria-hidden="true" />}{kind === "do" ? "Do" : "Don't"}
          </h2>
          {items.filter((i) => i.kind === kind).map((i) => {
            const on = done.has(i.id);
            return (
              <div key={i.id} className={`card flex items-start gap-3 !p-3 ${on ? "opacity-70" : ""}`}>
                <button role="checkbox" aria-checked={on} aria-label={i.text} onClick={() => toggle(i.id)}
                  className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 ${on ? "border-good bg-good text-surface" : "border-border text-transparent"}`}>
                  <Check size={22} strokeWidth={3} aria-hidden="true" />
                </button>
                <div className="flex-1">
                  <p className="font-semibold">{i.text}</p>
                  <Link href={`/culture#${i.card}`} className="inline-flex min-h-11 items-center text-sm text-muted underline">Why: {titles[i.card]}</Link>
                </div>
              </div>
            );
          })}
        </section>
      ))}
      {count > 0 && (
        <button className="min-h-11 self-start px-3 text-xs text-muted underline" onClick={() => { setDone(new Set()); writeSet(CHECK_KEY, new Set()); }}>Clear my ticks</button>
      )}
    </div>
  );
}
