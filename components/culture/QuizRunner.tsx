"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleX, RotateCcw, Sparkles } from "lucide-react";
import OdileActor from "@/components/art/OdileActor";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import { GENTLE_KEY } from "@/lib/odile";
import { playDone, playError, playSuccess } from "@/lib/sounds";
import { createClient } from "@/lib/supabase/client";
import { QUIZ_KEY, addTo, readSet } from "./storage";

export type QuizQuestion = { id: string; card: string; cardTitle: string; scenario: string; options: string[]; answer: number; explain: string; fact?: string };
type Item = QuizQuestion & { shown: string[]; right: string };

const ROUND = 5;
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Questions not yet answered right come first, so repeated rounds work through the whole set. Options are shuffled. */
function pickRound(all: QuizQuestion[]): Item[] {
  const known = readSet(QUIZ_KEY);
  const fresh = shuffle(all.filter((q) => !known.has(q.id)));
  const seen = shuffle(all.filter((q) => known.has(q.id)));
  return [...fresh, ...seen].slice(0, ROUND).map((q) => ({ ...q, shown: shuffle(q.options), right: q.options[q.answer] }));
}

const END_LINES = {
  high: { gentle: "Parfait ! You would fit right in at a winstub.", sass: "Parfait ! Are you sure you're not secretly Alsatian?" },
  mid: { gentle: "Bien ! A few more rounds and you'll walk in like a local.", sass: "Pas mal. The baker would only raise one eyebrow." },
  low: { gentle: "Every slip here is one you won't make in Strasbourg.", sass: "Oh là là. Good thing this is practice and not the bakery." },
};

/** A short etiquette practice: 5 scenario questions with explanations. Small XP per round (2 per right answer); progress lives on this device. */
export default function QuizRunner({ questions }: { questions: QuizQuestion[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [k, setK] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [play, setPlay] = useState<Cue | null>(null);
  const [gentle, setGentle] = useState(false);
  const [xp, setXp] = useState<number | null>(null);

  useEffect(() => {
    let g = false;
    try { g = localStorage.getItem(GENTLE_KEY) === "1"; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- random order, gentle mode and stored progress exist only in the browser
    setGentle(g);
    setItems(pickRound(questions));
  }, [questions]);

  if (!items) return <p className="text-muted">Loading…</p>;
  const done = k >= items.length;

  function restart() {
    setItems(pickRound(questions)); setK(0); setSel(null); setChecked(false); setScore(0); setPlay(null); setXp(null);
  }

  if (done) {
    const band = score >= ROUND ? "high" : score >= 3 ? "mid" : "low";
    return (
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <h1 className="text-2xl font-extrabold">{score} of {items.length} right</h1>
        {xp ? <p className="-mt-2 font-bold text-primary">+{xp} XP</p> : null}
        <div className="flex w-full items-end gap-2 text-left">
          <OdileActor size={84} play={play} />
          <p className="card relative mb-3 min-h-12 flex-1 text-sm font-semibold" aria-live="polite">{END_LINES[band][gentle ? "gentle" : "sass"]}</p>
        </div>
        <button className="btn w-full" onClick={restart}><RotateCcw size={18} aria-hidden="true" /> Five more questions</button>
        <Link href="/culture" className="btn ghost w-full">Back to Culture</Link>
      </div>
    );
  }

  const q = items[k];
  const ok = sel === q.right;
  function check() {
    if (!sel) return;
    setChecked(true);
    if (sel === q.right) { setScore((s) => s + 1); addTo(QUIZ_KEY, q.id); playSuccess(); setPlay(cue(pickReaction("right"))); }
    else { playError(); setPlay(cue(pickReaction("wrong"))); }
  }
  function next() {
    const last = k + 1 >= items!.length;
    setK(k + 1); setSel(null); setChecked(false);
    if (last) {
      playDone(); setPlay(cue(pickReaction("finish")));
      const amount = score * 2;
      if (amount > 0) {
        // Best effort: a failed save never blocks the quiz. The server's daily cap applies.
        createClient().rpc("award_xp", { p_source: "review", p_amount: amount, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone })
          .then(({ error }) => { if (!error) setXp(amount); }, () => {});
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <OdileActor size={52} play={play} />
        <div className="flex-1">
          <p className="label">Question {k + 1} of {items.length}</p>
          <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={k} aria-label="Quiz progress">
            <div className="h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none" style={{ width: `${(100 * k) / items.length}%` }} />
          </div>
        </div>
      </div>
      <p className="text-lg font-bold">{q.scenario}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answers">
        {q.shown.map((o) => (
          <button key={o} role="radio" aria-checked={sel === o} disabled={checked} onClick={() => setSel(o)}
            className={`card min-h-12 text-left font-semibold ${sel === o ? "!border-primary !bg-tint" : ""} ${checked && o === q.right ? "!border-good" : ""}`}>
            {o}
          </button>
        ))}
      </div>
      {!checked ? (
        <button className="btn" disabled={!sel} onClick={check}>Check</button>
      ) : (
        <div className={`card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 ${ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="flex items-center gap-1.5 font-extrabold">
            {ok ? <CircleCheck size={20} className="text-good" aria-hidden="true" /> : <CircleX size={20} className="text-primary" aria-hidden="true" />}
            {ok ? "Bien vu !" : "Pas tout à fait"}
          </p>
          {!ok && <p className="text-sm">Best answer: <b>{q.right}</b></p>}
          <p className="text-sm">{q.explain}</p>
          {ok && q.fact && <p className="flex gap-1.5 text-sm text-muted"><Sparkles size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{q.fact}</span></p>}
          <Link href={`/culture#${q.card}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted underline">Read the card: {q.cardTitle}</Link>
          <button className="btn" onClick={next}>{k + 1 >= items.length ? "See my score" : "Continue"}</button>
        </div>
      )}
    </div>
  );
}
