"use client";

import { useEffect, useState } from "react";
import { Flame, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bibleInstalled, loadVerse } from "@/lib/bible/load";
import { refLabel } from "@/lib/bible/reference";
import { firstLetters, gradeRecall, PASS } from "@/lib/scripture/drills";
import { cementFromReview } from "@/lib/scripture/mastery";
import { mergeSaved, saveProgress } from "@/lib/scripture/store";
import { Rating, schedule } from "@/lib/srs";
import OdileActor from "@/components/art/OdileActor";
import OdileTrack from "@/components/art/OdileTrack";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import VerseDiff from "./VerseDiff";
import { AudioBar } from "./TapWords";

type Card = { ref: string; state: Record<string, unknown> | null; learned_at?: string | null; progress?: unknown };

export default function ReviewSession({ cards }: { cards: Card[] }) {
  const [i, setI] = useState(0);
  const [text, setText] = useState("");
  const [hint, setHint] = useState(false);
  const [verse, setVerse] = useState<string | null>(null);
  const [res, setRes] = useState<{ ok: boolean; marks: { word: string; ok: boolean }[] } | null>(null);
  const [passed, setPassed] = useState(0);
  const [sum, setSum] = useState<{ xp: number; streak: number } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<"bible" | "verse" | null>(null);
  const [odile, setOdile] = useState<Cue | null>(null);
  const card = cards[i];

  useEffect(() => {
    if (!card) return;
    loadVerse(card.ref).then(async (v) => {
      setVerse(v?.fr ?? null);
      setMissing(v ? null : (await bibleInstalled()) ? "verse" : "bible");
    });
  }, [card]);

  async function check() {
    if (busy) return;
    const g = gradeRecall(text, verse!);
    const ok = g.score >= PASS;
    const s = schedule(card.state, ok ? (hint ? Rating.Hard : Rating.Good) : Rating.Again);
    setBusy(true); setErr("");
    const { error } = await createClient().from("srs_cards").update({ state: s.state, due: s.due }).eq("ref", card.ref);
    setBusy(false);
    if (error) return setErr("Couldn't save your answer. Check your connection and tap Check again.");
    setRes({ ok, marks: g.marks });
    setOdile(cue(pickReaction(ok ? "calmRight" : "calmWrong")));
    if (ok) setPassed((n) => n + 1);
    // a clean recall after the delay is exactly what the Cement retest asks for
    if (ok && !hint) {
      const np = cementFromReview(mergeSaved(card.ref, card.progress), card.learned_at ?? null);
      if (np) saveProgress(card.ref, np, true);
    }
  }

  async function next() {
    if (busy) return;
    if (i + 1 < cards.length) { setRes(null); setText(""); setHint(false); setVerse(null); setMissing(null); return setI(i + 1); }
    setBusy(true); setErr("");
    const { data, error } = await createClient().rpc("award_xp", { p_source: "review", p_amount: Math.min(passed * 3, 30), p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    setBusy(false);
    if (error) return setErr("Couldn't save your XP. Check your connection and tap Continue again.");
    const row = Array.isArray(data) ? data[0] : data;
    setSum({ xp: row?.xp ?? 0, streak: row?.streak ?? 0 });
    setOdile(cue(pickReaction("finish")));
  }

  if (!cards.length) return <p className="card">Nothing due. Odile approves.</p>;
  if (sum) return (
    <div className="flex flex-col items-center gap-4 pt-4 text-center">
      <span role="img" aria-label="Odile celebrating" className="flex" style={{ paddingTop: 46 }}><OdileActor size={130} play={odile} /></span>
      <h1 className="text-2xl font-extrabold">Révision terminée !</h1>
      <p className="text-lg font-bold text-primary">{passed}/{cards.length} recalled · +{sum.xp} XP · <Flame size={18} className="inline -mt-0.5 text-accent" aria-hidden="true" /> {sum.streak}</p>
      <Link href="/scripture" className="btn w-full">Back to the window</Link>
    </div>
  );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <Link href="/scripture" aria-label="Quit" className="grid size-11 shrink-0 place-items-center text-2xl text-muted"><X size={26} aria-hidden="true" /></Link>
        <OdileTrack progress={i / cards.length} play={odile} />
      </div>
      <p className="label">{i + 1} of {cards.length}</p>
      <h1 className="text-xl font-extrabold">{refLabel(card.ref)}</h1>
      {hint && verse && <p className="verse-text tracking-widest text-muted">{firstLetters(verse)}</p>}
      {missing && (
        <div className="card gap-2" role="alert">
          <p>{missing === "bible" ? "The Bible text isn't installed yet. Ask a leader to install it." : "I couldn't find this verse's text."}</p>
          {i + 1 < cards.length && <button className="btn ghost" onClick={next}>Skip this verse</button>}
          <Link href="/scripture" className="btn ghost">Back to the window</Link>
        </div>
      )}
      {!missing && <textarea className="input verse-text" rows={5} lang="fr" autoCapitalize="none" autoCorrect="off" disabled={!!res}
        value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrivez le verset de mémoire" />}
      {err && <p className="text-sm text-primary" role="alert">{err}</p>}
      {!res && !missing && (
        <div className="flex gap-2">
          <button className="btn" disabled={!text.trim() || !verse || busy} onClick={check}>{busy ? "Saving…" : "Check"}</button>
          <button className="btn ghost" onClick={() => setHint(true)}>First letters</button>
        </div>
      )}
      {res && (
        <div className={`card flex flex-col gap-2 ${res.ok ? "!border-good" : "!border-primary"}`} role="status">
          <p className="font-extrabold">{res.ok ? "Bien !" : "Not yet. It will come back soon."}</p>
          <VerseDiff marks={res.marks} group={`review-${i}`} />
          {verse && <AudioBar group={`review-${i}`} texts={[verse]} label="Play verse" />}
          <button className="btn" onClick={next} disabled={busy}>Continue</button>
        </div>
      )}
    </div>
  );
}
