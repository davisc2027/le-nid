"use client";

import { useState } from "react";
import { Turtle, Volume2 } from "lucide-react";
import { speak } from "@/lib/french/speech";

/** Listen / Slow buttons for a French phrase, with a hint when the device has no speech. */
export default function Speaker({ text }: { text: string }) {
  const [warn, setWarn] = useState(false);
  const play = (slow: boolean) => setWarn(!speak(text, slow));
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => play(false)} aria-label="Play audio"><Volume2 size={18} aria-hidden="true" /> Listen</button>
      <button className="btn ghost" onClick={() => play(true)} aria-label="Play slowly"><Turtle size={18} aria-hidden="true" /> Slow</button>
      {warn && <span className="text-xs text-muted">Audio is not available on this device.</span>}
      {!warn && <span className="text-xs text-muted">No sound? Flip the silent switch off.</span>}
    </div>
  );
}
