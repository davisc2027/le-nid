"use client";

import { useState } from "react";
import { Mic, Turtle, Volume2, X } from "lucide-react";
import { speak } from "@/lib/french/speech";
import SpeakStep from "@/components/speech/SpeakStep";
import { useSpeakingOn } from "@/components/speech/useSpeakingOn";

const icon = "grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-surface text-primary";

/** Listen / slow (the device's French voice) and an optional Say-it mic. Nothing here blocks or grades the learner. */
export function SpeakButtons({ fr, en, mic = false }: { fr: string; en: string; mic?: boolean }) {
  const [warn, setWarn] = useState(false);
  const [say, setSay] = useState(false);
  const [speaking] = useSpeakingOn();
  return (
    <>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className={icon} aria-label={`Listen: ${fr}`} onClick={() => setWarn(!speak(fr, false))}><Volume2 size={20} aria-hidden="true" /></button>
        <button type="button" className={icon} aria-label={`Listen slowly: ${fr}`} onClick={() => setWarn(!speak(fr, true))}><Turtle size={20} aria-hidden="true" /></button>
        {mic && speaking && <button type="button" className={icon} aria-label={`Say it: ${fr}`} onClick={() => setSay(true)}><Mic size={20} aria-hidden="true" /></button>}
      </div>
      {warn && <p className="basis-full text-xs text-muted" role="status">Audio is not available on this device. No sound? Flip the silent switch off.</p>}
      {say && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/50" onClick={() => setSay(false)}>
          <div role="dialog" aria-modal="true" aria-label="Say it" onClick={(e) => e.stopPropagation()} className="mx-auto max-h-[92svh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
            <button type="button" onClick={() => setSay(false)} aria-label="Close" className="mb-2 ml-auto grid size-11 place-items-center rounded-full border border-border"><X size={20} aria-hidden="true" /></button>
            <SpeakStep fr={fr} en={en} mode="practice" onDone={() => setSay(false)} />
          </div>
        </div>
      )}
    </>
  );
}

/** One French phrase with its English meaning and the sound buttons. */
export function PhraseRow({ fr, en, mic = false, small = false }: { fr: string; en: string; mic?: boolean; small?: boolean }) {
  return (
    <div className="card flex flex-wrap items-center gap-x-2 gap-y-1 !p-3">
      <div className="min-w-0 flex-1">
        <p lang="fr" className={`font-black leading-snug ${small ? "text-base" : "text-[17px]"}`}>{fr}</p>
        <p className="text-sm text-muted">{en}</p>
      </div>
      <SpeakButtons fr={fr} en={en} mic={mic} />
    </div>
  );
}
