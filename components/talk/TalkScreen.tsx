"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AArrowDown, AArrowUp, ChevronLeft, Columns2, LifeBuoy, MessageSquare, Mic, MicOff, RefreshCw, Trash2, Undo2, Volume2, VolumeX, Waves, X } from "lucide-react";
import Stork from "@/components/art/Stork";
import ChatThread from "@/components/talk/ChatThread";
import SideBySide from "@/components/talk/SideBySide";
import HandoffCard from "@/components/talk/HandoffCard";
import BubbleSheet, { type SheetAction } from "@/components/talk/BubbleSheet";
import Diagnostics from "@/components/talk/Diagnostics";
import { useVoiceCapture, type Tuning } from "@/components/talk/useVoiceCapture";
import { useSafariRecognition } from "@/components/talk/useSafariRecognition";
import { DEFAULT_SIZE, TEXT_SIZES, type Layout, type Turn } from "@/components/talk/types";
import { speak } from "@/lib/french/speech";
import { createLimiter, createSerialQueue } from "@/lib/talk/queue";
import { isSide, normalizeLang, otherSide, resolveSideDetail, sideFor, targetForSide, type Side } from "@/lib/talk/lang";
import { canRecord, isStandalone, nowMs, prefersReducedMotion, readJson, speechRecognitionCtor, writeJson } from "@/lib/talk/browser";
import { requestHandoff, transcribe, translate, type Clip, type SttResult } from "@/lib/talk/client";
import { createDemo, type DemoOptions } from "@/lib/talk/demo";
import { DEFAULT_FLAGS, readDiagEnabled, readFlags, writeDiagEnabled, writeFlags, type Flags } from "@/lib/talk/flags";
import { createDiagStore } from "@/lib/talk/diag";
import { createTranslationCache } from "@/lib/talk/cache";
import { buildPhrasebook, lookupPhrase, type Phrasebook } from "@/lib/talk/phrasebook";
import type { VadConfig } from "@/lib/talk/vad";

const SETTINGS_KEY = "le-nid-talk-settings";
type Settings = { layout: Layout; size: number; readAloud: boolean; noisy: boolean };
const DEFAULTS: Settings = { layout: "chat", size: DEFAULT_SIZE, readAloud: false, noisy: false };
/** Upstream failures in a row before switching to the Safari backup. */
const MAX_UPSTREAM_ERRORS = 3;
/** In Noisy place mode a chosen language is forgotten after this long without a sentence. */
const PTT_TIMEOUT_MS = 20_000;
const KEEP_CLIPS = 5;
const KEEP_AUDIO = 10;

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
  const [flags, setFlagsState] = useState<Flags>(DEFAULT_FLAGS);
  const [diagOn, setDiagOn] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [ptt, setPttState] = useState<Side | null>(null);
  const [sheetId, setSheetId] = useState<number | null>(null);
  const [undo, setUndo] = useState<Turn | null>(null);
  const [audioCount, setAudioCount] = useState(0);

  const nextId = useRef(1);
  const queue = useRef(createSerialQueue());
  const sttSlots = useRef(createLimiter(2));
  const engineRef = useRef<Engine>("groq");
  const settingsRef = useRef(settings);
  const flagsRef = useRef(flags);
  const diagOnRef = useRef(false);
  const turnsRef = useRef<Turn[]>([]);
  const pttRef = useRef<Side | null>(null);
  useEffect(() => { engineRef.current = engine; settingsRef.current = settings; flagsRef.current = flags; diagOnRef.current = diagOn; turnsRef.current = turns; }, [engine, settings, flags, diagOn, turns]);
  const upstreamErrors = useRef(0);
  /** Set after a fallback so clips still in the queue are not sent; cleared when listening starts again. */
  const sttBlocked = useRef(false);
  const interimId = useRef<number | null>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const quietUntil = useRef(0);
  const safariHold = useRef<() => void>(() => {});
  const [diagStore] = useState(createDiagStore);
  const cache = useRef(createTranslationCache());
  const phrasebook = useRef<Phrasebook | null>(null);
  /** The last few clips, in memory only, so "Wrong language" can listen again. Cleared with Clear and on leaving. */
  const [clips] = useState(() => new Map<number, Clip>());
  const audioKeep = useRef<{ id: number; blob: Blob; ext: string }[]>([]);
  const undoTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const titleTaps = useRef({ n: 0, t: 0 });

  /** Flags only count while diagnostics are switched on; otherwise the defaults apply. */
  const fl = () => (diagOnRef.current ? flagsRef.current : DEFAULT_FLAGS);

  // ----- settings and environment (client only) -----
  useEffect(() => {
    // Saved settings and browser features exist only on the client, so they are read after hydration.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSettings(readJson(SETTINGS_KEY, DEFAULTS));
    setFlagsState(readFlags());
    const wantDiag = new URLSearchParams(window.location.search).get("diag") === "1";
    if (wantDiag) writeDiagEnabled(true);
    setDiagOn(wantDiag || readDiagEnabled());
    /* eslint-enable react-hooks/set-state-in-effect */
    const e: Env = {
      standalone: demoStandalone ?? isStandalone(),
      speech: !!speechRecognitionCtor() || demoOn,
      record: canRecord() || demoOn,
    };
    setEnv(e);
    if (startInSafari && e.speech && !e.standalone) setEngine("safari");
  }, [demoOn, demoStandalone, startInSafari]);
  const save = (patch: Partial<Settings>) => setSettings((s) => { const n = { ...s, ...patch }; writeJson(SETTINGS_KEY, n); return n; });
  const setFlags = (f: Flags) => { setFlagsState(f); writeFlags(f); };
  const setPtt = (side: Side | null) => { pttRef.current = side; setPttState(side); };

  // The curated phrases load on demand as their own chunk.
  useEffect(() => {
    if (!flags.phrasebook || phrasebook.current) return;
    let alive = true;
    import("@/content/french/units.json").then((m) => { if (alive) phrasebook.current = buildPhrasebook(m.default as unknown as Parameters<typeof buildPhrasebook>[0]); }).catch(() => {});
    return () => { alive = false; };
  }, [flags.phrasebook]);

  // A chosen language in Noisy place mode is forgotten after a while.
  useEffect(() => {
    if (!ptt) return;
    const t = setTimeout(() => setPtt(null), PTT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ptt]);

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
    if (speaking) quietUntil.current = nowMs() + 500;
    return speaking || nowMs() < quietUntil.current;
  }, []);
  const unlockSpeech = () => { if (settingsRef.current.readAloud) speak(""); };

  // ----- translation step (shared by both engines) -----
  /** The previous two finished sentences (both speakers) before this one: context for pronouns and gender. */
  const contextFor = (id: number) => {
    if (!fl().context) return undefined;
    const prev = turnsRef.current.filter((t) => t.id < id && t.original && !t.interim && t.status !== "failed").slice(-2).map((t) => t.original);
    return prev.length ? prev.join(" ").slice(-300) : undefined;
  };

  const translateTurn = async (id: number, text: string, side: Side, isCurrent: () => boolean, fresh = false) => {
    const target = targetForSide(side);
    const f = fl();
    const t0 = nowMs();
    let r: Awaited<ReturnType<typeof translate>>;
    let how: { cached?: boolean; phrasebook?: boolean } = {};
    const known = !fresh && f.phrasebook && phrasebook.current ? lookupPhrase(phrasebook.current, text, target) : null;
    const hit = known ? null : !fresh && f.cache ? cache.current.get(text, target) : undefined;
    if (known) { r = { ok: true, text: known, engine: "phrasebook" }; how = { phrasebook: true }; }
    else if (hit) { r = { ok: true, text: hit, engine: "cache" }; how = { cached: true }; }
    else r = demo ? await demo.translate(text, target) : await translate(text, target, { source: side, context: contextFor(id), warn: f.warnings });
    if (!isCurrent()) return;
    const ms = nowMs() - t0;
    if (r.ok) {
      const warnings = f.warnings && r.warnings?.length ? r.warnings : undefined;
      if (!how.phrasebook && !how.cached && f.cache && !warnings) cache.current.set(text, target, r.text);
      patchTurn(id, { translation: r.text, status: "done", warnings, engine: r.engine });
      const d = diagStore.list().find((x) => x.id === id);
      diagStore.update(id, { translation: { engine: r.engine, warnings: r.warnings, chars: text.length, ...how }, ms: { translate: ms, total: d?.clip ? nowMs() - (clipEnd.current.get(id) ?? nowMs()) : undefined } });
      if (settingsRef.current.readAloud && target === "FR") {
        if (engineRef.current === "safari") safariHold.current();
        quietUntil.current = nowMs() + 800;
        speak(r.text);
      }
    } else {
      patchTurn(id, { status: "failed", note: r.limited ? `${r.message} Only the original is shown.` : r.message });
    }
  };
  const clipEnd = useRef(new Map<number, number>());

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

  const getTuning = (): Tuning => {
    const f = fl();
    const vad: Partial<VadConfig> = {};
    if (!f.earlyArm) vad.armRatio = 2;
    if (!f.spectral) vad.minBandRatio = 0;
    if (!f.softCap) { vad.softCapMs = Infinity; vad.maxMs = 25_000; }
    if (!f.adaptiveEnd) vad.adaptiveEnd = false;
    if (typeof f.endSilence === "number") { vad.endSilenceMs = f.endSilence; vad.adaptiveEnd = false; }
    return { pcm: f.pcm, noiseSuppression: f.noiseSuppression, spectral: f.spectral, vad };
  };

  const capture = useVoiceCapture({
    onClip: (clip) => {
      if (clip.forcedLang) setPtt(null); // one tap, one sentence
      handleClip(clip);
    },
    onLevel: (level) => { if (meter.current) meter.current.style.transform = `scaleX(${level})`; },
    isMuted,
    getGate: () => (settingsRef.current.noisy && engineRef.current === "groq" ? pttRef.current : undefined),
    getTuning,
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

  /** One transcription request, with the extras the current flags ask for. */
  async function runTranscribe(id: number, clip: Clip, language?: Side): Promise<SttResult | null> {
    if (engineRef.current !== "groq" || sttBlocked.current) return null;
    const f = fl();
    const t0 = nowMs();
    const lastOf = (s: Side) => (f.whisperPrompt ? turnsRef.current.filter((t) => t.side === s && t.original && !t.interim).slice(-1)[0]?.original : undefined);
    const r = demo ? await demo.transcribe(language) : await transcribe(clip, {
      language,
      contextEn: lastOf("en"), contextFr: lastOf("fr"),
      diag: diagOnRef.current ? { model: f.sttModel !== "default" ? f.sttModel : undefined, prompt: f.whisperPrompt, retry: f.langRetry } : undefined,
    });
    diagStore.update(id, { ms: { stt: nowMs() - t0, encode: clip.meta ? t0 - clip.meta.endedAt : undefined } });
    return r;
  }

  function handleClip(clip: Clip) {
    const forced = clip.forcedLang;
    const id = addTurn({ side: null, original: "", translation: "", status: "transcribing" });
    clipEnd.current.set(id, clip.meta?.endedAt ?? nowMs());
    clips.set(id, clip);
    while (clips.size > KEEP_CLIPS) clips.delete(clips.keys().next().value as number);
    if (fl().keepAudio) {
      audioKeep.current = [...audioKeep.current, { id, blob: clip.blob, ext: clip.ext }].slice(-KEEP_AUDIO);
      setAudioCount(audioKeep.current.length);
    }
    diagStore.update(id, {
      clip: { durationMs: clip.durationMs, peak: clip.peak, bytes: clip.blob.size, mime: clip.blob.type || clip.ext, pcm: !!clip.meta?.pcm, floor: clip.meta?.floor, speechMs: clip.meta?.speechMs, silenceMs: clip.meta?.silenceMs, endReason: clip.meta?.reason, preRollMs: clip.meta?.preRollMs, sampleRate: clip.meta?.sampleRate, forcedLang: forced },
    });
    // Pipelining: the upload starts now (two at a time); only "apply the result and translate" waits in line.
    const early = fl().pipeline ? sttSlots.current.run(() => runTranscribe(id, clip, forced)) : null;
    queue.current.push(async (isCurrent) => {
      const r = await (early ?? runTranscribe(id, clip, forced));
      if (!isCurrent()) return;
      if (r === null) { dropTurn(id); return; }
      if (!r.ok) { dropTurn(id); sttFailed(r); return; }
      upstreamErrors.current = 0;
      const dropped = r.dropped || !r.text.trim();
      const known = isSide(normalizeLang(r.language)) ? (normalizeLang(r.language) as Side) : null;
      const res = forced || (r.forced && known) ? null : fl().textCheck ? resolveSideDetail(r.language, r.text) : null;
      const side: Side = forced ?? (r.forced && known ? known : res ? res.side : sideFor(r.language));
      diagStore.update(id, {
        side,
        stt: {
          detectedLanguage: r.language, textCheck: res?.text.lang ?? "", textScore: res?.text.score, sideSource: forced ? "button" : r.forced ? "forced retry" : res?.source,
          confidence: r.confidence, lowConfidence: r.lowConfidence, retried: r.retried, forced: r.forced || !!forced, dropped, server: r.diag,
        },
      });
      if (dropped) { dropTurn(id); return; }
      patchTurn(id, { side, original: r.text, status: "translating", confidence: r.confidence, lowConfidence: r.lowConfidence });
      await translateTurn(id, r.text, side, isCurrent);
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
      queue.current.push((isCurrent) => translateTurn(turnId, text, side, isCurrent));
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
      const noisy = settingsRef.current.noisy;
      if (noisy && !pttRef.current) return; // waiting for English or Français
      setDemoHearing(true);
      hearing = setTimeout(() => {
        setDemoHearing(false);
        const forcedLang = noisy ? pttRef.current ?? undefined : undefined;
        if (forcedLang) setPtt(null);
        handleClip({ blob: new Blob(), ext: "webm", durationMs: 1800, peak: 0.2, forcedLang });
      }, 1400);
    }, 4200);
    return () => { clearInterval(meterTimer); clearInterval(cycle); clearTimeout(hearing); if (bar) bar.style.transform = "scaleX(0)"; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, demoListening]);

  // ----- controls -----
  const listening = demo ? demoListening : capture.state === "listening" || capture.state === "hearing" || capture.state === "starting";
  function stopListening() { if (demo) { setDemoListening(false); setDemoHearing(false); } else capture.stop(); setPtt(null); }
  function beginListening() {
    setBanner("");
    upstreamErrors.current = 0;
    sttBlocked.current = false;
    if (demo) { setDemoListening(true); return; }
    void capture.start();
  }
  function toggleListening() {
    unlockSpeech();
    if (listening) { stopListening(); return; }
    beginListening();
  }
  /** Noisy place mode: tap a language, then speak one sentence. */
  function chooseLanguage(side: Side) {
    unlockSpeech();
    if (pttRef.current === side) { setPtt(null); return; }
    setPtt(side);
    if (!listening) beginListening();
  }
  function toggleNoisy() {
    const on = !settings.noisy;
    save({ noisy: on });
    setPtt(null);
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
    clips.clear();
    audioKeep.current = [];
    setAudioCount(0);
    cache.current.clear();
    setSheetId(null);
    setUndo(null);
    setTurns([]);
  }
  function toggleReadAloud() {
    const on = !settings.readAloud;
    if (on) speak(""); // this tap unlocks audio on iPhone
    else if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    save({ readAloud: on });
  }
  // Nothing about a conversation is kept once the page is left.
  useEffect(() => {
    const keep = audioKeep;
    return () => { clips.clear(); keep.current = []; clearTimeout(undoTimer.current); };
  }, [clips]);

  // ----- hidden diagnostics: five taps on the title, or ?diag=1 -----
  function tapTitle() {
    const now = nowMs(), t = titleTaps.current;
    t.n = now - t.t < 1500 ? t.n + 1 : 1;
    t.t = now;
    if (t.n >= 5) { t.n = 0; writeDiagEnabled(true); setDiagOn(true); setDiagOpen(true); }
  }
  async function saveAudio(): Promise<string> {
    const list = audioKeep.current;
    if (!list.length) return "No clips kept.";
    const files = list.map((c) => new File([c.blob], `turn-${c.id}.${c.ext}`, { type: c.blob.type || "audio/wav" }));
    try {
      if (navigator.canShare?.({ files })) { await navigator.share({ files }); return "Shared."; }
    } catch { /* cancelled or blocked: fall back to downloads */ }
    files.forEach((f, i) => setTimeout(() => {
      const url = URL.createObjectURL(f);
      const a = document.createElement("a");
      a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, i * 400));
    return `Saving ${files.length} files.`;
  }

  // ----- bubble actions -----
  const sheetTurn = sheetId === null ? null : turns.find((t) => t.id === sheetId) ?? null;
  const redo = (id: number, text: string, side: Side, fresh = false) => {
    patchTurn(id, { side, original: text, translation: "", status: "translating", warnings: undefined, check: undefined, lowConfidence: false });
    queue.current.push((isCurrent) => translateTurn(id, text, side, isCurrent, fresh));
  };
  const onSheetAction = (kind: SheetAction, text?: string) => {
    const t = sheetTurn;
    if (!t) return;
    const a = actions(t);
    if (kind === "edit" && text) a.onEdit(text);
    else if (kind === "flip") a.onFlip();
    else if (kind === "delete") a.onDelete();
    else if (kind === "check") a.onCheck();
    else if (kind === "retry") a.onRetry();
    else if (kind === "read") a.onRead();
  };
  const actions = (t: Turn) => ({
    onEdit: (text: string) => { diagStore.correct(t.id, "edit"); redo(t.id, text, t.side ?? "en"); patchTurn(t.id, { edited: true }); },
    onRetry: () => { diagStore.correct(t.id, "retry"); redo(t.id, t.original, t.side ?? "en", true); },
    onFlip: () => {
      const side = otherSide(t.side ?? "en");
      const clip = clips.get(t.id);
      if (!clip || demo) { diagStore.correct(t.id, "flip"); redo(t.id, t.original, side); patchTurn(t.id, { edited: true }); return; }
      // The audio is still in memory: listen again with the language forced (counts as a new voice request).
      diagStore.correct(t.id, "relisten");
      patchTurn(t.id, { side: null, translation: "", status: "transcribing", warnings: undefined, check: undefined });
      queue.current.push(async (isCurrent) => {
        const r = await runTranscribe(t.id, clip, side);
        if (!isCurrent()) return;
        if (r && r.ok && !r.dropped && r.text.trim()) {
          patchTurn(t.id, { side, original: r.text, status: "translating", confidence: r.confidence, lowConfidence: r.lowConfidence, edited: true });
          await translateTurn(t.id, r.text, side, isCurrent, true);
        } else {
          if (r && !r.ok && r.code !== "bad_audio") setBanner(r.message);
          patchTurn(t.id, { side, original: t.original, status: "translating", edited: true });
          await translateTurn(t.id, t.original, side, isCurrent, true);
        }
      });
    },
    onDelete: () => {
      diagStore.correct(t.id, "delete");
      dropTurn(t.id);
      clearTimeout(undoTimer.current);
      setUndo(t);
      undoTimer.current = setTimeout(() => setUndo(null), 6000);
    },
    onCheck: () => {
      if (!t.side || !t.translation) return;
      diagStore.correct(t.id, "check");
      patchTurn(t.id, { check: { status: "loading", text: "" } });
      const back = t.side;
      void (async () => {
        const r = demo ? await demo.translate(t.translation, targetForSide(back)) : await translate(t.translation, targetForSide(back), { source: otherSide(back) });
        patchTurn(t.id, { check: r.ok ? { status: "done", text: r.text } : { status: "failed", text: "" } });
      })();
    },
    onRead: () => { quietUntil.current = nowMs() + 800; speak(t.translation); },
  });
  function undoDelete() {
    if (!undo) return;
    const back = undo;
    setUndo(null);
    setTurns((all) => [...all, back].sort((a, b) => a.id - b.id));
  }

  // ----- status line -----
  const pending = turns.some((t) => t.status === "transcribing" && !t.interim) ? "transcribing" : turns.some((t) => t.status === "translating") ? "translating" : null;
  const hearing = demo ? demoHearing : capture.state === "hearing";
  const noisyMode = settings.noisy && engine === "groq";
  let status: string;
  if (engine === "safari") status = safari.active ? (safari.active === "fr" ? "Écoute : français" : "Listening: English") : "Tap a language to talk";
  else if (hearing) status = "Hearing you…";
  else if (pending === "transcribing") status = "Transcribing…";
  else if (pending === "translating") status = "Translating…";
  else if (capture.state === "starting") status = "Starting the microphone…";
  else if (noisyMode && ptt) status = ptt === "fr" ? "Parlez…" : "Speak now";
  else if (noisyMode) status = listening ? "Tap a language" : "Paused";
  else if (listening) status = "Listening";
  else status = "Paused";
  const live = engine === "safari" ? !!safari.active : noisyMode ? !!ptt : listening;

  const size = TEXT_SIZES[Math.min(TEXT_SIZES.length - 1, Math.max(0, settings.size))];
  const problem = !demo && engine === "groq" && (capture.state === "denied" || capture.state === "unsupported" || capture.state === "error");
  const onOpen = (id: number) => setSheetId(id);

  return (
    <div className="fixed inset-x-0 top-0 bottom-[calc(4rem+1px+env(safe-area-inset-bottom))] z-30 bg-background">
      <div className="relative mx-auto flex h-full max-w-xl flex-col pt-[env(safe-area-inset-top)]">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-1.5 border-b border-border px-2">
          <Link href="/translate" className="grid size-11 shrink-0 place-items-center rounded-xl text-primary hover:bg-tint" aria-label="Back to Translate">
            <ChevronLeft size={26} aria-hidden="true" />
          </Link>
          <h1 onClick={tapTitle} className="flex min-h-11 min-w-0 flex-1 select-none items-center truncate text-base font-extrabold min-[360px]:text-lg">Conversation</h1>
          <button className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl bg-tint px-2.5 text-sm font-extrabold text-primary"
            onClick={() => save({ layout: settings.layout === "chat" ? "side" : "chat" })}
            aria-label={settings.layout === "chat" ? "Layout: chat. Switch to side by side" : "Layout: side by side. Switch to chat"}>
            {settings.layout === "chat" ? <Columns2 size={20} aria-hidden="true" /> : <MessageSquare size={20} aria-hidden="true" />}
            <span className="max-[479px]:sr-only">{settings.layout === "chat" ? "Side by side" : "Chat"}</span>
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
                    <p className="max-w-xs text-sm text-muted">{noisyMode
                      ? "Noisy place: tap English or Français, then say one sentence. Le Nid knows the language, so it can't mix them up."
                      : "Tap Start listening and take turns, one sentence at a time. Le Nid works out who is speaking, English or French, and translates each sentence."}</p>
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
                {settings.layout === "chat" ? <ChatThread turns={turns} size={size} onOpen={onOpen} /> : <SideBySide turns={turns} size={size} onOpen={onOpen} />}
              </div>
            )}
            {undo && (
              <div className="card flex items-center gap-2 py-2 text-sm" role="status">
                <span className="flex-1">Sentence deleted. Say it again if you like.</span>
                <button className="btn ghost min-h-11 gap-1.5 px-3 text-sm" onClick={undoDelete}><Undo2 size={18} aria-hidden="true" />Undo</button>
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
            {noisyMode && listening && (
              <button className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-tint" onClick={() => stopListening()} aria-label="Stop the microphone"><MicOff size={20} aria-hidden="true" /></button>
            )}
            <button className="grid size-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-tint disabled:opacity-40" onClick={clearAll} disabled={turns.length === 0} aria-label="Clear conversation">
              <Trash2 size={20} aria-hidden="true" />
            </button>
          </div>
          {engine === "groq" && (
            <button role="switch" aria-checked={settings.noisy} onClick={toggleNoisy}
              className="mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border px-3 text-left">
              <Waves size={20} className={settings.noisy ? "text-primary" : "text-muted"} aria-hidden="true" />
              <span className="min-w-0 flex-1 text-sm font-extrabold leading-tight">Noisy place
                <span className="block text-[11px] font-normal text-muted">You tell Le Nid the language, one tap per sentence</span></span>
              <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${settings.noisy ? "bg-primary" : "bg-border"}`} aria-hidden="true">
                <span className={`absolute top-0.5 size-4 rounded-full bg-surface transition-[left] motion-reduce:transition-none ${settings.noisy ? "left-[1.1rem]" : "left-0.5"}`} />
              </span>
            </button>
          )}
          <div className="flex items-stretch gap-2">
            {engine === "groq" && !settings.noisy ? (
              <button className={`btn min-h-14 flex-1 gap-2 text-lg ${listening ? "ghost" : ""}`} onClick={toggleListening} disabled={capture.state === "starting"} aria-pressed={listening}>
                {listening ? <MicOff size={24} aria-hidden="true" /> : <Mic size={24} aria-hidden="true" />}
                {capture.state === "starting" ? "Starting…" : listening ? "Pause listening" : "Start listening"}
              </button>
            ) : engine === "groq" ? (
              <>
                <TalkButton side="en" active={ptt === "en"} onClick={() => chooseLanguage("en")} />
                <TalkButton side="fr" active={ptt === "fr"} onClick={() => chooseLanguage("fr")} />
              </>
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

        {sheetTurn && (
          <BubbleSheet key={sheetTurn.id} turn={sheetTurn} canRelisten={!demo && clips.has(sheetTurn.id)} canRead={sheetTurn.side === "en" && !!sheetTurn.translation && "speechSynthesis" in window}
            onAction={onSheetAction} onClose={() => setSheetId(null)} />
        )}
        {diagOpen && (
          <Diagnostics store={diagStore} flags={flags} setFlags={setFlags} env={{ standalone: env.standalone, mode: capture.mode, online: true }}
            audioCount={audioCount} onSaveAudio={saveAudio} onClose={() => setDiagOpen(false)}
            onDisable={() => { writeDiagEnabled(false); setDiagOn(false); setDiagOpen(false); }} />
        )}
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
