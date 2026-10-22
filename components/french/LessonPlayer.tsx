"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { buildLesson, isCorrect, tokenize, type Exercise } from "@/lib/french/exercises";
import type { Lesson } from "@/lib/french/content";
import { speak } from "@/lib/french/speech";
import Stork, { type Mood } from "@/components/art/Stork";
import OdileSays from "@/components/art/OdileSays";

type Report = (correct: boolean, answer: string, note?: string) => void;
type ExProps<T extends Exercise> = { ex: T; locked: boolean; report: Report };

function Speaker({ text }: { text: string }) {
  const [warn, setWarn] = useState(false);
  const play = (slow: boolean) => setWarn(!speak(text, slow));
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => play(false)} aria-label="Play audio">🔊 Listen</button>
      <button className="btn ghost" onClick={() => play(true)} aria-label="Play slowly">🐢 Slow</button>
      {warn && <span className="text-xs text-muted">Audio is not available on this device.</span>}
    </div>
  );
}

function Choose({ ex, locked, report }: ExProps<Extract<Exercise, { kind: "choose" }>>) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">What does this mean?</p>
      <p className="text-2xl font-extrabold">{ex.fr}</p>
      <Speaker text={ex.fr} />
      <div className="flex flex-col gap-2">
        {ex.choices.map((c) => (
          <button key={c} disabled={locked} onClick={() => setSel(c)}
            className={`card text-left font-semibold ${sel === c ? "!border-primary !bg-tint" : ""}`}>{c}</button>
        ))}
      </div>
      <button className="btn" disabled={!sel || locked} onClick={() => report(sel === ex.answer, ex.answer, ex.note)}>Check</button>
    </div>
  );
}

function Bank({ ex, locked, report }: ExProps<Extract<Exercise, { kind: "bank" }>>) {
  const [picked, setPicked] = useState<number[]>([]);
  const answer = picked.map((i) => ex.tokens[i]).join(" ");
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Translate into French</p>
      <p className="text-2xl font-extrabold">{ex.en}</p>
      <div className="flex min-h-14 flex-wrap gap-2 border-b-2 border-border pb-2">
        {picked.map((i, n) => (
          <button key={n} disabled={locked} className="card !px-3 !py-1.5 font-semibold" onClick={() => setPicked(picked.filter((_, k) => k !== n))}>{ex.tokens[i]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ex.tokens.map((t, i) => (
          <button key={i} disabled={locked || picked.includes(i)} className="card !px-3 !py-1.5 font-semibold disabled:opacity-30"
            onClick={() => setPicked([...picked, i])}>{t}</button>
        ))}
      </div>
      <button className="btn" disabled={!picked.length || locked} onClick={() => report(isCorrect(answer, ex.fr), ex.fr)}>Check</button>
    </div>
  );
}

function Listen({ ex, locked, report }: ExProps<Extract<Exercise, { kind: "listen" }>>) {
  const [text, setText] = useState("");
  useEffect(() => { speak(ex.fr); }, [ex.fr]);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Type what you hear</p>
      <Speaker text={ex.fr} />
      <input className="input" lang="fr" autoCapitalize="none" autoCorrect="off" disabled={locked} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Écrivez en français" />
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!text.trim() || locked} onClick={() => report(isCorrect(text, ex.fr), ex.fr)}>Check</button>
    </div>
  );
}

function Match({ ex, locked, report }: ExProps<Extract<Exercise, { kind: "match" }>>) {
  const [fr, setFr] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const en = useRef(ex.pairs.map((p) => p.en).sort(() => Math.random() - 0.5)).current;
  function pickEn(e: string) {
    if (!fr || locked) return;
    const pair = ex.pairs.find((p) => p.fr === fr)!;
    if (pair.en === e) {
      const next = [...done, fr];
      setDone(next); setFr(null);
      if (next.length === ex.pairs.length) setTimeout(() => report(true, ""), 400);
    } else { setBad(e); setTimeout(() => setBad(null), 500); }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Match the pairs</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-2">
          {ex.pairs.map((p) => (
            <button key={p.fr} disabled={done.includes(p.fr)} onClick={() => { setFr(p.fr); speak(p.fr); }}
              className={`card text-left text-sm font-semibold disabled:opacity-30 ${fr === p.fr ? "!border-primary !bg-tint" : ""}`}>{p.fr}</button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {en.map((e) => (
            <button key={e} disabled={ex.pairs.filter((p) => done.includes(p.fr)).some((p) => p.en === e)} onClick={() => pickEn(e)}
              className={`card text-left text-sm font-semibold disabled:opacity-30 ${bad === e ? "!border-primary" : ""}`}>{e}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LessonPlayer({ lesson, nextHref }: { lesson: Lesson; nextHref: string }) {
  const [queue, setQueue] = useState<Exercise[] | null>(null);
  const [i, setI] = useState(0);
  const [total, setTotal] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; answer: string; note?: string } | null>(null);
  const [mood, setMood] = useState<Mood>("happy");
  const [summary, setSummary] = useState<{ xp: number; streak: number } | null>(null);

  useEffect(() => { const q = buildLesson(lesson); setQueue(q); setTotal(q.length); }, [lesson]);

  if (!queue) return <p className="text-muted">Loading…</p>;
  const ex = queue[i];

  const report: Report = (ok, answer, note) => {
    setResult({ ok, answer, note });
    setMood(ok ? "cheer" : "sulk");
    if (!ok) setQueue((q) => [...q!, q![i]]); // missed ones come back at the end
  };

  async function next() {
    setResult(null);
    setMood("happy");
    if (i + 1 < queue!.length) return setI(i + 1);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data } = await createClient().rpc("complete_lesson", { p_lesson: lesson.id, p_tz: tz });
    const row = Array.isArray(data) ? data[0] : data;
    setSummary({ xp: row?.xp ?? 0, streak: row?.streak ?? 0 });
  }

  if (summary)
    return (
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <h1 className="text-2xl font-extrabold">Leçon terminée !</h1>
        <p className="text-lg font-bold text-primary">+{summary.xp} XP · 🔥 {summary.streak}-day streak</p>
        <div className="w-full"><OdileSays topic="done" mood="cheer" size={120} /></div>
        <Link href={nextHref} className="btn w-full">Continue</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/french" aria-label="Quit lesson" className="text-2xl text-muted">×</Link>
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(i / Math.max(queue.length, total)) * 100}%` }} />
        </div>
        <Stork mood={mood} size={44} />
      </div>
      <div key={i}>
        {ex.kind === "choose" && <Choose ex={ex} locked={!!result} report={report} />}
        {ex.kind === "bank" && <Bank ex={ex} locked={!!result} report={report} />}
        {ex.kind === "listen" && <Listen ex={ex} locked={!!result} report={report} />}
        {ex.kind === "match" && <Match ex={ex} locked={!!result} report={report} />}
      </div>
      {result && (
        <div className={`card sticky bottom-24 flex flex-col gap-2 ${result.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{result.ok ? "Bien !" : "Pas tout à fait"}</p>
          {!result.ok && result.answer && <p className="text-sm">Answer: <b>{result.answer}</b></p>}
          {result.note && <p className="text-sm text-muted">💡 {result.note}</p>}
          <button className="btn" onClick={next}>Continue</button>
        </div>
      )}
    </div>
  );
}
