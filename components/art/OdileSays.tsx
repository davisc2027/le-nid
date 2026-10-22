"use client";

import { useEffect, useState } from "react";
import Stork, { type Mood } from "./Stork";
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

/** Odile with a speech bubble. Picks the line after mount so server and client markup match. */
export default function OdileSays({ topic, mood = "happy", size = 84, trigger, lastDay }: { topic: Topic; mood?: Mood; size?: number; trigger?: unknown; lastDay?: string | null }) {
  const [line, setLine] = useState("");
  const [m, setM] = useState(mood);
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
    setM(md);
    setLine(pickLine(t, gentle));
  }, [topic, mood, lastDay, trigger]);
  return (
    <div className="flex items-end gap-2">
      <Stork mood={m} size={size} label="Odile the stork" />
      <p className="card relative mb-3 min-h-12 flex-1 text-sm font-semibold" aria-live="polite">{line}</p>
    </div>
  );
}
