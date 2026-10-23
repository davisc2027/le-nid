"use client";

// First-time walkthrough led by Odile. One client component, lazy-loaded from TourHost.
// Seen-flag lives in localStorage (per device); "nid:tour" window event replays it from the Me page.
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bell, X } from "lucide-react";
import OdileActor from "@/components/art/OdileActor";
import { cue, reducedMotion, type Cue, type Reaction } from "@/lib/odile-motion";
import { GENTLE_KEY } from "@/lib/odile";
import type { Mood } from "@/components/art/Stork";

export const TOUR_KEY = "nid-tour-done-v1";
export const TOUR_EVENT = "nid:tour";

type Step = { title: string; text: string; gentle?: string; mood: Mood; react: Reaction; tab?: string };

const STEPS: Step[] = [
  { title: "Bonjour, I'm Odile", mood: "happy", react: "wave", tab: "/",
    text: "Home is where announcements land. Check it first, I post the good gossip there.",
    gentle: "Home is where announcements land. A good place to start each day." },
  { title: "Itinerary", mood: "think", react: "salute", tab: "/itinerary",
    text: "Where you need to be, and when. Yes, I'm looking at you, the one who is always late.",
    gentle: "Where you need to be, and when. Handy when the days start to blur." },
  { title: "To-dos", mood: "happy", react: "bounce", tab: "/todos",
    text: "Tasks and reminders land here. Tick them off and I'll act like it's a miracle.",
    gentle: "Tasks and reminders land here. Tick them off as you go." },
  { title: "Learn French", mood: "cheer", react: "jump", tab: "/learn",
    text: "Short lessons, XP for every win, and a daily streak. I react to every answer, so no pressure.",
    gentle: "Short lessons, XP for every win, and a daily streak. I'll cheer you on the whole way." },
  { title: "Scripture memory", mood: "happy", react: "hearts", tab: "/learn",
    text: "Tuck a verse away a little at a time. Calm, quiet, and no pratfalls from me.",
    gentle: "Tuck a verse away a little at a time. Calm and quiet." },
  { title: "Translate and talk", mood: "think", react: "twirl", tab: "/translate",
    text: "Type or speak to translate, or start a live conversation. Great for pointing at menus bravely.",
    gentle: "Type or speak to translate, or start a live conversation. Great for menus and directions." },
  { title: "Culture", mood: "happy", react: "wave", tab: "/learn",
    text: "Little cards about Alsace and France, plus quizzes. Now you can be smug at dinner.",
    gentle: "Little cards about Alsace and France, plus quizzes to see what stuck." },
  { title: "Files", mood: "happy", react: "salute", tab: "/files",
    text: "Tickets, maps and documents, all in one place. Stop scrolling your texts for that PDF." },
  { title: "Leaderboard and goal", mood: "cheer", react: "dance",
    text: "Earn XP and the group climbs toward its shared goal. Healthy competition, mostly healthy.",
    gentle: "Earn XP and the group climbs toward its shared goal. Every bit helps." },
  { title: "Notifications", mood: "happy", react: "hearts",
    text: "Turn them on from Me to hear about announcements and reminders. On iPhone, first Add to Home Screen. I won't ask for permission here." },
];

export default function WelcomeTour({ auto }: { auto: boolean }) {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [gentle, setGentle] = useState(false);
  const [play, setPlay] = useState<Cue | null>(null);
  const [ring, setRing] = useState<{ l: number; t: number; w: number; h: number } | null>(null);
  const dlg = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const step = STEPS[i];
  const last = i === STEPS.length - 1;

  const start = useCallback(() => {
    opener.current = document.activeElement;
    try { setGentle(localStorage.getItem(GENTLE_KEY) === "1"); } catch {}
    setI(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(TOUR_KEY) === "1"; } catch { seen = true; } // can't remember it, so don't nag
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the seen flag exists only in the browser
    if (auto && !seen) start();
    window.addEventListener(TOUR_EVENT, start);
    return () => window.removeEventListener(TOUR_EVENT, start);
  }, [auto, start]);

  const close = useCallback(() => {
    try { localStorage.setItem(TOUR_KEY, "1"); } catch {}
    setOpen(false);
    (opener.current as HTMLElement | null)?.focus?.();
  }, []);

  // per-step Odile cue + highlight of the matching nav tab
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced-motion is a browser setting
    setPlay(reducedMotion() ? null : cue(step.react));
    const measure = () => {
      const a = step.tab ? document.querySelector<HTMLElement>(`nav[aria-label="Sections"] a[href="${step.tab}"]`) : null;
      const r = a?.getBoundingClientRect();
      setRing(r ? { l: r.left, t: r.top, w: r.width, h: r.height } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, i, step]);

  // focus trap, Escape, scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dlg.current?.querySelector<HTMLElement>("[data-next]")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); close(); return; }
      if (e.key !== "Tab" || !dlg.current) return;
      const f = [...dlg.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!f.length) return;
      const first = f[0], end = f[f.length - 1];
      if (!dlg.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  if (!open) return null;
  const text = gentle && step.gentle ? step.gentle : step.text;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
      {ring && <div aria-hidden="true" className={`pointer-events-none fixed rounded-xl border-4 border-accent ${reducedMotion() ? "" : "animate-pulse"}`}
        style={{ left: ring.l + 2, top: ring.t + 2, width: ring.w - 4, height: ring.h - 4, boxShadow: "0 0 0 4px rgba(255,255,255,.7)" }} />}
      <div ref={dlg} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text"
        className="card relative flex max-h-full w-full max-w-md flex-col gap-3 overflow-y-auto !p-5 shadow-xl">
        <button type="button" onClick={close} aria-label="Skip the tour"
          className="absolute right-1 top-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-muted hover:bg-tint">
          Skip <X size={18} aria-hidden="true" />
        </button>
        <div className="flex items-center gap-3 pr-20">
          <OdileActor size={72} mood={step.mood} play={play} />
          <h2 id="tour-title" className="text-xl font-extrabold">{step.title}</h2>
        </div>
        <p id="tour-text" className="text-base" aria-live="polite">
          {last && <Bell size={18} className="mr-1 inline align-text-bottom text-primary" aria-hidden="true" />}{text}
        </p>
        <div className="flex justify-center gap-1.5" role="img" aria-label={`Step ${i + 1} of ${STEPS.length}`}>
          {STEPS.map((_, n) => <span key={n} className={`h-2 rounded-full ${n === i ? "w-5 bg-primary" : "w-2 bg-border"}`} />)}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn ghost min-h-12 flex-1" onClick={() => setI(i - 1)} disabled={i === 0}>
            <ArrowLeft size={18} aria-hidden="true" />Back
          </button>
          <button type="button" data-next className="btn min-h-12 flex-1" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? "Let's go" : "Next"}{!last && <ArrowRight size={18} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
}
