"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Lightbulb, Turtle, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildLesson, buildPractice, buildReview, isCorrect, phraseKey, pickReviewPhrases, PHRASE_BY_KEY, tokenize,
  type CardMap, type Exercise,
} from "@/lib/french/exercises";
import { Rating, schedule } from "@/lib/srs";
import { ALL_PHRASES, type Lesson } from "@/lib/french/content";
import { speak, speechUnlocked } from "@/lib/french/speech";
import OdileTrack from "@/components/art/OdileTrack";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import OdileSays from "@/components/art/OdileSays";
import { playDone, playError, playSuccess, playTick, setSound, soundOn } from "@/lib/sounds";

type Report = (correct: boolean, answer: string, note?: string) => void;
type ExProps<T extends Exercise> = { ex: T; locked: boolean; report: Report };

function Speaker({ text }: { text: string }) {
  const [warn, setWarn] = useState(false);
  const play = (slow: boolean) => setWarn(!speak(text, slow));
  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={() => play(false)} aria-label="Play audio"><Volume2 size={18} aria-hidden="true" /> Listen</button>
      <button className="btn ghost" onClick={() => play(true)} aria-label="Play slowly"><Turtle size={18} aria-hidden="true" /> Slow</button>
      {warn && <span className="text-xs text-muted">Audio is not available on this device.</span>}
      {!warn && <span className="text-xs text-muted">No sound? Flip the silent switch off.</span>}
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
          <button key={n} disabled={locked} className="card !px-3 !py-2.5 font-semibold" onClick={() => setPicked(picked.filter((_, k) => k !== n))}>{ex.tokens[i]}</button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {ex.tokens.map((t, i) => (
          <button key={i} disabled={locked || picked.includes(i)} className="card !px-3 !py-2.5 font-semibold disabled:opacity-30"
            onClick={() => setPicked([...picked, i])}>{t}</button>
        ))}
      </div>
      <button className="btn" disabled={!picked.length || locked} onClick={() => report(isCorrect(answer, ex.fr), ex.fr)}>Check</button>
    </div>
  );
}

function Listen({ ex, locked, report, skip }: ExProps<Extract<Exercise, { kind: "listen" }>> & { skip: () => void }) {
  const [text, setText] = useState("");
  useEffect(() => { if (speechUnlocked()) speak(ex.fr); }, [ex.fr]);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Type what you hear</p>
      <Speaker text={ex.fr} />
      <input className="input" lang="fr" autoCapitalize="none" autoCorrect="off" disabled={locked} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Écrivez en français" />
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!text.trim() || locked} onClick={() => report(isCorrect(text, ex.fr), ex.fr)}>Check</button>
      <button className="min-h-11 self-start px-3 text-sm text-muted underline" disabled={locked} onClick={skip}>Can&apos;t listen now</button>
    </div>
  );
}

function Match({ ex, locked, report, miss }: ExProps<Extract<Exercise, { kind: "match" }>> & { miss: () => void }) {
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
      if (next.length === ex.pairs.length) setTimeout(() => report(true, ""), 400); else playTick();
    } else { playError(); miss(); setBad(e); setTimeout(() => setBad(null), 500); }
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

function asChoose(fr: string): Exercise | null {
  const p = ALL_PHRASES.find((x) => x.fr === fr);
  if (!p) return null;
  const wrong = ALL_PHRASES.filter((o) => o.en !== p.en).sort(() => Math.random() - 0.5).slice(0, 3).map((o) => o.en);
  return { kind: "choose", fr: p.fr, answer: p.en, note: p.note, key: phraseKey(p.fr), choices: [p.en, ...wrong].sort(() => Math.random() - 0.5) };
}

const NONE: string[] = []; // stable defaults so the queue effect does not re-run every render

type Props = {
  lesson?: Lesson; // omitted in practice mode
  nextHref: string;
  mode?: "lesson" | "practice";
  /** The user's saved cards, or null when vocab_cards is unavailable (then review and card saving are skipped). */
  cards?: CardMap | null;
  /** Ids of lessons the user has completed (review source). */
  completed?: string[];
  /** Practice mode: the phrase keys to practice, in order. */
  practiceKeys?: string[];
};

export default function LessonPlayer({ lesson, nextHref, mode = "lesson", cards = null, completed = NONE, practiceKeys = NONE }: Props) {
  const practice = mode === "practice";
  const [queue, setQueue] = useState<Exercise[] | null>(null);
  const [i, setI] = useState(0);
  const [total, setTotal] = useState(1);
  const [result, setResult] = useState<{ ok: boolean; answer: string; note?: string } | null>(null);
  const [odile, setOdile] = useState<Cue | null>(null);
  const [sound, setSoundState] = useState(true);
  useEffect(() => setSoundState(soundOn()), []);
  const [summary, setSummary] = useState<{ xp: number; streak: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const router = useRouter();
  const missed = useRef<Set<string>>(new Set()); // phrase keys missed at least once this session
  const saved = useRef<{ cards: boolean; reward: { xp: number; streak: number } | null }>({ cards: false, reward: null });

  useEffect(() => {
    let q: Exercise[];
    if (practice) {
      q = buildPractice(practiceKeys.flatMap((k) => PHRASE_BY_KEY.get(k) ?? []));
    } else {
      let n = 0; // at most 3 listening rounds per lesson
      q = buildLesson(lesson!).filter((e) => e.kind !== "listen" || ++n <= 3);
      // earlier-lesson review at the end; skipped when cards are unavailable or nothing else is completed
      if (cards) q = [...q, ...buildReview(pickReviewPhrases(completed, lesson!.id, cards))];
    }
    setQueue(q); setTotal(q.length);
  }, [lesson, practice, practiceKeys, cards, completed]);

  if (!queue) return <p className="text-muted">Loading…</p>;
  const cur = queue[i];
  const ex = cur.kind === "listen" && noAudio ? asChoose(cur.fr) ?? cur : cur;

  const report: Report = (ok, answer, note) => {
    setResult({ ok, answer, note });
    if (ok) playSuccess(); else playError();
    setOdile(cue(pickReaction(ok ? "right" : "wrong"))); // starts with the sound; the feedback card is text
    const key = queue![i].key;
    if (!ok && key) missed.current.add(key);
    if (!ok) setQueue((q) => [...q!, q![i]]); // missed ones come back at the end
  };

  async function next() {
    if (saving) return;
    if (i + 1 < queue!.length) { setResult(null); return setI(i + 1); }
    setSaving(true); setSaveErr(false);
    const supabase = createClient();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tasks: Promise<void>[] = [];
    if (cards && !saved.current.cards) {
      // every phrase touched this session: Again if missed at least once, otherwise Good (one batched upsert)
      const keys = new Set<string>([...(lesson?.phrases.map((p) => phraseKey(p.fr)) ?? []), ...queue!.flatMap((e) => (e.key ? [e.key] : []))]);
      const now = new Date();
      const rows = [...keys].map((key) => {
        const s = schedule(cards[key]?.state ?? null, missed.current.has(key) ? Rating.Again : Rating.Good, now);
        return { key, state: s.state, due: s.due, last_review: now.toISOString() };
      });
      tasks.push((async () => {
        const { error } = await supabase.from("vocab_cards").upsert(rows, { onConflict: "user_id,key" });
        if (error) throw error;
        saved.current.cards = true;
      })());
    }
    if (!saved.current.reward) {
      tasks.push((async () => {
        const passed = new Set(queue!.flatMap((e) => (e.key && !missed.current.has(e.key) ? [e.key] : []))).size;
        const { data, error } = practice
          ? await supabase.rpc("award_xp", { p_source: "review", p_amount: Math.min(passed * 2, 20), p_tz: tz })
          : await supabase.rpc("complete_lesson", { p_lesson: lesson!.id, p_tz: tz });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        saved.current.reward = { xp: row?.xp ?? 0, streak: row?.streak ?? 0 };
      })());
    }
    const results = await Promise.allSettled(tasks); // a retry only repeats the part that failed
    if (results.every((r) => r.status === "fulfilled") && saved.current.reward) {
      setSummary(saved.current.reward);
      playDone();
    } else setSaveErr(true);
    setSaving(false);
  }

  function quit() {
    if ((i > 0 || result) && !confirm(practice ? "Leave this practice? Your progress in it will be lost." : "Leave this lesson? Your progress in it will be lost.")) return;
    router.push("/french");
  }

  if (summary)
    return (
      <div className="flex flex-col items-center gap-4 pt-4 text-center">
        <h1 className="text-2xl font-extrabold">{practice ? "Révision terminée !" : "Leçon terminée !"}</h1>
        <p className="text-lg font-bold text-primary">+{summary.xp} XP · <Flame size={18} className="inline -mt-0.5 text-accent" aria-hidden="true" /> {summary.streak}-day streak</p>
        <div className="w-full"><OdileSays topic="done" size={120} celebrate /></div>
        <Link href={nextHref} className="btn w-full">{practice ? "Back to French" : "Continue"}</Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <button onClick={quit} aria-label={practice ? "Quit practice" : "Quit lesson"} className="grid size-11 place-items-center text-muted"><X size={26} aria-hidden="true" /></button>
        <OdileTrack progress={i / Math.max(queue.length, total)} play={odile} />
        <button onClick={() => { const on = !sound; setSound(on); setSoundState(on); if (on) playTick(); }} aria-label={sound ? "Turn sounds off" : "Turn sounds on"}
          className="grid size-11 place-items-center text-muted">{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
      </div>
      {cur.kind !== "match" && cur.review && <span className="self-start rounded-full bg-tint px-2.5 py-0.5 text-xs font-bold text-primary">Review</span>}
      <div key={i}>
        {ex.kind === "choose" && <Choose ex={ex} locked={!!result} report={report} />}
        {ex.kind === "bank" && <Bank ex={ex} locked={!!result} report={report} />}
        {ex.kind === "listen" && <Listen ex={ex} locked={!!result} report={report} skip={() => setNoAudio(true)} />}
        {ex.kind === "match" && <Match ex={ex} locked={!!result} report={report} miss={() => setOdile(cue(pickReaction("miss")))} />}
      </div>
      {result && (
        <div className={`card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 ${result.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{result.ok ? "Bien !" : "Pas tout à fait"}</p>
          {!result.ok && result.answer && <p className="text-sm">Answer: <b>{result.answer}</b></p>}
          {result.note && <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{result.note}</span></p>}
          {saveErr && <p className="text-sm font-bold text-primary">Couldn&apos;t save. Check your connection and try again.</p>}
          <button className="btn" disabled={saving} onClick={next}>{saving ? "Saving…" : saveErr ? "Retry" : "Continue"}</button>
        </div>
      )}
    </div>
  );
}
