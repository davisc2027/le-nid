"use client";

import { useEffect, useRef, useState } from "react";

/** Everyone (default) or Individuals. Individuals opens a dropdown of approved people to tick. Submits `audience` and `assign`. */
export default function AssignPicker({ people, chosen = [] }: { people: { id: string; label: string }[]; chosen?: string[] }) {
  const [mode, setMode] = useState<"everyone" | "individuals">(chosen.length ? "individuals" : "everyone");
  const [picked, setPicked] = useState<string[]>(chosen);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // The create form resets after a successful save; put the picker back to its defaults too.
    const form = root.current?.closest("form");
    const reset = () => { setMode(chosen.length ? "individuals" : "everyone"); setPicked(chosen); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [chosen]);
  const tab = (on: boolean) => `min-h-11 flex-1 rounded-xl border px-3 text-sm font-bold ${on ? "border-primary bg-primary text-primary-fg" : "border-border bg-card"}`;
  return (
    <div ref={root} className="flex flex-col gap-2">
      <input type="hidden" name="audience" value={mode} />
      <div className="flex gap-2" role="group" aria-label="Who is this for">
        <button type="button" className={tab(mode === "everyone")} aria-pressed={mode === "everyone"} onClick={() => setMode("everyone")}>Everyone</button>
        <button type="button" className={tab(mode === "individuals")} aria-pressed={mode === "individuals"} onClick={() => setMode("individuals")}>Individuals</button>
      </div>
      {mode === "individuals" && (
        <details className="rounded-xl border border-border px-3 text-sm" open={!picked.length}>
          <summary className="min-h-11 cursor-pointer py-2 font-semibold">{picked.length ? `${picked.length} selected` : "Choose people"}</summary>
          <div className="flex max-h-60 flex-col overflow-y-auto pb-2">
            {people.map((p) => (
              <label key={p.id} className="flex min-h-11 items-center gap-2">
                <input type="checkbox" name="assign" value={p.id} checked={picked.includes(p.id)}
                  onChange={(e) => setPicked((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))} /> {p.label}
              </label>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
