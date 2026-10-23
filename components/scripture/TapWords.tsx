"use client";

// French text whose words can each be tapped to hear them (hold for slow), plus the playback controls that read a
// chunk or the whole verse with a word-by-word highlight. Shared by the learn flow, review feedback and lesson cards.
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Square, Turtle, Volume2 } from "lucide-react";
import { currentSession, getPlaying, getServerPlaying, playKaraoke, sayWord, stop, subscribe } from "@/lib/scripture/karaoke";
import { verseTokens, type Tok } from "@/lib/scripture/tokens";

const HOLD_MS = 450;
// Small visual pill; the ::before box stretches the tap target to 44px tall without moving the text.
const WORD = "relative cursor-pointer select-none rounded-md px-[2px] -mx-[2px] py-px underline decoration-1 underline-offset-[5px] "
  + "[-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] transition-colors duration-150 motion-reduce:transition-none "
  + "before:absolute before:-inset-x-[3px] before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] "
  + "active:bg-tint focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary";
const LIT = "bg-[color-mix(in_srgb,var(--accent)_32%,transparent)] decoration-transparent";
const BAD = "bg-tint font-bold text-primary decoration-wavy decoration-primary";
const SLOW_KEY = "le-nid-slow-speech";

// ---- slow-speech preference, shared by every control on the page --------------------------------------------
let slowPref: boolean | null = null;
const slowListeners = new Set<() => void>();
function readSlow() {
  if (slowPref === null) { try { slowPref = localStorage.getItem(SLOW_KEY) === "1"; } catch { slowPref = false; } }
  return slowPref;
}
export function useSlow(): [boolean, (on: boolean) => void] {
  const slow = useSyncExternalStore((l) => { slowListeners.add(l); return () => { slowListeners.delete(l); }; }, readSlow, () => false);
  const set = (on: boolean) => {
    slowPref = on;
    try { localStorage.setItem(SLOW_KEY, on ? "1" : "0"); } catch {}
    slowListeners.forEach((l) => l());
  };
  return [slow, set];
}

// ---- whether audio worked: drives the small hint under the controls ------------------------------------------
type AudioNote = "none" | "played" | "unavailable";
let note: AudioNote = "none";
const noteListeners = new Set<() => void>();
const setNote = (n: AudioNote) => { if (note !== n) { note = n; noteListeners.forEach((l) => l()); } };
const useNote = () => useSyncExternalStore((l) => { noteListeners.add(l); return () => { noteListeners.delete(l); }; }, () => note, () => "none" as AudioNote);

export function usePlaying() {
  return useSyncExternalStore(subscribe, getPlaying, getServerPlaying);
}

/** Speak `say` from a tap; records whether the device could speak. */
export function hear(say: string, slow: boolean) {
  setNote(sayWord(say, slow) ? "played" : "unavailable");
}

/** Plays a group of tokens with the word highlight; a second tap on the same group stops it. */
export function playGroup(group: string, toks: Tok[], slow: boolean) {
  const p = getPlaying();
  if (p?.group === group) return stop();
  setNote(playKaraoke(group, toks, slow) ? "played" : "unavailable");
}

type WordProps = {
  tok: Tok;
  lit?: boolean;
  bad?: boolean;
  slow: boolean;
};

/** One tappable French word. Tap: hear it. Hold: hear it slowly. Enter/Space work too. */
export function Word({ tok, lit, bad, slow }: WordProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  useEffect(() => cancel, []);
  if (!tok.word) return <span aria-hidden="true">{tok.text}</span>;
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={tok.say}
      className={`${WORD} ${lit ? LIT : bad ? BAD : "decoration-dotted [text-decoration-color:color-mix(in_srgb,var(--muted)_60%,transparent)] hover:bg-tint"}`}
      onPointerDown={() => { held.current = false; cancel(); timer.current = setTimeout(() => { held.current = true; hear(tok.say, true); }, HOLD_MS); }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { cancel(); if (held.current) { held.current = false; return; } hear(tok.say, slow); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); hear(tok.say, slow); } }}
    >
      {tok.text}
    </span>
  );
}

type TapWordsProps = {
  text: string;
  /** Playback group this text belongs to (so "Play" lights its words). */
  group?: string;
  /** Index of this text's first token inside the group (when a group spans several lines). */
  offset?: number;
  className?: string;
  /** Whitespace-word indexes to mark as wrong (review feedback). */
  bad?: Set<number>;
  as?: "p" | "span" | "div";
};

/** French text with every word a button that speaks it. Punctuation is shown but never spoken. */
export default function TapWords({ text, group, offset = 0, className = "", bad, as = "p" }: TapWordsProps) {
  const toks = useMemo(() => verseTokens(text), [text]);
  const playing = usePlaying();
  const [slow] = useSlow();
  const Tag = as;
  return (
    <Tag lang="fr" className={className}>
      {toks.map((t, i) => (
        <span key={i}>
          {i > 0 && " "}
          <Word tok={t} slow={slow} lit={!!group && playing?.group === group && playing.index === offset + i} bad={bad?.has(i)} />
        </span>
      ))}
    </Tag>
  );
}

/** The small line under audio controls: how to tap words, or what to do when nothing is heard. */
export function AudioHint({ tapHint = true }: { tapHint?: boolean }) {
  const n = useNote();
  const text = n === "unavailable" ? "Audio is not available on this device."
    : n === "played" ? "No sound? Flip the silent switch off."
    : tapHint ? "Tap any word to hear it. Hold it to hear it slowly." : "";
  return text ? <p className="text-xs text-muted" aria-live="polite">{text}</p> : null;
}

/** Play / stop buttons for a group of text, plus the slow toggle. */
export function AudioBar({ group, texts, label = "Play", second, hint = true }: {
  group: string;
  /** The lines that make up the group, in order (joined for speech). */
  texts: string[];
  label?: string;
  /** Optional second play control, e.g. the whole verse next to "Play chunk". */
  second?: { group: string; texts: string[]; label: string };
  hint?: boolean;
}) {
  const [slow, setSlow] = useSlow();
  const playing = usePlaying();
  const toks = useMemo(() => verseTokens(texts.join(" ")), [texts]);
  const toks2 = useMemo(() => (second ? verseTokens(second.texts.join(" ")) : []), [second]);
  // leaving the screen stops what this bar started, but not speech a "Next" tap just started for the next screen
  const mine = useRef(new Set<number>());
  useEffect(() => { const own = mine.current; return () => { if (getPlaying() && own.has(currentSession())) stop(); }; }, []);
  function onPlay(g: string, t: Tok[]) {
    playGroup(g, t, slow);
    mine.current.add(currentSession());
  }
  const btn = (g: string, t: Tok[], l: string, primary: boolean) => {
    const on = playing?.group === g;
    return (
      <button type="button" className={`btn ${primary ? "" : "ghost"} !min-h-11 !px-3 text-[15px]`} onClick={() => onPlay(g, t)} aria-pressed={on}>
        {on ? <Square size={16} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        {on ? "Stop" : l}
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {btn(group, toks, label, false)}
        {second && btn(second.group, toks2, second.label, false)}
        <button type="button" onClick={() => setSlow(!slow)} aria-pressed={slow} aria-label="Slow speech" title="Slow speech"
          className={`ml-auto inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border-2 px-2 text-sm font-bold ${slow ? "border-primary bg-tint text-primary" : "border-border text-muted"}`}>
          <Turtle size={18} aria-hidden="true" /><span className={slow ? "" : "sr-only"}>Slow</span>
        </button>
      </div>
      {hint && <AudioHint />}
    </div>
  );
}
