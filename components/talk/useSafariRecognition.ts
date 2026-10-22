"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speechRecognitionCtor, type Recognizer } from "@/lib/talk/browser";
import type { Side } from "@/lib/talk/lang";
import type { Demo } from "@/lib/talk/demo";

type Options = {
  onInterim: (side: Side, text: string) => void;
  onFinal: (side: Side, text: string) => void;
  isMuted?: () => boolean;
  demo?: Demo | null;
};

/**
 * Safari backup: the browser's own speech recognition (webkitSpeechRecognition) in one language at a time.
 * Tap English or Français to listen; each sentence ends on its own (continuous = false) and listening restarts
 * until the same button is tapped again. Safari only: it is unreliable inside the installed Home Screen app.
 */
export function useSafariRecognition({ onInterim, onFinal, isMuted, demo }: Options) {
  const [active, setActive] = useState<Side | null>(null);
  const [error, setError] = useState("");
  const cb = useRef({ onInterim, onFinal, isMuted });
  useEffect(() => { cb.current = { onInterim, onFinal, isMuted }; });
  const demoIndex = useRef(0);
  // begin() schedules itself again (auto-restart); going through a ref keeps the callback stable.
  const beginRef = useRef<(side: Side, gen: number) => void>(() => {});
  const run = useRef<{ side: Side | null; rec: Recognizer | null; timer?: ReturnType<typeof setTimeout>;  gen: number }>({ side: null, rec: null, gen: 0 });

  const stop = useCallback(() => {
    const r = run.current;
    r.gen++;
    r.side = null;
    if (r.timer) clearTimeout(r.timer);
    const rec = r.rec;
    r.rec = null;
    if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch { /* not running */ } }
    setActive(null);
  }, []);

  const begin = useCallback((side: Side, gen: number) => {
    const r = run.current;
    if (r.gen !== gen) return;
    // Wait while the phone reads a translation aloud, or it would hear itself.
    if (cb.current.isMuted?.()) { run.current.timer = setTimeout(() => beginRef.current(side, gen), 300); return; }

    if (demo) {
      const words = demo.recognitionLine(side, demoIndex.current++).split(" ");
      let n = 0;
      const tick = () => {
        if (r.gen !== gen) return;
        n++;
        if (n <= words.length) { cb.current.onInterim(side, words.slice(0, n).join(" ")); r.timer = setTimeout(tick, 180); return; }
        cb.current.onFinal(side, words.join(" "));
        run.current.timer = setTimeout(() => beginRef.current(side, gen), 2500);
      };
      r.timer = setTimeout(tick, 400);
      return;
    }

    const Ctor = speechRecognitionCtor();
    if (!Ctor) { setError("This browser has no built-in voice recognition."); stop(); return; }
    const rec = new Ctor();
    rec.lang = side === "fr" ? "fr-FR" : "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    let finalText = "";
    let latest = "";
    let fatal = false;
    rec.onresult = (e) => {
      let f = "", i = "";
      for (let k = 0; k < e.results.length; k++) {
        const res = e.results[k];
        if (res.isFinal) f += res[0].transcript; else i += res[0].transcript;
      }
      finalText = f.trim();
      latest = `${f} ${i}`.replace(/\s+/g, " ").trim();
      cb.current.onInterim(side, latest);
    };
    rec.onerror = (e) => {
      const code = e?.error ?? "";
      if (code === "not-allowed" || code === "service-not-allowed") {
        fatal = true;
        setError("Safari isn't allowed to use the microphone or speech recognition. In Settings > Apps > Safari, allow Microphone; also check Settings > Siri for Dictation.");
      } else if (code === "network") {
        fatal = true;
        setError("Safari's voice recognition needs internet. Check your connection and tap a language again.");
      } else if (code === "audio-capture") {
        fatal = true;
        setError("No microphone found.");
      }
      // "no-speech" and "aborted" are normal: listening simply restarts.
    };
    rec.onend = () => {
      if (run.current.gen !== gen) return;
      const text = finalText || latest;
      if (text) cb.current.onFinal(side, text); else cb.current.onInterim(side, "");
      run.current.rec = null;
      if (fatal) { stop(); return; }
      run.current.timer = setTimeout(() => beginRef.current(side, gen), 250);
    };
    r.rec = rec;
    try { rec.start(); } catch { run.current.timer = setTimeout(() => beginRef.current(side, gen), 500); }
  }, [demo, stop]);
  useEffect(() => { beginRef.current = begin; }, [begin]);

  /** Tap a language: listen in it (switching from the other one), or stop if it was already on. */
  const toggle = useCallback((side: Side) => {
    const was = run.current.side;
    stop();
    if (was === side) return;
    setError("");
    const gen = run.current.gen;
    run.current.side = side;
    setActive(side);
    begin(side, gen);
  }, [begin, stop]);

  /** The phone is about to read aloud: end the current listen; it restarts once the speech is over. */
  const hold = useCallback(() => {
    const rec = run.current.rec;
    if (rec) { try { rec.abort(); } catch { /* not running */ } }
  }, []);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden") stop(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", stop);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", stop); stop(); };
  }, [stop]);

  return { active, error, toggle, stop, hold };
}
