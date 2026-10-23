"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { BLOCKED_COPY, RESULT_COPY, ROSE_BODY } from "@/lib/speech/copy";
import { addRow, csvName, LAB_COLUMNS, toCsv, type LabRow } from "@/lib/speech/lab";
import { referenceBlobUrl, loadManifest, voicesFor } from "@/lib/speech/refs";
import { practiceSet, SOUND_CARDS, speakPhrasesFor } from "@/lib/speech/select";
import { durationRange, speechWords, syllables } from "@/lib/speech/text";
import { ALL_LESSONS, ALL_PHRASES, type Phrase } from "@/lib/french/content";
import { phraseKey } from "@/lib/french/exercises";
import { fileStem } from "@/lib/speech/refs";
import { analyzeForLab, compareWithReference, type LabAnalysis, type RefCompare } from "./labAnalysis";
import { useRecorder } from "./useRecorder";

const META_KEY = "le-nid-speak-lab-meta";
const ROWS_KEY = "le-nid-speak-lab-rows";
type Meta = { tester: string; voiceGroup: string; room: string; attemptType: string };
const DEFAULT_META: Meta = { tester: "", voiceGroup: "female", room: "quiet", attemptType: "natural" };

const load = <T,>(key: string, dflt: T): T => { try { const s = localStorage.getItem(key); return s ? (JSON.parse(s) as T) : dflt; } catch { return dflt; } };
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

const sel = "min-h-11 rounded-xl border border-border bg-surface px-3";

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm"><span className="label">{label}</span>
      <select className={sel} value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o}>{o}</option>)}</select>
    </label>
  );
}

/** Hidden tester view: raw numbers for each attempt and a local CSV for calibration. Numbers only; audio is never stored. */
export default function SpeakLab() {
  const [meta, setMeta] = useState<Meta>(DEFAULT_META);
  const [rows, setRows] = useState<LabRow[]>([]);
  useEffect(() => { // read the saved labels once after mount
    const t = setTimeout(() => { setMeta({ ...DEFAULT_META, ...load<Partial<Meta>>(META_KEY, {}) }); setRows(load<LabRow[]>(ROWS_KEY, [])); }, 0);
    return () => clearTimeout(t);
  }, []);
  const updateMeta = (patch: Partial<Meta>) => { const m = { ...meta, ...patch }; setMeta(m); save(META_KEY, m); };

  const [query, setQuery] = useState("");
  const base = useMemo(() => {
    const seen = new Set<string>();
    const out: Phrase[] = [];
    const add = (p: Phrase) => { const k = phraseKey(p.fr); if (!seen.has(k)) { seen.add(k); out.push(p); } };
    const all = ALL_LESSONS.map((l) => l.id);
    ALL_LESSONS.forEach((l) => speakPhrasesFor(l.id).forEach(add));
    SOUND_CARDS.forEach((c) => practiceSet(c.tag, all).forEach(add));
    return out;
  }, []);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? ALL_PHRASES.filter((p) => p.fr.toLowerCase().includes(q) || p.en.toLowerCase().includes(q)).slice(0, 60) : base;
  }, [query, base]);
  const [fr, setFr] = useState(base[0]?.fr ?? "Très");
  const syl = syllables(fr);
  const range = durationRange(syl);

  const [voice, setVoice] = useState("");
  const [voices, setVoices] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    loadManifest().then((m) => { if (live) { const v = voicesFor(m, fr); setVoices(v); setVoice(v[0] ?? ""); } });
    return () => { live = false; };
  }, [fr]);

  const meter = useRef<HTMLDivElement>(null);
  const rec = useRecorder({ capSec: range.capSec, onLevel: (l) => { if (meter.current) meter.current.style.width = `${Math.round(l * 100)}%`; } });
  const decodeCtx = useRef<AudioContext | null>(null);
  const [analysis, setAnalysis] = useState<LabAnalysis | null>(null);
  const [ref, setRef] = useState<RefCompare | null>(null);
  const [busy, setBusy] = useState(false);
  const [attemptNo, setAttemptNo] = useState(0);
  const recording = rec.recording;

  useEffect(() => {
    if (rec.state !== "done" || !recording) return;
    const ctx = decodeCtx.current;
    decodeCtx.current = null;
    const timer = setTimeout(async () => {
      setBusy(true);
      setAnalysis(analyzeForLab(recording, fr));
      if (voice && ctx) {
        try {
          const url = await referenceBlobUrl(fr, voice);
          if (url) {
            const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
            setRef(compareWithReference({ samples: buf.getChannelData(0), sampleRate: buf.sampleRate }, recording, fr, voice));
          }
        } catch { setRef(null); }
      }
      ctx?.close().catch(() => {});
      setBusy(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [rec.state, recording, fr, voice]);

  const tap = () => {
    if (rec.state === "recording") return rec.stop();
    if (rec.state === "starting") return;
    setAnalysis(null); setRef(null);
    setAttemptNo((n) => n + 1);
    if (voice) { try { decodeCtx.current = new AudioContext(); } catch { decodeCtx.current = null; } }
    void rec.start();
  };

  const rowNow = (): LabRow | null => {
    if (!analysis || !recording) return null;
    const r = analysis.result, s = recording.settings;
    return {
      timestamp: new Date().toISOString(), tester: meta.tester, voiceGroup: meta.voiceGroup, room: meta.room, attemptType: meta.attemptType,
      key: phraseKey(fr), fr, syllables: syl, minSec: range.minSec, maxSec: range.maxSec, capSec: range.capSec, sampleRate: recording.sampleRate,
      echoCancellation: s?.echoCancellation ?? null, noiseSuppression: s?.noiseSuppression ?? null, autoGainControl: s?.autoGainControl ?? null,
      clipSec: Math.round(recording.seconds * 100) / 100, stoppedBy: recording.stoppedBy, speechSec: r.speechSec, peakDb: r.peakDb, noiseDb: r.noiseDb,
      snrDb: r.snrDb, state: r.state, riseApplicable: r.riseSt !== null, riseSt: r.riseSt, nucleiAttempt: analysis.nuclei,
      refVoice: ref?.voice ?? null, refSec: ref?.refSec ?? null, nucleiRef: ref?.nucleiRef ?? null, distance: ref?.distance ?? null, warp: ref?.warp ?? null,
      durationRatio: ref?.durationRatio ?? null, words: ref ? ref.words.map((w) => `${w.text}:${w.relative}`).join("|") : null,
      maxRelative: ref?.maxRelative ?? null, weakestWord: ref?.weakest ?? null, analysisMs: analysis.analysisMs, userAgent: navigator.userAgent, raterLabel: "",
    };
  };
  const saveRow = () => { const r = rowNow(); if (!r) return; const next = addRow(rows, r); setRows(next); save(ROWS_KEY, next); };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = csvName(); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const copyCsv = () => { void navigator.clipboard?.writeText(toCsv(rows)); };
  const clearRows = () => { if (confirm("Delete all saved rows on this phone?")) { setRows([]); save(ROWS_KEY, []); } };

  const r = analysis?.result;
  const copy = r ? RESULT_COPY[r.state] : null;
  const numbers: [string, string | number | null][] = recording && r ? [
    ["sample rate", recording.sampleRate], ["echoCancellation", String(recording.settings?.echoCancellation)], ["noiseSuppression", String(recording.settings?.noiseSuppression)],
    ["autoGainControl", String(recording.settings?.autoGainControl)], ["track sampleRate", recording.settings?.sampleRate ?? null],
    ["clip seconds", Math.round(recording.seconds * 100) / 100], ["stopped by", recording.stoppedBy], ["speech seconds", r.speechSec],
    ["peak dB", r.peakDb], ["noise dB", r.noiseDb], ["SNR dB", r.snrDb], ["min / max seconds", `${r.minSec} / ${r.maxSec}`], ["riseSt", r.riseSt],
    ["nuclei", analysis!.nuclei], ["analysis ms", analysis!.analysisMs],
  ] : [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Speak lab (testers)</h1>
        <p className="text-sm text-muted">For calibration only. Numbers stay on this phone until you export them.</p>
      </div>
      <div className="card grid grid-cols-2 gap-3">
        <label className="col-span-2 flex flex-col gap-1 text-sm"><span className="label">Tester code</span>
          <input className={sel} value={meta.tester} onChange={(e) => updateMeta({ tester: e.target.value })} /></label>
        <Select label="Voice group" value={meta.voiceGroup} options={["female", "male", "other"]} onChange={(v) => updateMeta({ voiceGroup: v })} />
        <Select label="Room" value={meta.room} options={["quiet", "noisy", "outdoor"]} onChange={(v) => updateMeta({ room: v })} />
        <Select label="Attempt" value={meta.attemptType} options={["careful", "anglicized", "natural"]} onChange={(v) => updateMeta({ attemptType: v })} />
      </div>
      <div className="card flex flex-col gap-2">
        <input className={sel} placeholder="Search any phrase" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search phrases" />
        <select className={sel} value={shown.some((p) => p.fr === fr) ? fr : ""} onChange={(e) => setFr(e.target.value)} aria-label="Phrase">
          {!shown.some((p) => p.fr === fr) && <option value="">{fr}</option>}
          {shown.map((p) => <option key={p.fr} value={p.fr}>{p.fr}</option>)}
        </select>
        <p lang="fr" className="text-xl font-extrabold">{fr}</p>
        <p className="text-xs text-muted">{syl} syllables · {speechWords(fr).length} words · {range.minSec}-{range.maxSec} s · cap {range.capSec} s · file {fileStem(phraseKey(fr))}</p>
        {voices.length > 0 && <Select label="Reference voice" value={voice} options={voices} onChange={setVoice} />}
      </div>
      <div className="flex flex-col items-center gap-2">
        <button onClick={tap} disabled={busy} data-testid="lab-mic" data-recstate={rec.state} aria-label="Record"
          className="grid size-22 place-items-center rounded-full bg-primary text-primary-fg disabled:bg-border disabled:text-muted"><Mic size={36} aria-hidden="true" /></button>
        <p className="text-sm font-bold">{rec.state === "recording" ? "Listening… tap to stop" : busy ? "Analysing…" : "Tap and say it"}</p>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border" aria-hidden="true"><div ref={meter} className="h-full w-0 rounded-full bg-primary" /></div>
      </div>
      {(rec.state === "denied" || rec.state === "unsupported" || rec.state === "error") && (
        <p className="card text-sm" role="status">{BLOCKED_COPY[rec.state === "denied" ? "denied" : rec.state === "unsupported" ? "unsupported" : "error"].body}</p>
      )}
      {r && copy && (
        <div className="card flex flex-col gap-2" role="status">
          {copy.title && <p className="font-extrabold">{copy.title}</p>}
          <p className="text-sm">{r.state === "success" && r.rose ? ROSE_BODY : copy.body}</p>
          <table className="w-full text-sm"><tbody>
            {numbers.map(([k, v]) => <tr key={k} className="border-t border-border"><th className="py-1 pr-2 text-left font-normal text-muted">{k}</th><td className="py-1 text-right">{v ?? "-"}</td></tr>)}
          </tbody></table>
          {ref && (
            <div className="flex flex-col gap-1 text-sm">
              <p className="label">Reference {ref.voice} (approximate word spans)</p>
              {ref.ok ? (
                <>
                  <p>ref {ref.refSec} s · nuclei {ref.nucleiRef} · distance {ref.distance} · warp {ref.warp} · duration ratio {ref.durationRatio}</p>
                  <p>{ref.words.map((w) => `${w.text} ${w.relative}`).join(" · ")}</p>
                  <p className="text-muted">weakest word (placeholder threshold, testers only): {ref.weakest || "none"}</p>
                </>
              ) : <p className="text-muted">No comparison: {ref.reason}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={saveRow}>Save row</button>
            {recording && <a className="btn ghost" href={recording.wavUrl} download={`${meta.tester || "tester"}-${fileStem(phraseKey(fr))}-${attemptNo}.wav`}>Download WAV</a>}
          </div>
        </div>
      )}
      <div className="card flex flex-col gap-2">
        <p className="text-sm">{rows.length} saved rows ({LAB_COLUMNS.length} columns)</p>
        <div className="flex flex-wrap gap-2">
          <button className="btn ghost" onClick={exportCsv} disabled={!rows.length}>Export CSV</button>
          <button className="btn ghost" onClick={copyCsv} disabled={!rows.length}>Copy CSV</button>
          <button className="btn ghost" onClick={clearRows} disabled={!rows.length}>Clear rows</button>
        </div>
      </div>
    </div>
  );
}
