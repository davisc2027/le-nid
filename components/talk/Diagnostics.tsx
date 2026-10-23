"use client";

import { useState, useSyncExternalStore } from "react";
import { Copy, Download, Share2, Trash2, X } from "lucide-react";
import { DEFAULT_FLAGS, type EndSilenceChoice, type Flags, type SttModelChoice } from "@/lib/talk/flags";
import type { DiagStore } from "@/lib/talk/diag";
import type { CaptureMode } from "@/components/talk/useVoiceCapture";

const TOGGLES: { key: keyof Flags; label: string; hint: string }[] = [
  { key: "pcm", label: "PCM capture with pre-roll", hint: "Records 0.6 s before the first word; falls back to the recorder by itself." },
  { key: "textCheck", label: "Check the language from the text", hint: "Corrects the side when Whisper's label disagrees with the words." },
  { key: "langRetry", label: "Allow one forced-language retry", hint: "Server asks Whisper again when the language is not English or French." },
  { key: "earlyArm", label: "Arm earlier (1.5x floor)", hint: "Starts recording at a lower level." },
  { key: "spectral", label: "Speech-band check in loud rooms", hint: "Ignores rumble and hiss." },
  { key: "adaptiveEnd", label: "Adaptive pause length", hint: "Waits longer after short sentences, less after long ones." },
  { key: "softCap", label: "Soft cap 12 s, hard cap 20 s", hint: "Off: one hard cap at 25 s." },
  { key: "pipeline", label: "Transcribe the next clip early", hint: "Up to two in flight; shown in order." },
  { key: "phrasebook", label: "Course phrasebook", hint: "Exact matches use the curated translation." },
  { key: "cache", label: "Translation cache", hint: "Same sentence twice: no second request." },
  { key: "context", label: "Previous turns as context", hint: "Sent with each translation." },
  { key: "warnings", label: "Translation warnings", hint: "Shows the May be off chip." },
  { key: "whisperPrompt", label: "Whisper vocabulary prompt", hint: "OFF until tested: faith terms and place names as a hint." },
  { key: "noiseSuppression", label: "Phone noise suppression", hint: "Try off in a cafe. Applies next time listening starts." },
  { key: "keepAudio", label: "Keep audio clips for export", hint: "Off by default. Last 10 clips, in memory only. Get the other person's OK first." },
];

export type DiagEnv = { standalone: boolean; mode: CaptureMode | null; online: boolean };

export default function Diagnostics({ store, flags, setFlags, env, audioCount, onSaveAudio, onClose, onDisable }: {
  store: DiagStore; flags: Flags; setFlags: (f: Flags) => void; env: DiagEnv; audioCount: number;
  onSaveAudio: () => Promise<string>; onClose: () => void; onDisable: () => void;
}) {
  useSyncExternalStore(store.subscribe, store.version, store.version);
  const [msg, setMsg] = useState("");
  const [manual, setManual] = useState("");
  const turns = store.list();

  const build = () => JSON.stringify({
    exportedAt: new Date().toISOString(),
    note: "Local diagnostics from Le Nid Conversation mode. No audio is included.",
    env: {
      userAgent: navigator.userAgent, standalone: env.standalone, captureMode: env.mode, audioWorklet: typeof AudioWorkletNode !== "undefined",
      mediaRecorder: typeof MediaRecorder !== "undefined" ? ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) : [],
      dpr: window.devicePixelRatio, online: navigator.onLine,
    },
    flags, turns,
  }, null, 2);

  async function copy() {
    const json = build();
    try { await navigator.clipboard.writeText(json); setMsg("Copied."); setManual(""); }
    catch { setManual(json); setMsg("Copy blocked: select the text below and copy it."); }
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([build()], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url; a.download = `le-nid-diagnostics-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setMsg("Download started. If nothing appears, use Copy.");
    } catch { void copy(); }
  }
  const set = <K extends keyof Flags>(k: K, v: Flags[K]) => setFlags({ ...flags, [k]: v });
  const sel = "min-h-11 rounded-xl border border-border bg-background px-2 text-sm font-bold";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Diagnostics">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="flex-1 text-lg font-extrabold">Diagnostics</h2>
        <button className="grid size-11 place-items-center rounded-xl text-muted" onClick={onClose} aria-label="Close diagnostics"><X size={22} aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        <div className="flex flex-col gap-3">
          <p className="card text-sm">Stays on this phone. Nothing is sent anywhere and no audio is included unless you switch &quot;keep audio&quot; on.
            Capture: <b>{env.mode ?? "not listening"}</b>{env.standalone ? ", Home Screen app" : ", browser tab"}.</p>

          <section className="card flex flex-col gap-1">
            <h3 className="label pb-1">Speech engine</h3>
            <label className="flex min-h-11 items-center justify-between gap-2 text-sm font-bold">Whisper model
              <select className={sel} value={flags.sttModel} onChange={(e) => set("sttModel", e.target.value as SttModelChoice)}>
                <option value="default">Server default</option><option value="whisper-large-v3-turbo">large-v3-turbo</option><option value="whisper-large-v3">large-v3</option>
              </select></label>
            <label className="flex min-h-11 items-center justify-between gap-2 text-sm font-bold">Pause that ends a sentence
              <select className={sel} value={String(flags.endSilence)} onChange={(e) => set("endSilence", (e.target.value === "auto" ? "auto" : Number(e.target.value)) as EndSilenceChoice)}>
                <option value="auto">Automatic</option><option value="700">0.7 s</option><option value="900">0.9 s</option><option value="1200">1.2 s</option>
              </select></label>
            <p className="text-xs text-muted">Model and prompt are honoured by the server only for this panel. Capture settings apply the next time listening starts.</p>
          </section>

          <section className="card flex flex-col">
            <h3 className="label pb-1">Switches</h3>
            {TOGGLES.map((t) => (
              <label key={t.key} className="flex min-h-11 items-start gap-3 py-1.5">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--primary)]" checked={!!flags[t.key]} onChange={(e) => set(t.key, e.target.checked as never)} />
                <span className="text-sm"><b>{t.label}</b>{flags[t.key] !== DEFAULT_FLAGS[t.key] ? <span className="text-primary"> (changed)</span> : null}<span className="block text-xs text-muted">{t.hint}</span></span>
              </label>
            ))}
            <button className="btn ghost mt-2 min-h-11 text-sm" onClick={() => setFlags({ ...DEFAULT_FLAGS })}>Reset to defaults</button>
          </section>

          <section className="card flex flex-col gap-2">
            <h3 className="label">Turns ({turns.length})</h3>
            {turns.length === 0 && <p className="text-sm text-muted">Nothing yet. Talk, then come back.</p>}
            {turns.slice(-8).reverse().map((t) => (
              <div key={t.id} className="rounded-xl bg-tint p-2 text-xs leading-relaxed">
                <b>#{t.id} {t.side ?? "?"}</b> · whisper {t.stt?.detectedLanguage || "?"} · text {t.stt?.textCheck || "?"} ({t.stt?.textScore ?? 0})
                · conf {t.stt?.confidence ?? "n/a"}{t.stt?.retried ? " · retried" : ""}{t.stt?.dropped ? " · dropped" : ""}<br />
                clip {t.clip ? `${Math.round(t.clip.durationMs)} ms, ${t.clip.pcm ? "pcm" : "recorder"}, ${Math.round(t.clip.bytes / 1024)} KB` : "?"}
                · stt {t.ms?.stt ?? "?"} ms · translate {t.ms?.translate ?? "?"} ms · total {t.ms?.total ?? "?"} ms<br />
                {t.stt?.server?.model ?? "model ?"} · {t.translation?.engine ?? "engine ?"}{t.translation?.cached ? " (cache)" : ""}
                {t.translation?.warnings?.length ? ` · warn ${t.translation.warnings.join(",")}` : ""}{t.corrections.length ? ` · fixes ${t.corrections.map((c) => c.type).join(",")}` : ""}
              </div>
            ))}
          </section>

          <section className="card flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button className="btn min-h-12 gap-2 text-sm" onClick={download}><Download size={18} aria-hidden="true" />Download JSON</button>
              <button className="btn ghost min-h-12 gap-2 text-sm" onClick={() => void copy()}><Copy size={18} aria-hidden="true" />Copy JSON</button>
              <button className="btn ghost min-h-12 gap-2 text-sm" disabled={!flags.keepAudio || audioCount === 0} onClick={() => void onSaveAudio().then(setMsg)}><Share2 size={18} aria-hidden="true" />Save audio ({audioCount})</button>
              <button className="btn ghost min-h-12 gap-2 text-sm" onClick={() => { store.clear(); setMsg("Cleared."); }}><Trash2 size={18} aria-hidden="true" />Clear log</button>
            </div>
            {msg && <p role="status" className="text-sm font-bold">{msg}</p>}
            {manual && <textarea readOnly value={manual} onFocus={(e) => e.currentTarget.select()} rows={6} className="w-full rounded-xl border border-border bg-background p-2 font-mono text-xs" />}
            <button className="min-h-11 text-sm font-bold text-primary underline" onClick={onDisable}>Turn diagnostics off</button>
          </section>
        </div>
      </div>
    </div>
  );
}
