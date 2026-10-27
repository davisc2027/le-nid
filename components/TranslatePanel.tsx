"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, ChevronRight, MessagesSquare, Mic, Square, Trash2, Turtle, Volume2, X } from "lucide-react";
import { speak } from "@/lib/french/speech";
import Stork from "@/components/art/Stork";

type Dir = "en-fr" | "fr-en";
type Entry = { dir: Dir; from: string; to: string };
type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };

const HISTORY_KEY = "le-nid-translations";
const gt = (dir: Dir, text: string) => `https://translate.google.com/?sl=${dir === "en-fr" ? "en&tl=fr" : "fr&tl=en"}&text=${encodeURIComponent(text)}&op=translate`;

export default function TranslatePanel() {
  const [dir, setDir] = useState<Dir>("en-fr");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [shown, setShown] = useState<Entry | null>(null);
  const [full, setFull] = useState(false);
  const [history, setHistory] = useState<Entry[]>([]);
  const saveHistory = (next: Entry[]) => {
    setHistory(next);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
  };
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [coach, setCoach] = useState(false);
  const rec = useRef<Recognizer | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const armed = useRef(false); // set by Speak: translate on its own once the person stops talking
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef("");
  textRef.current = text;

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")); } catch {}
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition) && !standalone);
  }, []);

  // After Speak, translate about 2 seconds after the text stops changing, then close the keyboard so the result is visible.
  useEffect(() => {
    if (!armed.current || !text.trim()) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { armed.current = false; setCoach(false); box.current?.blur(); void translate(); }, 2000);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  /** iPhone cannot start keyboard dictation from a web page, so open the keyboard and point at its microphone key. */
  function dictateOnKeyboard() {
    armed.current = true;
    setError(""); setCoach(true);
    box.current?.focus();
  }

  function speakNow() {
    if (listening) return rec.current?.stop();
    if (canListen) return listen();
    dictateOnKeyboard();
  }

  function listen() {
    if (listening) return rec.current?.stop();
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition!;
    const r = new R();
    r.lang = dir === "en-fr" ? "en-US" : "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => { setListening(false); if (textRef.current.trim()) void translate(); };
    r.onerror = () => { setListening(false); setCanListen(false); dictateOnKeyboard(); };
    rec.current = r;
    setError("");
    setListening(true);
    r.start();
  }

  async function translate() {
    const input = textRef.current.trim();
    if (!input) return;
    if (!navigator.onLine) return setError("You're offline. Translation needs internet. Try Google Translate's offline mode.");
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input, target: dir === "en-fr" ? "FR" : "EN-US" }) });
      const json = res.headers.get("content-type")?.includes("application/json");
      const data = json ? await res.json() : null;
      if (!res.ok || !data?.text) throw new Error(data?.error ?? "Translation failed.");
      const entry: Entry = { dir, from: input, to: data.text };
      setShown(entry);
      const next = [entry, ...history].slice(0, 20);
      setHistory(next);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch {}
      if (dir === "en-fr") speak(entry.to);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  }

  const flip = () => { armed.current = false; setCoach(false); setDir(dir === "en-fr" ? "fr-en" : "en-fr"); setText(""); setShown(null); };

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  if (full && shown)
    return (
      <div role="dialog" aria-modal="true" aria-label="Translation" onClick={() => setFull(false)}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center">
        <button onClick={(e) => { e.stopPropagation(); setFull(false); }} aria-label="Close"
          className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-12 place-items-center rounded-full border-2 border-primary bg-surface text-primary">
          <X size={24} aria-hidden="true" />
        </button>
        <p className="verse-text !text-4xl !leading-tight">{shown.to}</p>
        <button onClick={(e) => { e.stopPropagation(); setFull(false); }} className="btn ghost">Close</button>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Translate</h1>
        <button className="btn ghost" onClick={flip} aria-label="Swap languages"><ArrowLeftRight size={18} aria-hidden="true" /> {dir === "en-fr" ? "English → Français" : "Français → English"}</button>
      </div>
      <Link href="/translate/talk" className="card flex items-center gap-3 border-2 border-primary bg-tint">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-fg"><MessagesSquare size={26} aria-hidden="true" /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-lg font-extrabold text-primary">Conversation mode</span>
          <span className="text-sm text-muted">Talk back and forth. Each sentence is translated as you go.</span>
        </span>
        <ChevronRight size={22} className="shrink-0 text-primary" aria-hidden="true" />
      </Link>
      <label htmlFor="src" className="sr-only">Text to translate</label>
      <textarea id="src" ref={box} className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)} onBlur={() => { armed.current = false; setCoach(false); }}
        lang={dir === "en-fr" ? "en" : "fr"} placeholder={dir === "en-fr" ? "Type or speak in English" : "Parlez ou écrivez en français"} />
      {coach && (
        <div className="card relative !border-primary gap-1 pr-12 text-sm" role="note">
          <button onClick={() => { armed.current = false; setCoach(false); }} aria-label="Dismiss tip"
            className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-muted"><X size={20} aria-hidden="true" /></button>
          <p className="font-extrabold">Tap the microphone on your keyboard</p>
          <p>It's the microphone key at the bottom right of your iPhone keyboard (next to the space bar). Tap it, say your sentence, and tap it again. Le Nid translates a moment after you stop.</p>
          <p className="text-xs text-muted">No microphone key? Turn on Dictation in Settings → General → Keyboard.</p>
        </div>
      )}
      <div className="flex gap-2">
        <button className={`btn ${listening ? "" : "ghost"}`} onClick={speakNow}>{listening ? <><Square size={16} fill="currentColor" aria-hidden="true" /> Stop</> : <><Mic size={18} aria-hidden="true" /> Speak</>}</button>
        <button className="btn flex-1" disabled={busy || !text.trim()} onClick={() => { armed.current = false; void translate(); }}>{busy ? "Translating…" : "Translate"}</button>
      </div>
      {error && (
        <div className="card relative pr-12 text-sm" role="alert">
          <button onClick={() => setError("")} aria-label="Dismiss message"
            className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-muted"><X size={20} aria-hidden="true" /></button>
          <p>{error}</p>
          {text.trim() && <a className="underline" href={gt(dir, text)} target="_blank" rel="noreferrer">Open in Google Translate</a>}
        </div>
      )}
      {shown && (
        <div className="card relative gap-3 !border-primary pr-12">
          <button onClick={() => setShown(null)} aria-label="Clear translation"
            className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-muted"><X size={20} aria-hidden="true" /></button>
          <p className="verse-text !text-2xl">{shown.to}</p>
          <div className="flex flex-wrap gap-2">
            {shown.dir === "en-fr" && <button className="btn" onClick={() => speak(shown.to)}><Volume2 size={18} aria-hidden="true" /> Say it</button>}
            {shown.dir === "en-fr" && <button className="btn ghost" onClick={() => speak(shown.to, true)}><Turtle size={18} aria-hidden="true" /> Slow</button>}
            <button className="btn ghost" onClick={() => setFull(true)}>Show them</button>
          </div>
        </div>
      )}
      {!shown && <div className="flex items-end gap-2"><Stork mood="think" size={64} /><p className="card mb-2 flex-1 text-sm">Speak or type, then tap Translate. "Show them" fills the screen so the other person can read it.</p></div>}
      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="label">Recent</h2>
            <button type="button" className="btn ghost min-h-11 !px-3 text-sm" onClick={() => { if (window.confirm("Clear all recent translations on this phone?")) saveHistory([]); }}>
              <Trash2 size={16} aria-hidden="true" /> Clear all
            </button>
          </div>
          {history.map((h, i) => (
            <div key={`${h.from}-${i}`} className="relative">
              <button className="card w-full pr-12 text-left" onClick={() => { setShown(h); setDir(h.dir); }}>
                <span className="text-sm text-muted">{h.from}</span><span className="font-bold">{h.to}</span>
              </button>
              <button type="button" aria-label={`Remove "${h.from}" from recent`} className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-muted hover:bg-tint"
                onClick={() => saveHistory(history.filter((_, n) => n !== i))}>
                <X size={20} aria-hidden="true" />
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
