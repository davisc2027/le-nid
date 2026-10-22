"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AArrowDown, AArrowUp, ChevronLeft, Columns2, LifeBuoy, MessageSquare, Mic, MicOff, RefreshCw, Trash2, Volume2, VolumeX, X } from "lucide-react";
import Stork from "@/components/art/Stork";
import ChatThread from "@/components/talk/ChatThread";
import SideBySide from "@/components/talk/SideBySide";
import HandoffCard from "@/components/talk/HandoffCard";
import { useVoiceCapture } from "@/components/talk/useVoiceCapture";
import { useSafariRecognition } from "@/components/talk/useSafariRecognition";
import { DEFAULT_SIZE, TEXT_SIZES, type Layout, type Turn } from "@/components/talk/types";
import { speak } from "@/lib/french/speech";
import { createSerialQueue } from "@/lib/talk/queue";
import { sideFor, targetFor, type DeepLTarget, type Side } from "@/lib/talk/lang";
import { canRecord, isStandalone, prefersReducedMotion, readJson, speechRecognitionCtor, writeJson } from "@/lib/talk/browser";
import { requestHandoff, transcribe, translate, type Clip, type SttResult } from "@/lib/talk/client";
import { createDemo, type DemoOptions } from "@/lib/talk/demo";

const SETTINGS_KEY = "le-nid-talk-settings";
type Settings = { layout: Layout; size: number; readAloud: boolean };
const DEFAULTS: Settings = { layout: "chat", size: DEFAULT_SIZE, readAloud: false };
/** Upstream failures in a row before switching to the Safari backup. */
const MAX_UPSTREAM_ERRORS = 3;

type Engine = "groq" | "safari";
type Env = { standalone: boolean; speech: boolean; record: boolean };

export default function TalkScreen({ startInSafari, demo: demoOptions }: { startInSafari: boolean; demo: DemoOptions | null }) {
  // DEMO MODE: only ever non-null outside production (see app/(app)/translate/talk/page.tsx and lib/talk/demo.ts).
  const demoOn = !!demoOptions, demoFail = demoOptions?.fail, demoStandalone = demoOptions?.standalone;
  const demo = useMemo(() => (process.env.NODE_ENV !== "production" && demoOn ? createDemo({ fail: demoFail, standalone: demoStandalone }) : null), [demoOn, demoFail, demoStandalone]);

  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [engine, setEngine] = useState<Engine>("groq");
  const [env, setEnv] = useState<Env>({ standalone: false, speech: false, record: true });
  const [handoff, setHandoff] = useState<null | { reason: "busy" | "voluntary"; why?: string }>(null);
  const [banner, setBanner] = useState<string>(""); // why the backup is showing, or a problem to explain
  const [demoListening, setDemoListening] = useState(false);
  const [demoHearing, setDemoHearing] = useState(false);

  const nextId = useRef(1);
  const queue = useRef(createSerialQueue());
  const engineRef = useRef<Engine>("groq");
  const settingsRef = useRef(settings);
  useEffect(() => { engineRef.current = engine; settingsRef.current = settings; }, [engine, settings]);
  const upstreamErrors = useRef(0);
  /** Set after a fallback so clips still in the queue are not sent; cleared when listening starts again. */
  const sttBlocked = useRef(false);
  const interimId = useRef<number | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const quietUntil = useRef(0);
  const safariHold = useRef<() => void>(() => {});

  // ----- settings and environment (client only) -----
  useEffect(() => {
    // Saved settings and browser features exist only on the client, so they are read after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(readJson(SETTINGS_KEY, DEFAULTS));
    const e: Env = {
      standalone: demoStandalone ?? isStandalone(),
      speech: !!speechRecognitionCtor() || demoOn,
      record: canRecord() || demoOn,
    };
    setEnv(e);
    if (startInSafari && e.speech && !e.standalone) setEngine("safari");
  }, [demoOn, demoStandalone, startInSafari]);
  const save = (patch: Partial<Settings>) => setSettings((s) => { const n = { ...s, ...patch }; writeJson(SETTINGS_KEY, n); return n; });

  const backupUsable = env.speech && !env.standalone;

  // ----- turns -----
  const addTurn = (t: Omit<Turn, "id">) => { const id = nextId.current++; setTurns((all) => [...all, { ...t, id }]); return id; };
  const patchTurn = (id: number, patch: Partial<Turn>) => setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const dropTurn = (id: number) => setTurns((all) => all.filter((t) => t.id !== id));

  // Keep the newest sentence in view.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [turns]);

  // ----- reading aloud: never record while the phone is talking, or it would translate itself -----
  const isMuted = useCallback(() => {
    const speaking = typeof window !== "undefined" && "speechSynthesis" in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending);
    if (speaking) quietUntil.current = Date.now() + 500;
    return speaking || Date.now() < quietUntil.current;
  }, []);
  const unlockSpeech = () => { if (settingsRef.current.readAloud) speak(""); };

  // ----- translation step (shared by both engines) -----
  const translateTurn = async (id: number, text: string, target: DeepLTarget, isCurrent: () => boolean) => {
    const r = demo ? await demo.translate(text, target) : await translate(text, target);
    if (!isCurrent()) return;
    if (r.ok) {
      patchTurn(id, { translation: r.text, status: "done" });
      if (settingsRef.current.readAloud && target === "FR") {
        if (engineRef.current === "safari") safariHold.current();
        quietUntil.current = Date.now() + 800;
        speak(r.text);
      }
    } else {
      patchTurn(id, { status: "failed", note: r.limited ? `${r.message} Only the original is shown.` : r.message });
    }
  };

  // ----- falling back to the Safari backup -----
  const goBackup = useCallback((why: string, voluntary = false) => {
    if (backupUsable) {
      setEngine("safari");
      setBanner(why);
      setHandoff(null);
    } else if (env.standalone) {
      setHandoff({ reason: voluntary ? "voluntary" : "busy", why });
    } else {
      setBanner(`${why} This browser has no built-in voice recognition either. Try again in a minute, or type on the Translate page.`);
    }
  }, [backupUsable, env.standalone]);

  const capture = useVoiceCapture({
    onClip: (clip) => handleClip(clip),
    onLevel: (level) => { if (meter.current) meter.current.style.transform = `scaleX(${level})`; },
    isMuted,
  });

  function sttFailed(r: Extract<SttResult, { ok: false }>) {
    if (r.code === "bad_audio") return;
    if (r.code === "offline") { setBanner("You're offline. Conversation mode needs internet."); return; }
    if (r.code === "unauthorized" || r.code === "forbidden") { capture.stop(); setBanner(r.message); return; }
    if (r.code === "upstream_error") {
      upstreamErrors.current++;
      if (upstreamErrors.current < MAX_UPSTREAM_ERRORS) return;
      sttBlocked.current = true;
      stopListening();
      goBackup("The live voice service keeps failing right now.");
      return;
    }
    sttBlocked.current = true;
    stopListening();
    if (r.code === "not_configured") goBackup("Live listening isn't set up yet.");
    else {
      const wait = r.retryAfter ? ` Live listening should work again in about ${r.retryAfter < 90 ? `${r.retryAfter} seconds` : `${Math.ceil(r.retryAfter / 60)} minutes`}.` : "";
      goBackup(r.scope === "you"
        ? `You've sent a lot of speech in a short time.${wait}`
        : `The whole group shares one free voice service, and it's full for the moment.${wait}`);
    }
  }

  function handleClip(clip: Clip) {
    const id = addTurn({ side: null, original: "", translation: "", status: "transcribing" });
    queue.current.push(async (isCurrent) => {
      if (engineRef.current !== "groq" || sttBlocked.current) { dropTurn(id); return; }
      const r = demo ? await demo.transcribe() : await transcribe(clip);
      if (!isCurrent()) return;
      if (!r.ok) { dropTurn(id); sttFailed(r); return; }
      upstreamErrors.current = 0;
      if (r.dropped || !r.text.trim()) { dropTurn(id); return; }
      patchTurn(id, { side: sideFor(r.language), original: r.text, status: "translating" });
      await translateTurn(id, r.text, targetFor(r.language), isCurrent);
    });
  }

  // ----- Safari backup -----
  const safari = useSafariRecognition({
    demo,
    isMuted,
    onInterim: (side, text) => {
      if (!text) { if (interimId.current !== null) dropTurn(interimId.current); interimId.current = null; return; }
      if (interimId.current === null) interimId.current = addTurn({ side, original: text, translation: "", status: "transcribing", interim: true });
      else patchTurn(interimId.current, { side, original: text });
    },
    onFinal: (side, text) => {
      let id = interimId.current;
      interimId.current = null;
      if (id === null) id = addTurn({ side, original: text, translation: "", status: "translating" });
      else patchTurn(id, { side, original: text, status: "translating", interim: false });
      const turnId = id;
      queue.current.push((isCurrent) => translateTurn(turnId, text, side === "fr" ? "EN-US" : "FR", isCurrent));
    },
  });

  useEffect(() => { safariHold.current = safari.hold; }, [safari.hold]);

  // ----- demo capture: fake utterances every few seconds while "listening" -----
  useEffect(() => {
    if (!demo || !demoListening) return;
    let level = 0;
    const bar = meter.current;
    const meterTimer = setInterval(() => {
      level = Math.max(0.05, Math.min(1, level * 0.6 + Math.random() * 0.5));
      if (bar) bar.style.transform = `scaleX(${level})`;
    }, 80);
    let hearing: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      setDemoHearing(true);
      hearing = setTimeout(() => { setDemoHearing(false); handleClip({ blob: new Blob(), ext: "webm", durationMs: 1800, peak: 0.2 }); }, 1400);
    }, 4200);
    return () => { clearInterval(meterTimer); clearInterval(cycle); clearTimeout(hearing); if (bar) bar.style.transform = "scaleX(0)"; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoListening]);

  // ----- controls -----
  const listening = demo ? demoListening : capture.state === "listening" || capture.state === "hearing" || capture.state === "starting";
  function stopListening() { if (demo) { setDemoListening(false); setDemoHearing(false); } else capture.stop(); }
  function toggleListening() {
    unlockSpeech();
    if (listening) { stopListening(); return; }
    setBanner("");
    upstreamErrors.current = 0;
    sttBlocked.current = false;
    if (demo) { setDemoListening(true); return; }
    void capture.start();
  }
  function backToLive() {
    safari.stop();
    setEngine("groq");
    setBanner("");
    setHandoff(null);
    upstreamErrors.current = 0;
  }
  function openBackupVoluntarily() {
    stopListening();
    if (backupUsable) { setEngine("safari"); setBanner(""); }
    else goBackup("", true);
  }
  function clearAll() {
    if (turns.length > 3 && !window.confirm("Clear this conversation?")) return;
    queue.current.clear();
    queue.current = createSerialQueue();
    interimId.current = null;
    setTurns([]);
  }
  function toggleReadAloud() {
    const on = !settings.readAloud;
    if (on) speak(""); // this tap unlocks audio on iPhone
    else if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    save({ readAloud: on });
  }

  // ----- status line -----
  const pending = turns.some((t) => t.status === "transcribing" && !t.interim) ? "transcribing" : turns.some((t) => t.status === "translating") ? "translating" : null;
  const hearing = demo ? demoHearing : capture.state === "hearing";
  let status: string;
  if (engine === "safari") status = safari.active ? (safari.active === "fr" ? "Écoute : français" : "Listening: English") : "Tap a language to talk";
  else if (hearing) status = "Hearing you…";
  else if (pending === "transcribing") status = "Transcribing…";
  else if (pending === "translating") status = "Translating…";
  else if (capture.state === "starting") status = "Starting the microphone…";
  else if (listening) status = "Listening";
  else status = "Paused";
  const live = engine === "safari" ? !!safari.active : listening;

  const size = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, settings.size))];
  const problem = !demo && engine === "groq" && (capture.state === "denied" || capture.state === "unsupported" || capture.state === "error");

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 bg-background">
      <div className="mx-auto flex h-full max-w-xl flex-col pt-[env(safe-area-inset-top)]">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border px-2">
          <Link href="/translate" className="grid size-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-tint" aria-label="Back to Translate">
            <ChevronLeft size={26} aria-hidden="true" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold max-[399px]:sr-only">Conversation</h1>
          <span className="flex-1 min-[400px]:hidden" aria-hidden="true" />
          <button className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-tint px-2.5 text-sm font-extrabold text-primary"
            onClick={() => save({ layout: settings.layout === "chat" ? "side" : "chat" })}
            aria-label={settings.layout === "chat" ? "Layout: chat. Switch to side by side" : "Layout: side by side. Switch to chat"}>
            {settings.layout === "chat" ? <Columns2 size={20} aria-hidden="true" /> : <MessageSquare size={20} aria-hidden="true" />}
            <span className="max-[359px]:sr-only">{settings.layout === "chat" ? "Side by side" : "Chat"}</span>
          </button>
          <div className="flex shrink-0" role="group" aria-label="Text size">
            <button className="grid size-11 place-items-center rounded-l-xl border border-border bg-surface disabled:opacity-40" aria-label="Smaller text"
              disabled={settings.size <= 0} onClick={() => save({ size: settings.size - 1 })}><AArrowDown size={20} aria-hidden="true" /></button>
            <button className="grid size-11 place-items-center rounded-r-xl border border-l-0 border-border bg-surface disabled:opacity-40" aria-label="Bigger text"
              disabled={settings.size >= TEXT_SIZES.length - 1} onClick={() => save({ size: settings.size + 1 })}><AArrowUp size={20} aria-hidden="true" /></button>
          </div>
        </header>

        {/* Conversation */}
        <div ref={stage} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
          <div className="flex min-h-full flex-col justify-end gap-3">
            {demo && <p className="self-center rounded-full bg-accent px-3 py-1 text-xs font-extrabold text-[#2b2118]">DEMO MODE: scripted, no microphone</p>}
            {turns.length === 0 && !handoff && !problem ? (
              <div className="my-auto flex flex-col items-center gap-3 px-2 text-center">
                <Stork mood="think" size={72} />
                {engine === "groq" ? (
                  <>
                    <p className="text-lg font-extrabold">Put the phone between you</p>
                    <p className="max-w-xs text-sm text-muted">Tap Start listening and take turns, one sentence at a time. Le Nid works out who is speaking, English or French, and translates each sentence.</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-extrabold">Safari backup</p>
                    <p className="max-w-xs text-sm text-muted">Tap the language of the person about to speak: English or Français. It keeps listening in that language until you tap it again.</p>
                  </>
                )}
              </div>
            ) : (
              <div role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversation">
                {settings.layout === "chat" ? <ChatThread turns={turns} size={size} /> : <SideBySide turns={turns} size={size} />}
              </div>
            )}
            {handoff && (
              <HandoffCard reason={handoff.reason} why={handoff.why} onClose={() => setHandoff(null)}
                getLink={() => (demo ? demo.handoff() : requestHandoff())} />
            )}
            {banner && (
              <div className="card flex flex-col gap-2 text-sm" role="alert">
                <div className="flex items-start gap-2">
                  <p className="flex-1 pt-2">{banner}</p>
                  <button onClick={() => setBanner("")} className="-mr-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted" aria-label="Dismiss"><X size={20} aria-hidden="true" /></button>
                </div>
                {engine === "safari" && <p className="text-muted">Using Safari&apos;s own voice recognition for now: tap the language being spoken.</p>}
                {engine === "safari" && (
                  <button className="btn ghost min-h-11 gap-2 self-start text-sm" onClick={backToLive}><RefreshCw size={18} aria-hidden="true" />Try live listening again</button>
                )}
              </div>
            )}
            {problem && <CaptureProblem state={capture.state} onBackup={openBackupVoluntarily} />}
          </div>
        </div>

        {/* Controls */}
        <footer className="shrink-0 border-t border-border bg-surface px-3 pt-2">
          <div className="flex h-11 items-center gap-2">
            <span className={`size-2.5 shrink-0 rounded-full ${live ? "bg-primary motion-safe:animate-pulse" : "bg-border"}`} aria-hidden="true" />
            <span className={`truncate text-sm font-extrabold ${engine === "groq" ? "w-32 shrink-0" : "min-w-0 flex-1"}`} role="status">{status}</span>
            {engine === "groq" ? (
              <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-tint" aria-hidden="true">
                <span ref={meter} style={{ transform: "scaleX(0)" }} className="block h-full origin-left rounded-full bg-primary transition-transform duration-75 motion-reduce:transition-none" />
              </span>
            ) : null}
            <button className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-tint disabled:opacity-40" onClick={clearAll} disabled={turns.length === 0} aria-label="Clear conversation">
              <Trash2 size={20} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-stretch gap-2">
            {engine === "groq" ? (
              <button className={`btn min-h-14 flex-1 gap-2 text-lg ${listening ? "ghost" : ""}`} onClick={toggleListening} disabled={capture.state === "starting"} aria-pressed={listening}>
                {listening ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
                {capture.state === "starting" ? "Starting…" : listening ? "Pause listening" : "Start listening"}
              </button>
            ) : (
              <>
                <TalkButton side="en" active={safari.active === "en"} onClick={() => { unlockSpeech(); safari.toggle("en"); }} />
                <TalkButton side="fr" active={safari.active === "fr"} onClick={() => { unlockSpeech(); safari.toggle("fr"); }} />
              </>
            )}
            <button role="switch" aria-checked={settings.readAloud} onClick={toggleReadAloud}
              className="flex w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-border px-1 text-[11px] font-extrabold text-muted">
              <span className="flex items-center gap-1">
                {settings.readAloud ? <Volume2 size={18} className="text-primary" aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
                <span className={`relative h-4 w-7 rounded-full transition-colors motion-reduce:transition-none ${settings.readAloud ? "bg-primary" : "bg-border"}`} aria-hidden="true">
                  <span className={`absolute top-0.5 size-3 rounded-full bg-surface transition-[left] motion-reduce:transition-none ${settings.readAloud ? "left-3.5" : "left-0.5"}`} />
                </span>
              </span>
              Read aloud
            </button>
          </div>
          {safari.error && engine === "safari" && <p role="alert" className="pt-1 text-sm font-bold text-primary">{safari.error}</p>}
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-x-3">
            <span className="text-[11px] text-muted">AI audio processing used</span>
            {engine === "groq" ? (
              <button className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-primary underline-offset-2 hover:underline" onClick={openBackupVoluntarily}>
                <LifeBuoy size={14} aria-hidden="true" />Having trouble? Use the Safari backup
              </button>
            ) : (
              <button className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-primary underline-offset-2 hover:underline" onClick={backToLive}>
                <RefreshCw size={14} aria-hidden="true" />Back to live listening
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

function TalkButton({ side, active, onClick }: { side: Side; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} lang={side}
      className={`btn min-h-14 flex-1 gap-1.5 px-2 text-lg ${active ? "" : "ghost"}`}>
      {active ? <MicOff size={22} aria-hidden="true" /> : <Mic size={22} aria-hidden="true" />}
      {side === "en" ? "English" : "Français"}
    </button>
  );
}

function CaptureProblem({ state, onBackup }: { state: string; onBackup: () => void }) {
  return (
    <div className="card flex flex-col gap-2 text-sm" role="alert">
      {state === "denied" ? (
        <>
          <p className="text-base font-extrabold">Le Nid can&apos;t hear you yet</p>
          <p>Microphone access was turned off. Tap Start listening again and choose Allow. If no question appears, open the iPhone Settings app, find Le Nid (or Safari) and turn on Microphone.</p>
        </>
      ) : state === "unsupported" ? (
        <p>This browser can&apos;t record audio for live listening.</p>
      ) : (
        <p>The microphone stopped. Tap Start listening to try again.</p>
      )}
      <button className="btn ghost min-h-11 self-start text-sm" onClick={onBackup}>Use the Safari backup</button>
    </div>
  );
}
