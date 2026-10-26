"use client";

// The English-first stage of learning a verse (see docs/verse-learning.md, "English first"): read the English chunks,
// build each one from a word bank, then type the whole verse once. A warm-up only: nothing here is saved to the
// FSRS card or earns XP.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Square, Volume2 } from "lucide-react";
import { pickBlanks } from "@/lib/scripture/drills";
import { englishVoiceAvailable, speakEnglish, stopEnglish } from "@/lib/scripture/speakEn";
import { verseTokens } from "@/lib/scripture/tokens";
import { Build, Recall, type Done } from "./Drills";

const noop = () => () => {};

/** A play / stop button for English text (device voice). Renders nothing when the device cannot speak. */
export function EnPlay({ text, label }: { text: string; label: string }) {
  const [on, setOn] = useState(false);
  const can = useSyncExternalStore(noop, englishVoiceAvailable, () => false); // false on the server, real value after hydration
  useEffect(() => () => stopEnglish(), []);
  if (!can) return null;
  return (
    <button type="button" aria-pressed={on} aria-label={on ? "Stop" : label}
      className="btn ghost !min-h-11 shrink-0 !px-3 text-[15px]"
      onClick={() => { if (on) { stopEnglish(); setOn(false); } else { setOn(true); if (!speakEnglish(text, false, () => setOn(false))) setOn(false); } }}>
      {on ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
      <span className="sr-only sm:not-sr-only">{on ? "Stop" : "Play"}</span>
    </button>
  );
}

/** Step 1: every English chunk on one screen, each with its own play button. */
export function EnRead({ chunks, next }: { chunks: string[]; next: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="card flex flex-col gap-2" lang="en">
        {chunks.map((c, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tint text-xs font-extrabold text-primary" aria-hidden="true">{i + 1}</span>
            <p className="verse-text flex-1">{c}</p>
            <EnPlay text={c} label={`Play part ${i + 1}`} />
          </li>
        ))}
      </ol>
      {chunks.length > 1 && <div className="flex justify-end"><EnPlay text={chunks.join(" ")} label="Play the whole verse" /></div>}
      <p className="text-sm text-muted">Read it out loud once. Then you will build it, piece by piece.</p>
      <button className="btn" onClick={next}>Build it</button>
    </div>
  );
}

/** Step 2 (per chunk): fill the blanks from a word bank. Errorless: a wrong word just bounces back. */
export function EnBuild({ chunk, done }: { chunk: string; done: Done }) {
  const lines = useMemo(() => [chunk], [chunk]);
  const given = useMemo(() => {
    const blanks = pickBlanks(chunk, 0.5);
    return new Set(verseTokens(chunk).map((_, i) => i).filter((i) => !blanks.has(i)).map((i) => `0:${i}`));
  }, [chunk]);
  return <Build lines={lines} given={given} cue="blank" bank="all" strict={false} lang="en" done={done} />;
}

/** Step 3: type the whole verse in English. Lenient grading; "First letters" is free. */
export function EnVerse({ text, chunks, hinted, onHint, done }: { text: string; chunks: string[]; hinted: boolean; onHint: () => void; done: Done }) {
  return (
    <Recall text={text} lines={chunks} hinted={hinted} onHint={onHint} lang="en" pass={0.8} note={false}
      placeholder="Type the verse in English" done={done} />
  );
}
