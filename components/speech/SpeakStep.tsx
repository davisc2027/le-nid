"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Lightbulb, Mic } from "lucide-react";
import { analyzeAttempt, type AttemptResult } from "@/lib/speech/checks";
import { BLOCKED_COPY, PROMPT_COPY, RESULT_COPY, ROSE_BODY } from "@/lib/speech/copy";
import { INITIAL_STEP, stepReducer } from "@/lib/speech/flow";
import { createPlayers, playModel, stopAll, type Players } from "@/lib/speech/playback";
import { prefetchReferences } from "@/lib/speech/refs";
import { durationRange, syllables } from "@/lib/speech/text";
import { speechUnlocked } from "@/lib/french/speech";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import { playSuccess, playTick } from "@/lib/sounds";
import ModelButtons from "./ModelButtons";
import ShadowControls from "./ShadowControls";
import { useRecorder } from "./useRecorder";

const subtle = "min-h-11 self-start px-3 text-sm text-muted underline";
const REPLAY = new Set(["success", "near-miss", "thanks", "too-short", "too-long"]);

/** A small line chart of the learner's pitch, with an arrow showing where a question should end. */
function Sparkline({ points }: { points: number[] }) {
  const lo = Math.min(...points), hi = Math.max(...points), span = Math.max(1, hi - lo);
  const d = points.map((v, i) => `${((i / Math.max(1, points.length - 1)) * 104).toFixed(1)},${(30 - ((v - lo) / span) * 28).toFixed(1)}`).join(" ");
  return (
    <figure className="flex items-center gap-2 text-accent">
      <svg width="120" height="32" viewBox="0 0 120 32" role="img" aria-label={PROMPT_COPY.yourVoice}>
        <polyline points={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M114 22 V4 M109 9 L114 4 L119 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
      <figcaption className="text-xs text-muted">{PROMPT_COPY.yourVoice} · {PROMPT_COPY.aimHere}</figcaption>
    </figure>
  );
}

/** One spoken step, shared by lessons and Pronunciation practice. Audio stays in memory; nothing is saved or sent. */
export default function SpeakStep({ fr, en, note, mode, onDone, onCantSpeak, onReact }: {
  fr: string; en: string; note?: string; mode: "lesson" | "practice"; onDone: () => void; onCantSpeak?: () => void; onReact?: (c: Cue) => void;
}) {
  const [step, dispatch] = useReducer(stepReducer, INITIAL_STEP);
  const [noVoice, setNoVoice] = useState(false);
  const meter = useRef<HTMLDivElement>(null);
  const players = useRef<Players | null>(null);
  const attempts = useRef(0);
  const react = useRef(onReact);
  useEffect(() => { react.current = onReact; attempts.current = step.attempts; });

  const getPlayers = useCallback((): Players => (players.current ??= createPlayers()), []);
  const { capSec } = durationRange(syllables(fr));
  const rec = useRecorder({ capSec, onLevel: (l) => { if (meter.current) meter.current.style.width = `${Math.round(l * 100)}%`; } });

  // model once on mount (only when a tap already unlocked speech), and warm the reference cache
  useEffect(() => {
    prefetchReferences([fr]);
    if (speechUnlocked()) void playModel(getPlayers(), fr).then((ok) => { if (!ok) setNoVoice(true); });
  }, [fr, getPlayers]);
  useEffect(() => () => { if (players.current) { stopAll(players.current); players.current.a.removeAttribute("src"); players.current.b.removeAttribute("src"); } }, []);

  // recorder -> step state
  const recording = rec.recording;
  useEffect(() => {
    if (rec.state === "denied") dispatch({ type: "blocked", why: "denied" });
    else if (rec.state === "unsupported") dispatch({ type: "blocked", why: "unsupported" });
    else if (rec.state === "error") dispatch({ type: "blocked", why: "error" });
    else if (rec.state === "idle") dispatch({ type: "cancel" });
    else if (rec.state === "done" && recording) {
      dispatch({ type: "recorded" });
      const timer = setTimeout(() => {
        const result = analyzeAttempt({ samples: recording.samples, sampleRate: recording.sampleRate, fr, stoppedBy: recording.stoppedBy, attempt: attempts.current + 1 });
        dispatch({ type: "analyzed", result });
        if (result.state === "success" || result.state === "thanks") { react.current?.(cue(pickReaction("calmRight"))); playSuccess(); }
        else if (result.state === "near-miss") { react.current?.(cue("feather")); playTick(); }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [rec.state, recording, fr]);

  const tapMic = () => {
    if (rec.state === "recording") return rec.stop();
    if (step.tag === "processing" || rec.state === "starting") return;
    stopAll(players.current ?? undefined);
    if (step.tag === "result") dispatch({ type: "retry" });
    dispatch({ type: "start" });
    void rec.start();
  };
  const retry = () => { stopAll(players.current ?? undefined); rec.reset(); dispatch({ type: "retry" }); };

  const result: AttemptResult | null = step.tag === "result" ? step.result : null;
  const copy = result ? RESULT_COPY[result.state] : null;
  const body = result && result.state === "success" && result.rose ? ROSE_BODY : copy?.body;
  const blocked = step.tag === "blocked" ? BLOCKED_COPY[step.why] : null;
  const label = step.tag === "recording" ? PROMPT_COPY.recording : step.tag === "processing" ? PROMPT_COPY.processing : PROMPT_COPY.idle;
  const showSkip = step.attempts === 0 && step.tag !== "blocked";

  return (
    <div className="flex flex-col gap-4">
      <p className="label">{PROMPT_COPY.label}</p>
      <div>
        <p lang="fr" className="text-2xl font-extrabold">{fr}</p>
        <p className="text-muted">{en}</p>
      </div>
      {note && <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{note}</span></p>}
      {noVoice ? <p className="text-sm text-muted">{PROMPT_COPY.noVoice}</p> : <ModelButtons fr={fr} getPlayers={getPlayers} onUnavailable={() => setNoVoice(true)} />}

      {blocked ? (
        <div className="card flex flex-col gap-2" role="status" data-testid="speak-result" data-state={step.tag === "blocked" ? step.why : undefined}>
          {"title" in blocked && <p className="font-extrabold">{blocked.title}</p>}
          <p className="text-sm">{blocked.body}</p>
          <div className="flex flex-wrap gap-2">
            {step.tag === "blocked" && step.why !== "unsupported" && <button className="btn ghost" onClick={retry} data-testid="speak-retry">{PROMPT_COPY.tryAgain}</button>}
            <button className="btn" onClick={onDone} data-testid="speak-continue">{PROMPT_COPY.next}</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <button onClick={tapMic} disabled={step.tag === "processing"} data-testid="speak-mic" data-recstate={rec.state}
              aria-label={label} className="grid size-22 place-items-center rounded-full bg-primary text-primary-fg disabled:bg-border disabled:text-muted">
              <Mic size={36} aria-hidden="true" />
            </button>
            <p className="text-sm font-bold">{label}</p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border" aria-hidden="true"><div ref={meter} className="h-full w-0 rounded-full bg-primary" /></div>
            <p className="text-xs text-muted">{PROMPT_COPY.privacy}</p>
          </div>
          {result && copy && (
            <div className={`card flex flex-col gap-3 ${result.state === "success" ? "!border-good" : ""}`} role="status" data-testid="speak-result" data-state={result.state}>
              <div className="flex flex-col gap-1">
                {copy.title && <p className="font-extrabold">{copy.title}</p>}
                <p className="text-sm">{body}</p>
              </div>
              {result.state === "near-miss" && result.contour && <Sparkline points={result.contour} />}
              {REPLAY.has(result.state) && recording && (
                <ShadowControls fr={fr} wavUrl={recording.wavUrl} getPlayers={getPlayers} noVoice={noVoice} onUnavailable={() => setNoVoice(true)} />
              )}
              <div className="flex flex-wrap gap-2">
                <button className="btn ghost" onClick={retry} data-testid="speak-retry">{PROMPT_COPY.tryAgain}</button>
                <button className="btn" onClick={onDone} data-testid="speak-continue">{PROMPT_COPY.next}</button>
              </div>
            </div>
          )}
        </>
      )}

      {!blocked && (
        <div className="flex flex-wrap gap-1">
          {showSkip && <button className={subtle} onClick={onDone} data-testid="speak-skip">{PROMPT_COPY.skip}</button>}
          {mode === "lesson" && onCantSpeak && <button className={subtle} onClick={onCantSpeak} data-testid="speak-cant">{PROMPT_COPY.cantSpeak}</button>}
        </div>
      )}
      {blocked && mode === "lesson" && onCantSpeak && <button className={subtle} onClick={onCantSpeak} data-testid="speak-cant">{PROMPT_COPY.cantSpeak}</button>}
    </div>
  );
}
