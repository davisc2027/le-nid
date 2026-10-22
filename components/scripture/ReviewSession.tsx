"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadVerse } from "@/lib/bible/load";
import { refLabel } from "@/lib/bible/reference";
import { firstLetters, gradeRecall, PASS } from "@/lib/scripture/drills";
import { Rating, schedule } from "@/lib/srs";
import Stork from "@/components/art/Stork";
import VerseDiff from "./VerseDiff";

type Card = { ref: string; state: Record<string, unknown> | null };

export default function ReviewSession({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);
  const [verse, setVerse] = useState<string | null>(null);
  const [res, setRes] = useState<{ ok: boolean; marks: { word: string; ok: boolean }[] } | null>(null);
  const [passed, setPassed] = useState(0);
  const [sum, setSum] = useState<{ xp: number; streak: number } | null>(null);
  const card = cards[i];

  useEffect(() => { if (card) loadVerse(card.ref).then((v) => setVerse(v?.fr ?? "")); }, [card]);

  async function check() {
    const g = gradeRecall(text, verse!);
    const ok = g.score >= PASS;
    setRes({ ok, marks: g.marks });
    const s = schedule(card.state, ok ? (hint ? Rating.Hard : Rating.Good) : Rating.Again);
    await createClient().from("srs_cards").update({ state: s.state, due: s.due }).eq("ref", card.ref);
    if (ok) setPassed((n) => n + 1);
  }

  async function next() {
    setRes(null); setText(""); setHint(false); setVerse(null);
    if (i + 1 < cards.length) return setI(i + 1);
    const { data } = await createClient().rpc("award_xp", { p_source: "review", p_amount: Math.min(passed * 3, 30), p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    const row = Array.isArray(data) ? data[0] : data;
    setSum({ xp: row?.xp ?? 0, streak: row?.streak ?? 0 });
  }

  if (!cards.length) return <p className="card">Nothing due. Odile approves.</p>;
  if (sum) return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <Stork mood="cheer" size={130} label="Odile celebrating" />
      <h1 className="text-2xl font-extrabold">Révision terminée !</h1>
      <p className="text-lg font-bold text-primary">{passed}/{cards.length} recalled · +{sum.xp} XP · 🔥 {sum.streak}</p>
      <Link href="/scripture" className="btn w-full">Back to the window</Link>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="label">{i + 1} of {cards.length}</p>
      <h1 className="text-xl font-extrabold">{refLabel(card.ref)}</h1>
      {hint && verse && <p className="verse-text tracking-widest text-muted">{firstLetters(verse)}</p>}
      <textarea className="input verse-text" rows={5} lang="fr" autoCapitalize="none" autoCorrect="off" disabled={!!res}
        value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrivez le verset de mémoire" />
      {!res && (
        <div className="flex gap-2">
          <button className="btn" disabled={!text.trim() || !verse} onClick={check}>Check</button>
          <button className="btn ghost" onClick={() => setHint(true)}>First letters</button>
        </div>
      )}
      {res && (
        <div className={`card ${res.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{res.ok ? "Bien !" : "Not yet. It will come back soon."}</p>
          <VerseDiff marks={res.marks} />
          <button className="btn" onClick={next}>Continue</button>
        </div>
      )}
    </div>
  );
}
