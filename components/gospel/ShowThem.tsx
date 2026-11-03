"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { STEP_IDS, type GospelContent } from "@/lib/gospel";
import CirclesDiagram from "./CirclesDiagram";
import { labelsOf } from "./CirclesWatch";
import { DraftFlag, LangToggle, UI, VerseChips, VerseSheet, useLang } from "./shared";

/** Keeps the screen on while the phone is held up (where the browser allows it). Failure is fine: the screen just dims normally. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const get = async () => {
      try {
        const l = await navigator.wakeLock?.request("screen");
        if (gone) void l?.release().catch(() => {}); else lock = l ?? null;
      } catch { /* not allowed or not supported */ }
    };
    const vis = () => { if (document.visibilityState === "visible") void get(); };
    void get();
    document.addEventListener("visibilitychange", vis);
    return () => { gone = true; document.removeEventListener("visibilitychange", vis); void lock?.release().catch(() => {}); };
  }, []);
}

/** Full-screen view for holding the phone up to someone: huge circles, big text, language toggle, a closing question at the end. */
export default function ShowThem({ content, reviewed, startStep }: { content: GospelContent; reviewed: boolean; startStep: number }) {
  const total = STEP_IDS.length + 1; // six steps, then the closing question
  const [i, setI] = useState(Math.min(Math.max(startStep, 0), total - 1));
  const [lang, setLang] = useLang();
  const [verse, setVerse] = useState<string | null>(null);
  useWakeLock();
  const t = UI[lang];
  const closing = i === total - 1;
  const step = content.steps[STEP_IDS[Math.min(i, STEP_IDS.length - 1)]];
  const q = content.closing[0];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] landscape:flex-row landscape:gap-4" data-testid="show-them">
      <div className="flex min-h-0 flex-col landscape:w-[44%] landscape:shrink-0">
        <div className="flex items-center justify-between gap-2 pb-1">
          <Link href={`/learn/three-circles?step=${Math.min(i, STEP_IDS.length - 1)}`} aria-label={t.close} className="grid size-11 place-items-center rounded-full border border-border bg-surface"><X size={22} aria-hidden="true" /></Link>
          <div className="flex items-center gap-2">
            {!reviewed && lang === "fr" && <DraftFlag />}
            <LangToggle lang={lang} setLang={setLang} big />
          </div>
        </div>
        <CirclesDiagram step={Math.min(i, STEP_IDS.length - 1)} lang={lang} labels={labelsOf(content, lang)} className="mx-auto max-h-[46svh] landscape:max-h-[calc(100svh-6rem)]" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 landscape:justify-center">
        <section lang={lang} aria-live="polite" className="flex flex-col gap-2">
          {closing ? (
            <>
              <p className="text-sm font-extrabold uppercase text-primary">{t.ask}</p>
              <p className="text-3xl font-extrabold leading-tight">{q ? q[lang] : ""}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold uppercase text-primary">{step.title[lang]}</p>
              <p className="text-2xl font-bold leading-snug">{step.say[lang]}</p>
              <VerseChips verses={step.verses} lang={lang} onOpen={setVerse} large />
            </>
          )}
        </section>
        <div>
          <div className="mb-2 flex justify-center gap-1.5" aria-hidden="true">
            {Array.from({ length: total }, (_, n) => <span key={n} className={`block h-2.5 rounded-full ${n === i ? "w-6 bg-primary" : "w-2.5 bg-border"}`} />)}
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn ghost min-h-14 flex-1 text-lg" disabled={i === 0} onClick={() => setI(i - 1)}>{t.back}</button>
            <button type="button" className="btn min-h-14 flex-1 text-lg" onClick={() => setI(closing ? 0 : i + 1)}>{closing ? t.again : t.next}</button>
          </div>
        </div>
      </div>
      {verse && <VerseSheet key={verse} verse={verse} lang={lang} onClose={() => setVerse(null)} />}
    </div>
  );
}
