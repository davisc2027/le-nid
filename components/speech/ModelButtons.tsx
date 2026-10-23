"use client";

import { useEffect, useState } from "react";
import { Turtle, Volume2 } from "lucide-react";
import { playModel, stopAll, type Players } from "@/lib/speech/playback";
import { loadManifest, preferredVoice, setPreferredVoice, voicesFor } from "@/lib/speech/refs";

/** Listen / Slow, plus a woman/man switch when both volunteer voices exist for this phrase. */
export default function ModelButtons({ fr, getPlayers, onUnavailable }: { fr: string; getPlayers: () => Players; onUnavailable?: () => void }) {
  const [voices, setVoices] = useState<string[]>([]);
  const [gender, setGender] = useState<"f" | "m">("f");
  useEffect(() => {
    let live = true;
    loadManifest().then((m) => { if (live) { setVoices(voicesFor(m, fr)); setGender(preferredVoice()[0] === "m" ? "m" : "f"); } });
    return () => { live = false; };
  }, [fr]);

  const both = voices.some((v) => v[0] === "f") && voices.some((v) => v[0] === "m");
  const voice = voices.find((v) => v[0] === gender);

  const play = async (slow: boolean) => {
    const p = getPlayers();
    stopAll(p);
    if (!(await playModel(p, fr, { slow, voice }))) onUnavailable?.();
  };
  const toggle = () => {
    const next = gender === "f" ? "m" : "f";
    setGender(next);
    const v = voices.find((x) => x[0] === next);
    if (v) setPreferredVoice(v);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn" onClick={() => play(false)} aria-label="Play audio" data-testid="model-listen"><Volume2 size={18} aria-hidden="true" /> Listen</button>
      <button className="btn ghost" onClick={() => play(true)} aria-label="Play slowly" data-testid="model-slow"><Turtle size={18} aria-hidden="true" /> Slow</button>
      {both && (
        <button className="min-h-11 px-3 text-sm text-muted underline" onClick={toggle} aria-label="Switch voice">
          Voice: {gender === "f" ? "woman" : "man"}
        </button>
      )}
    </div>
  );
}
