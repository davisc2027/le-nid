"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bibleInstalled, loadVerse } from "@/lib/bible/load";
import { refLabel } from "@/lib/bible/reference";
import { normalize } from "@/lib/french/exercises";
import { speak } from "@/lib/french/speech";
import { chunks, firstLetters, gradeRecall, PASS, pickBlanks, words } from "@/lib/scripture/drills";
import { Rating, schedule } from "@/lib/srs";
import Stork from "@/components/art/Stork";
import VerseDiff from "./VerseDiff";

type Verse = { fr: string; en: string | null };
type Done = (ok: boolean, expected?: string, marks?: { word: string; ok: boolean }[]) => void;
const STEPS = ["read", "cloze30", "cloze60", "letters", "reorder", "type"] as const;
const LABELS = ["Read and listen", "Fill the blanks", "Fewer hints", "First letters", "Put it in order", "From memory"];

function Read({ v, next }: { v: Verse; next: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="verse-text">{v.fr}</p>
      {v.en && <p className="text-sm italic text-muted">{v.en}</p>}
      <div className="flex gap-2">
        <button className="btn" onClick={() => speak(v.fr)}>🔊 Listen</button>
        <button className="btn ghost" onClick={() => speak(v.fr, true)}>🐢 Slow</button>
      </div>
      <button className="btn" onClick={next}>I've read it</button>
    </div>
  );
}

function Cloze({ v, ratio, done }: { v: Verse; ratio: number; done: Done }) {
  const w = useMemo(() => words(v.fr), [v.fr]);
  const blanks = useMemo(() => [...pickBlanks(v.fr, ratio)].sort((a, b) => a - b), [v.fr, ratio]);
  const bank = useMemo(() => blanks.map((i) => ({ i, word: w[i] })).sort(() => Math.random() - 0.5), [blanks, w]);
  const [fill, setFill] = useState<Record<number, number>>({}); // blank index -> bank index
  const used = new Set(Object.values(fill));
  const check = () => {
    const marks = w.map((word, i) => ({ word, ok: !blanks.includes(i) || normalize(bank[fill[i]]?.word ?? "") === normalize(word) }));
    done(marks.every((m) => m.ok), v.fr, marks);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="verse-text">
        {w.map((word, i) => blanks.includes(i) ? (
          <button key={i} className="mx-0.5 inline-block min-w-14 border-b-2 border-primary px-1 text-primary"
            onClick={() => { const { [i]: _, ...rest } = fill; setFill(rest); }}>{fill[i] !== undefined ? bank[fill[i]].word : " "}</button>
        ) : <span key={i}>{word} </span>)}
      </p>
      <div className="flex flex-wrap gap-2">
        {bank.map((b, k) => (
          <button key={k} disabled={used.has(k)} className="card !px-3 !py-2.5 font-semibold disabled:opacity-30"
            onClick={() => { const slot = blanks.find((i) => fill[i] === undefined); if (slot !== undefined) setFill({ ...fill, [slot]: k }); }}>{b.word}</button>
        ))}
      </div>
      <button className="btn" disabled={Object.keys(fill).length < blanks.length} onClick={check}>Check</button>
    </div>
  );
}

function Typing({ v, hint, threshold, done }: { v: Verse; hint?: string; threshold: number; done: Done }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {hint && <p className="verse-text tracking-widest text-muted">{hint}</p>}
      <textarea className="input verse-text" rows={5} lang="fr" autoCapitalize="none" autoCorrect="off" value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Écrivez le verset" />
      <p className="text-xs text-muted">Accents and small slips are fine.</p>
      <button className="btn" disabled={!text.trim()} onClick={() => { const g = gradeRecall(text, v.fr); done(g.score >= threshold, v.fr, g.marks); }}>Check</button>
    </div>
  );
}

function Reorder({ v, done }: { v: Verse; done: Done }) {
  const parts = useMemo(() => chunks(v.fr), [v.fr]);
  const order = useMemo(() => parts.map((_, i) => i).sort(() => Math.random() - 0.5), [parts]);
  const [picked, setPicked] = useState<number[]>([]);
  return (
    <div className="flex flex-col gap-3">
      <div className="card min-h-20 flex-row flex-wrap gap-2">
        {picked.map((p, n) => <button key={n} className="verse-text rounded bg-tint px-2" onClick={() => setPicked(picked.filter((_, k) => k !== n))}>{parts[p]}</button>)}
      </div>
      <div className="flex flex-col gap-2">
        {order.map((p) => <button key={p} disabled={picked.includes(p)} className="card text-left disabled:opacity-30" onClick={() => setPicked([...picked, p])}><span className="verse-text">{parts[p]}</span></button>)}
      </div>
      <button className="btn" disabled={picked.length < parts.length}
        onClick={() => done(picked.every((p, n) => p === n), v.fr, parts.map((word, i) => ({ word, ok: picked[i] === i })))}>Check</button>
    </div>
  );
}

export default function LearnFlow({ verseKey, state, firstTime }: { verseKey: string; state: Record<string, unknown> | null; firstTime: boolean }) {
  const [v, setV] = useState<Verse | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; marks?: { word: string; ok: boolean }[] } | null>(null);
  const [sum, setSum] = useState<{ xp: number; streak: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [noBible, setNoBible] = useState(false);

  useEffect(() => {
    loadVerse(verseKey).then(async (x) => { if (!x) setNoBible(!(await bibleInstalled())); setV(x); });
  }, [verseKey]);
  if (v === undefined) return <p className="text-muted">Loading…</p>;
  if (v === null) return (
    <div className="flex flex-col gap-3">
      <p className="card" role="alert">{noBible ? "The Bible text isn't installed yet. Ask a leader to run the Bible build script (node scripts/build-bible.mjs) and commit public/bible." : "I couldn't find this verse's text. Check the reference."}</p>
      <Link href="/scripture" className="btn ghost">Back to the window</Link>
    </div>
  );

  const done: Done = (ok, _e, marks) => setFb({ ok, marks });
  async function advance() {
    const ok = fb?.ok ?? true;
    setFb(null);
    if (!ok) return setAttempt(attempt + 1);
    if (step + 1 < STEPS.length) return setStep(step + 1);
    await save();
  }
  async function save() {
    if (saving) return;
    setSaving(true); setSaveErr(false);
    const supabase = createClient();
    const s = schedule(state, Rating.Good);
    const { error } = await supabase.from("srs_cards").upsert({ ref: verseKey, state: s.state, due: s.due, learned_at: new Date().toISOString() });
    if (error) { setSaving(false); return setSaveErr(true); }
    const { data, error: xpErr } = await supabase.rpc("award_xp", { p_source: `verse:${verseKey}`, p_amount: firstTime ? 15 : 8, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setSaving(false);
    if (xpErr) return setSaveErr(true);
    const row = Array.isArray(data) ? data[0] : data;
    setSum({ xp: row?.xp ?? 0, streak: row?.streak ?? 0 });
  }

  if (sum) return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <Stork mood="cheer" size={130} label="Odile celebrating" />
      <h1 className="text-2xl font-extrabold">Verset appris !</h1>
      <p className="verse-text">{v.fr}</p>
      <p className="text-lg font-bold text-primary">+{sum.xp} XP · 🔥 {sum.streak}-day streak</p>
      <Link href="/scripture" className="btn w-full">Back to the window</Link>
    </div>
  );

  if (saveErr || (saving && step + 1 >= STEPS.length)) return (
    <div className="flex flex-col gap-3 pt-4 text-center">
      <h1 className="text-xl font-extrabold">{saving ? "Saving…" : "Couldn't save"}</h1>
      {saveErr && <p className="text-muted" role="alert">Check your connection, then try again. Your work on this verse is kept until you leave this page.</p>}
      <button className="btn" onClick={save} disabled={saving}>{saving ? "Saving…" : "Retry"}</button>
    </div>
  );

  const kind = STEPS[step];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/scripture" aria-label="Quit" className="text-2xl text-muted">×</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} /></div>
      </div>
      <div><p className="label">{refLabel(verseKey)}</p><h1 className="text-lg font-extrabold">{LABELS[step]}</h1></div>
      <div key={`${step}-${attempt}`}>
        {kind === "read" && <Read v={v} next={advance} />}
        {kind === "cloze30" && <Cloze v={v} ratio={0.3} done={done} />}
        {kind === "cloze60" && <Cloze v={v} ratio={0.6} done={done} />}
        {kind === "letters" && <Typing v={v} hint={firstLetters(v.fr)} threshold={0.85} done={done} />}
        {kind === "reorder" && <Reorder v={v} done={done} />}
        {kind === "type" && <Typing v={v} threshold={PASS} done={done} />}
      </div>
      {fb && (
        <div className={`card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] ${fb.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{fb.ok ? "Bien !" : "Pas tout à fait. Look again and retry."}</p>
          {!fb.ok && fb.marks && <VerseDiff marks={fb.marks} />}
          <button className="btn" onClick={advance}>{fb.ok ? "Continue" : "Try again"}</button>
        </div>
      )}
    </div>
  );
}
