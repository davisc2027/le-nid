"use client";

import { useEffect, useState } from "react";
import Stork, { type Mood } from "./Stork";
import { GENTLE_KEY, pickLine, type Topic } from "@/lib/odile";

/** Odile with a speech bubble. Picks the line after mount so server and client markup match. */
export default function OdileSays({ topic, mood = "happy", size = 84, trigger }: { topic: Topic; mood?: Mood; size?: number; trigger?: unknown }) {
  const [line, setLine] = useState("");
  useEffect(() => {
    let gentle = false;
    try { gentle = localStorage.getItem(GENTLE_KEY) === "1"; } catch {}
    setLine(pickLine(topic, gentle));
  }, [topic, trigger]);
  return (
    <div className="flex items-end gap-2">
      <Stork mood={mood} size={size} label="Odile the stork" />
      <p className="card relative mb-3 min-h-12 flex-1 text-sm font-semibold" aria-live="polite">{line}</p>
    </div>
  );
}
