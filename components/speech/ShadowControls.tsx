"use client";

import { useEffect, useRef, useState } from "react";
import { Repeat, User, Volume2 } from "lucide-react";
import { playClip, playModel, playShadow, primeClip, stopAll, type Players } from "@/lib/speech/playback";
import { loadManifest, preferredVoice, voicesFor } from "@/lib/speech/refs";
import { PROMPT_COPY } from "@/lib/speech/copy";

const PHASE_LABEL = { model: "Model", you: "You", model2: "Model" } as const;

/** Model, you, model: the shadowing replay, plus the two single plays. Enabled only once the mic is released. */
export default function ShadowControls({ fr, wavUrl, getPlayers, noVoice, onUnavailable }: {
  fr: string; wavUrl: string; getPlayers: () => Players; noVoice: boolean; onUnavailable: () => void;
}) {
  const [phase, setPhase] = useState<keyof typeof PHASE_LABEL | null>(null);
  const abort = useRef<AbortController | null>(null);
  const playing = phase !== null;

  useEffect(() => () => abort.current?.abort(), []);

  const voice = async () => {
    const m = await loadManifest();
    const have = voicesFor(m, fr);
    const pref = preferredVoice();
    return have.includes(pref) ? pref : have[0];
  };

  const all = async () => {
    const p = getPlayers();
    if (playing) { abort.current?.abort(); stopAll(p); return; }
    stopAll(p);
    primeClip(p, wavUrl);
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase("model");
    await playShadow(fr, wavUrl, { players: p, voice: await voice(), onPhase: setPhase }, ctl.signal);
  };
  const model = async () => {
    const p = getPlayers();
    stopAll(p);
    if (!(await playModel(p, fr, { voice: await voice() }))) onUnavailable();
  };
  const me = async () => {
    const p = getPlayers();
    stopAll(p);
    await playClip(p, wavUrl);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {!noVoice && (
          <button className="btn" onClick={all} data-testid="shadow-all">
            <Repeat size={18} aria-hidden="true" /> {playing ? "Stop" : "Model, you, model"}
          </button>
        )}
        {!noVoice && <button className="btn ghost" onClick={model} disabled={playing} data-testid="shadow-model"><Volume2 size={18} aria-hidden="true" /> Model</button>}
        <button className="btn ghost" onClick={me} disabled={playing} data-testid="shadow-me"><User size={18} aria-hidden="true" /> Me</button>
      </div>
      <p className="text-xs text-muted" aria-live="polite">{phase ? PHASE_LABEL[phase] : noVoice ? PROMPT_COPY.noVoice : PROMPT_COPY.silentHint}</p>
    </div>
  );
}
