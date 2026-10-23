"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lightbulb, X } from "lucide-react";
import OdileTrack from "@/components/art/OdileTrack";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import { playDone } from "@/lib/sounds";
import { practiceSet, SOUND_CARDS } from "@/lib/speech/select";
import SpeakStep from "./SpeakStep";
import { useSpeakingOn } from "./useSpeakingOn";

type View = { v: "list" } | { v: "session"; card: number; k: number } | { v: "finish"; n: number };

/** Pronunciation practice: pick a sound, then say its phrases one by one. No XP, no database writes. */
export default function SoundsPractice({ completed }: { completed: string[] }) {
  const [on, setOn] = useSpeakingOn();
  const [view, setView] = useState<View>({ v: "list" });
  const [odile, setOdile] = useState<Cue | null>(null);
  const router = useRouter();
  const taps = useRef<number[]>([]); // times of recent title taps (hidden tester entry)
  const sets = useMemo(() => SOUND_CARDS.map((c) => practiceSet(c.tag, completed)), [completed]);

  const titleTap = () => {
    const now = Date.now();
    const t = [...taps.current.filter((x) => now - x <= 3000), now];
    taps.current = t.length >= 5 ? [] : t;
    if (t.length >= 5) router.push("/french/speak-lab");
  };

  if (!on)
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <p className="card w-full">Speaking practice is turned off.</p>
        <button className="btn w-full" onClick={() => { setOn(true); setView({ v: "list" }); }}>Turn it on</button>
        <Link href="/french" className="min-h-11 px-3 text-sm text-muted underline">Back to French</Link>
      </div>
    );

  if (view.v === "finish")
    return (
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <OdileTrack progress={1} play={odile} />
        <h1 className="text-2xl font-extrabold">Bien joué !</h1>
        <p>You practised {view.n} phrases out loud.</p>
        <button className="btn w-full" onClick={() => setView({ v: "list" })}>Another sound</button>
        <Link href="/french" className="btn ghost w-full">Back to French</Link>
      </div>
    );

  if (view.v === "session") {
    const card = SOUND_CARDS[view.card];
    const phrases = sets[view.card];
    const p = phrases[view.k];
    const advance = () => {
      if (view.k + 1 < phrases.length) return setView({ v: "session", card: view.card, k: view.k + 1 });
      setOdile(cue(pickReaction("finish")));
      playDone();
      setView({ v: "finish", n: phrases.length });
    };
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-3">
          <button onClick={() => setView({ v: "list" })} aria-label="Back to the list of sounds" className="grid size-11 place-items-center text-muted"><X size={26} aria-hidden="true" /></button>
          <OdileTrack progress={view.k / phrases.length} play={odile} />
        </div>
        {view.k === 0 && (
          <p className="card flex gap-1.5 text-sm"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{card.tip}</span></p>
        )}
        <SpeakStep key={view.k} fr={p.fr} en={p.en} note={p.note} mode="practice" onDone={advance} onReact={setOdile} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/french" aria-label="Back to French" className="grid size-11 place-items-center text-muted"><X size={26} aria-hidden="true" /></Link>
        <h1 className="text-2xl font-extrabold" onClick={titleTap}>Pronunciation practice</h1>
      </div>
      <p className="text-muted">Pick a sound. Listen, say it, then compare your voice with the model.</p>
      {SOUND_CARDS.map((c, i) => (
        <button key={c.tag} className="card flex min-h-12 items-center gap-3 text-left" onClick={() => setView({ v: "session", card: i, k: 0 })}>
          <span className="flex-1">
            <span className="block font-bold">{c.label}</span>
            <span className="block text-sm text-muted">{sets[i].slice(0, 3).map((p) => p.fr).join(" · ")}</span>
          </span>
          <span className="text-sm text-muted">{sets[i].length} phrases</span>
        </button>
      ))}
    </div>
  );
}
