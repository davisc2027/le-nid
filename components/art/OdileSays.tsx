"use client";

import { useEffect, useState } from "react";
import { type Mood } from "./Stork";
import OdileActor, { type IdlePool } from "./OdileActor";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import { GENTLE_KEY, pickLine, type Topic } from "@/lib/odile";

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA").format(d); // viewer's own timezone

/** Streak to show: 0 once the last practice day is older than yesterday. */
export function liveStreak(current: number | null | undefined, lastDay: string | null | undefined) {
  if (!current || !lastDay) return 0;
  return lastDay >= dayKey(new Date(Date.now() - 86_400_000)) ? current : 0;
}

export function StreakCount({ current, lastDay }: { current?: number | null; lastDay?: string | null }) {
  const [n, setN] = useState(current ?? 0);
  useEffect(() => setN(liveStreak(current, lastDay)), [current, lastDay]);
  return <>{n}</>;
}

/** Odile with a speech bubble. Picks the line after mount so server and client markup match.
 *  She idles to suit the moment (dozing when the streak is at risk, droopy when it was lost) and greets
 *  with a small gesture; `celebrate` plays a big finish instead (lesson and verse completion). */
export default function OdileSays({ topic, mood = "happy", size = 84, trigger, lastDay, celebrate = false }: { topic: Topic; mood?: Mood; size?: number; trigger?: unknown; lastDay?: string | null; celebrate?: boolean }) {
  const [line, setLine] = useState("");
  const [m, setM] = useState(mood);
  const [idle, setIdle] = useState<IdlePool>("perch");
  const [play, setPlay] = useState<Cue | null>(null);
  useEffect(() => {
    let gentle = false;
    try { gentle = localStorage.getItem(GENTLE_KEY) === "1"; } catch {}
    let t = topic, md = mood;
    if (lastDay !== undefined) { // streak-based topic, decided in the viewer's timezone
      const today = dayKey(new Date()), yesterday = dayKey(new Date(Date.now() - 86_400_000));
      if (lastDay === today) { t = "idle"; md = "cheer"; }
      else if (lastDay === yesterday) { t = "streakRisk"; md = "think"; }
      else if (lastDay) { t = "missed"; md = "sulk"; }
    }
    // Intentional: depends on the viewer's timezone and localStorage, unknown during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setM(md);
    setLine(pickLine(t, gentle));
    setIdle(t === "streakRisk" ? "sleepy" : t === "missed" ? "sad" : "perch");
    if (celebrate) setPlay(cue(pickReaction("finish")));
    else if (t === "welcome" || t === "idle") setPlay(cue("wave"));
  }, [topic, mood, lastDay, trigger, celebrate]);
  return (
    // celebrating, she jumps up to ~35% of her height: reserve that space so she never crosses the text above
    <div className="flex items-end gap-2" style={celebrate ? { paddingTop: Math.round(size * 0.36) } : undefined}>
      <span role="img" aria-label="Odile the stork" className="flex"><OdileActor mood={m} size={size} idle={idle} play={play} /></span>
      <p className="card relative mb-3 min-h-12 flex-1 text-sm font-semibold" aria-live="polite">{line}</p>
    </div>
  );
}
