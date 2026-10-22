"use client";

// Lesson progress bar with Odile in her nest riding on it. She hops along as progress advances and plays
// the reaction cues the lesson sends her. She stays inside the strip reserved above the bar, between the
// bar's ends, so she never covers the quit/sound buttons, the exercise or the feedback card.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import OdileActor from "./OdileActor";
import { cue, type Cue } from "@/lib/odile-motion";

const BAR = 12; // px, progress bar height
const BAR_BOTTOM = 16; // px from the strip's bottom, so the bar centres on the 44px buttons beside it

export default function OdileTrack({ progress, play, size = 44 }: { progress: number; play?: Cue | null; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [ready, setReady] = useState(false);
  const [walk, setWalk] = useState<Cue | null>(null);
  const prev = useRef(p);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // turn the walking transition on only after the first measured placement, so she doesn't stroll in on load
  useEffect(() => {
    if (!w || ready) return;
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, [w, ready]);
  useEffect(() => {
    if (p > prev.current + 0.001) setWalk(cue("walk"));
    prev.current = p;
  }, [p]);

  // whichever cue is newer wins: a walk right after a reaction cuts it short, and vice versa
  const current = play && (!walk || play.key > walk.key) ? play : walk;
  // the nest's bottom rests just on the bar; her box is the nest plus her body above it
  const nestBottom = BAR_BOTTOM + BAR - 3;
  const boxBottom = Math.round(nestBottom - size * 0.14);
  const height = boxBottom + size + 2;
  const x = Math.max(0, w - size) * p;
  // near the start a tumble throws her forward, otherwise backward; either way she stays over the bar
  const dir = p < 0.3 ? -1 : 1;

  return (
    <div ref={ref} className="relative min-w-0 flex-1" style={{ height }}>
      <div className="absolute inset-x-0 overflow-hidden rounded-full bg-border" style={{ bottom: BAR_BOTTOM, height: BAR }}
        role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${p * 100}%` }} />
      </div>
      <div className={`odile-mover${ready ? " ready" : ""}`} style={{ bottom: boxBottom, transform: `translateX(${x}px)`, opacity: w ? 1 : 0 }}>
        <OdileActor size={size} nest play={current} dir={dir} />
      </div>
    </div>
  );
}
