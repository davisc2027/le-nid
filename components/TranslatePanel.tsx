"use client";

import { useEffect, useRef, useState } from "react";
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
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const [dictate, setDictate] = useState(false);
  const rec = useRef<Recognizer | null>(null);

  useEffect(() => {
    try { setHistory(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]")); } catch {}
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
    setCanListen(!!(w.SpeechRecognition || w.webkitSpeechRecognition) && !standalone);
    setDictate(standalone || !(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  function listen() {
    if (listening) return rec.current?.stop();
    const w = window as unknown as { SpeechRecognition?: new () => Recognizer; webkitSpeechRecognition?: new () => Recognizer };
    const R = w.SpeechRecognition || w.webkitSpeechRecognition!;
    const r = new R();
    r.lang = dir === "en-fr" ? "en-US" : "fr-FR";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setError("The microphone isn't available. You can type instead."); };
    rec.current = r;
    setError("");
    setListening(true);
    r.start();
  }

  async function translate() {
    const input = text.trim();
    if (!input) return;
    if (!navigator.onLine) return setError("You're offline. Translation needs internet. Try Google Translate's offline mode.");
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: input, target: dir === "en-fr" ? "FR" : "EN-US" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Translation failed.");
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

  const flip = () => { setDir(dir === "en-fr" ? "fr-en" : "en-fr"); setText(""); setShown(null); };

  if (full && shown)
    return (
      <button onClick={() => setFull(false)} className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background p-6 text-center" aria-label="Close full screen">
        <p className="verse-text !text-4xl !leading-tight">{shown.to}</p>
        <p className="text-sm text-muted">Tap anywhere to close</p>
      </button>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Translate</h1>
        <button className="btn ghost" onClick={flip} aria-label="Swap languages">⇄ {dir === "en-fr" ? "English → Français" : "Français → English"}</button>
      </div>
      <label htmlFor="src" className="sr-only">Text to translate</label>
      <textarea id="src" className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)}
        lang={dir === "en-fr" ? "en" : "fr"} placeholder={dir === "en-fr" ? "Type or speak in English" : "Parlez ou écrivez en français"} />
      {dictate && <p className="text-xs text-muted">To speak, tap the 🎤 on your iPhone keyboard and dictate into the box.</p>}
      <div className="flex gap-2">
        {canListen && <button className={`btn ${listening ? "" : "ghost"}`} onClick={listen}>{listening ? "■ Stop" : "🎤 Speak"}</button>}
        <button className="btn flex-1" disabled={busy || !text.trim()} onClick={translate}>{busy ? "Translating…" : "Translate"}</button>
      </div>
      {error && (
        <div className="card text-sm" role="alert">
          <p>{error}</p>
          {text.trim() && <a className="underline" href={gt(dir, text)} target="_blank" rel="noreferrer">Open in Google Translate</a>}
        </div>
      )}
      {shown && (
        <div className="card gap-3 !border-primary">
          <p className="verse-text !text-2xl">{shown.to}</p>
          <div className="flex flex-wrap gap-2">
            {shown.dir === "en-fr" && <button className="btn" onClick={() => speak(shown.to)}>🔊 Say it</button>}
            {shown.dir === "en-fr" && <button className="btn ghost" onClick={() => speak(shown.to, true)}>🐢 Slow</button>}
            <button className="btn ghost" onClick={() => setFull(true)}>Show them</button>
          </div>
        </div>
      )}
      {!shown && <div className="flex items-end gap-2"><Stork mood="think" size={64} /><p className="card mb-2 flex-1 text-sm">Speak or type, then tap Translate. "Show them" fills the screen so the other person can read it.</p></div>}
      {history.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="label">Recent</h2>
          {history.map((h, i) => (
            <button key={i} className="card text-left" onClick={() => { setShown(h); setDir(h.dir); }}>
              <span className="text-sm text-muted">{h.from}</span><span className="font-bold">{h.to}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
