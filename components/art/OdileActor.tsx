"use client";

// Odile, animated. Wraps the static <Stork> drawing with idle micro-movements and one-shot reactions.
// All motion is CSS (app/globals.css, "Odile motion"); this file only picks what plays and for how long.
import { useEffect, useState, type CSSProperties } from "react";
import Stork, { Nest, type Mood } from "./Stork";
import { IDLE_MOOD, IDLE_POOLS, IDLES, REACTIONS, idleDelay, pickFresh, reducedMotion, type Cue, type Idle } from "@/lib/odile-motion";

export type IdlePool = keyof typeof IDLE_POOLS;

/**
 * Schedules one idle at a time, 6 to 15 s apart with jitter. Stops while the tab is hidden, while `paused`
 * (e.g. during a reaction) and entirely under prefers-reduced-motion.
 * Returns the class and style to put on any ancestor of the stork's SVG (or on the SVG itself).
 */
export function useOdileIdle(pool: IdlePool | null, paused = false) {
  const [idle, setIdle] = useState<Idle | null>(null);
  useEffect(() => {
    if (!pool || paused || reducedMotion()) return;
    const list: readonly Idle[] = IDLE_POOLS[pool];
    let t: number | undefined;
    let last: Idle | null = null;
    const schedule = () => {
      window.clearTimeout(t);
      if (!document.hidden) t = window.setTimeout(play, idleDelay());
    };
    const play = () => {
      const next = pickFresh(list, last);
      last = next;
      setIdle(next);
      t = window.setTimeout(() => { setIdle(null); schedule(); }, IDLES[next]);
    };
    const onVisibility = () => {
      window.clearTimeout(t);
      setIdle(null);
      schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisibility);
      setIdle(null);
    };
  }, [pool, paused]);
  const active = paused ? null : idle;
  return {
    idle: active,
    className: active ? `odile-i-${active}` : "",
    style: (active ? { "--odile-d": `${IDLES[active]}ms` } : {}) as CSSProperties,
  };
}

/**
 * Animated Odile. Decorative: aria-hidden, never takes pointer events. Give her text a home elsewhere.
 * - `play`: a cue from lib/odile-motion (cue("jump")); a new key restarts it even if the name repeats.
 * - `idle`: which idle pool to draw from between reactions (null: just breathe).
 * - `nest`: sits in a small nest drawn in front of her legs (lesson tracks); tumbles knock her out of it.
 * - `dir`: which way a tumble throws her (1 = backward/left, -1 = forward/right).
 */
export default function OdileActor({ size = 64, mood = "happy", play, idle = "perch", nest = false, dir = 1, onDone, className = "" }: {
  size?: number; mood?: Mood; play?: Cue | null; idle?: IdlePool | null; nest?: boolean; dir?: 1 | -1; onDone?: (c: Cue) => void; className?: string;
}) {
  // a cue plays until its time is up; a newer cue (new key) replaces it at once
  const [ended, setEnded] = useState(0);
  const active = play && play.key !== ended ? play : null;
  useEffect(() => {
    if (!play) return;
    const t = window.setTimeout(() => { setEnded(play.key); onDone?.(play); }, REACTIONS[play.name].ms);
    return () => window.clearTimeout(t);
    // onDone is read when the cue ends; a new cue (key) is what restarts this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play?.key]);

  const idler = useOdileIdle(nest && idle === "perch" ? "nest" : idle, !!active);
  const spec = active ? REACTIONS[active.name] : null;
  const shown: Mood = spec?.mood ?? (idler.idle && IDLE_MOOD[idler.idle]) ?? mood;
  const bodyStyle = { "--odile-d": `${spec?.ms ?? 1000}ms`, "--odile-dir": dir } as CSSProperties;

  return (
    <span aria-hidden="true" className={`odile ${nest ? "odile-in-nest" : ""} ${idler.className} ${className}`} style={{ width: size, height: size, ...idler.style }}>
      <span key={active?.key ?? "rest"} className={`odile-body${active ? ` odile-react odile-r-${active.name}` : ""}`} style={bodyStyle}>
        <Stork live mood={shown} size={size} fx={spec?.fx} />
      </span>
      {nest && <span className="odile-nest-spot"><Nest width={size * 0.6} /></span>}
    </span>
  );
}
