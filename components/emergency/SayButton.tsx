"use client";

import { useState } from "react";
import { Volume2 } from "lucide-react";
import { speak } from "@/lib/french/speech";

/** A French phrase to say, with a button that reads it aloud using the phone's French voice. Works offline. */
export default function SayButton({ fr, en }: { fr: string; en: string }) {
  const [warn, setWarn] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => setWarn(!speak(fr, false))} aria-label={`Say aloud in French: ${fr}`}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-tint text-primary">
        <Volume2 size={20} aria-hidden="true" />
      </button>
      <p className="min-w-0 text-sm"><span lang="fr" className="block text-base font-bold">{fr}</span><span className="text-muted">{en}</span>{warn && <span className="block text-xs text-muted">No sound on this phone. Show the words instead.</span>}</p>
    </div>
  );
}
