"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Lightbulb, Volume2, VolumeX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  buildLesson, buildPractice, buildReview, noAudioFallback, phraseKey, pickReviewPhrases, PHRASE_BY_KEY,
  type CardMap, type Exercise,
} from "@/lib/french/exercises";
import { Rating, schedule } from "@/lib/srs";
import type { Lesson } from "@/lib/french/content";
import OdileTrack from "@/components/art/OdileTrack";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import OdileSays from "@/components/art/OdileSays";
import { playDone, playError, playSuccess, playTick, setSound, soundOn } from "@/lib/sounds";
import { Bank, Choose, Gap, Hear, Listen, Match, Pick, Register, Type, type Report } from "./ExerciseViews";
import MeetPhrases from "./MeetPhrases";

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
  const [result, setResult] = useState<{ ok: boolean; answer: string; note?: string; why?: string } | null>(null);
  const [intro, setIntro] = useState(!practice); // lessons open with the "meet the phrases" cards
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
      q = buildLesson(lesson!); // 12-15 exercises
      // earlier-lesson review at the end (up to 3, so a lesson stays at 18 or fewer); skipped when cards are
      // unavailable or nothing else is completed
      if (cards) q = [...q, ...buildReview(pickReviewPhrases(completed, lesson!.id, cards, 3), q[q.length - 1].kind)];
    }
    setQueue(q); setTotal(q.length);
  }, [lesson, practice, practiceKeys, cards, completed]);

  if (!queue) return <p className="text-muted">Loading…</p>;
  const cur = queue[i];
  const ex = noAudio ? noAudioFallback(cur) ?? cur : cur;
  const skip = () => setNoAudio(true);

  const report: Report = (ok, answer, note, why) => {
    setResult({ ok, answer, note, why });
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
        <OdileTrack progress={intro ? 0 : i / Math.max(queue.length, total)} play={odile} />
        <button onClick={() => { const on = !sound; setSound(on); setSoundState(on); if (on) playTick(); }} aria-label={sound ? "Turn sounds off" : "Turn sounds on"}
          className="grid size-11 place-items-center text-muted">{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
      </div>
      {intro && lesson ? (
        <MeetPhrases phrases={lesson.phrases} onDone={() => setIntro(false)} />
      ) : (
        <>
          {cur.kind !== "match" && cur.review && <span className="self-start rounded-full bg-tint px-2.5 py-0.5 text-xs font-bold text-primary">Review</span>}
          <div key={`${i}-${ex.kind}`}>
            {ex.kind === "choose" && <Choose ex={ex} locked={!!result} report={report} skip={skip} />}
            {ex.kind === "hear" && <Hear ex={ex} locked={!!result} report={report} skip={skip} />}
            {ex.kind === "pick" && <Pick ex={ex} locked={!!result} report={report} />}
            {ex.kind === "gap" && <Gap ex={ex} locked={!!result} report={report} />}
            {ex.kind === "register" && <Register ex={ex} locked={!!result} report={report} />}
            {ex.kind === "type" && <Type ex={ex} locked={!!result} report={report} />}
            {ex.kind === "bank" && <Bank ex={ex} locked={!!result} report={report} />}
            {ex.kind === "listen" && <Listen ex={ex} locked={!!result} report={report} skip={skip} />}
            {ex.kind === "match" && <Match ex={ex} locked={!!result} report={report} miss={() => setOdile(cue(pickReaction("miss")))} />}
          </div>
        </>
      )}
      {result && (
        <div className={`card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 ${result.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{result.ok ? "Bien !" : "Pas tout à fait"}</p>
          {!result.ok && result.answer && <p className="text-sm">Answer: <b>{result.answer}</b></p>}
          {!result.ok && result.why && <p className="text-sm">{result.why}</p>}
          {result.note && <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{result.note}</span></p>}
          {saveErr && <p className="text-sm font-bold text-primary">Couldn&apos;t save. Check your connection and try again.</p>}
          <button className="btn" disabled={saving} onClick={next}>{saving ? "Saving…" : saveErr ? "Retry" : "Continue"}</button>
        </div>
      )}
    </div>
  );
}
