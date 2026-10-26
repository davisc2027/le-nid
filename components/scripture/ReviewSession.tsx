"use client";

import { useEffect, useState } from "react";
import { Flame, X } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { bibleInstalled, loadVerse } from "@/lib/bible/load";
import { refLabel, refLabelEn } from "@/lib/bible/reference";
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
  // English first: a quick recall in English before the French one. It never rates the card, never counts as a miss, never gives XP.
  const [stage, setStage] = useState<"en" | "fr">("en");
  const [en, setEn] = useState<string | null>(null);
  const [enText, setEnText] = useState("");
  const [enHint, setEnHint] = useState(false);
  const [enRes, setEnRes] = useState<{ ok: boolean; marks: { word: string; ok: boolean }[] } | null>(null);
  const [skipAllEn, setSkipAllEn] = useState(false);
  const card = cards[i];

  useEffect(() => {
    if (!card) return;
    loadVerse(card.ref).then(async (v) => {
      setVerse(v?.fr ?? null);
      setEn(v?.en?.split(/\s+/).filter(Boolean).join(" ") || null);
      setMissing(v ? null : (await bibleInstalled()) ? "verse" : "bible");
    });
  }, [card]);

  const loaded = verse !== null || missing !== null;
  const inEn = stage === "en" && !skipAllEn && !!verse && !!en && !missing;
  const toFrench = () => { setStage("fr"); setEnRes(null); setEnHint(false); };
  function checkEn() {
    const g = gradeRecall(enText, en!);
    const ok = g.score >= 0.8;
    setEnRes({ ok, marks: g.marks });
    if (ok) setOdile(cue(pickReaction("calmRight")));
  }

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
    if (i + 1 < cards.length) { setRes(null); setText(""); setHint(false); setVerse(null); setMissing(null); setEn(null); setEnText(""); setEnRes(null); setEnHint(false); setStage("en"); return setI(i + 1); }
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
      <p className="label">{i + 1} of {cards.length}{inEn ? " · English first" : en && !skipAllEn && !missing ? " · Now in French" : ""}</p>
      <h1 className="text-xl font-extrabold">{inEn ? refLabelEn(card.ref) : refLabel(card.ref)}</h1>
      {inEn && (
        <div className="flex flex-col gap-3" lang="en">
          <p className="card verse-text" aria-label="First words">{en!.split(" ").slice(0, 3).join(" ")}…</p>
          {enHint && !enRes && <p className="verse-text tracking-widest text-muted" aria-label="First letters hint">{firstLetters(en!)}</p>}
          <textarea className="input verse-text" rows={4} autoCapitalize="none" autoCorrect="off" spellCheck={false} disabled={!!enRes}
            aria-label="The verse in English, from memory" value={enText} onChange={(e) => setEnText(e.target.value)} placeholder="Type it in English" />
          {!enRes && (
            <div className="flex flex-wrap gap-2">
              <button className="btn" disabled={!enText.trim()} onClick={checkEn}>Check</button>
              <button className="btn ghost" onClick={() => setEnHint(true)}>First letters</button>
              <button className="btn ghost" onClick={toFrench}>I know it</button>
            </div>
          )}
          {enRes && (
            <div className={`card flex flex-col gap-2 ${enRes.ok ? "!border-good" : "!border-primary"}`} role="status">
              <p className="font-extrabold">{enRes.ok ? "Good!" : "Nearly. Here it is:"}</p>
              {!enRes.ok && <VerseDiff marks={enRes.marks} lang="en" />}
              <button className="btn" autoFocus onClick={toFrench}>Now in French</button>
            </div>
          )}
          <p className="text-xs text-muted">Just a warm-up: it does not count for your review.</p>
          <button type="button" className="min-h-11 self-center text-sm font-bold text-muted underline" onClick={() => { setSkipAllEn(true); toFrench(); }}>Skip English for this session</button>
        </div>
      )}
      {!inEn && hint && verse && <p className="verse-text tracking-widest text-muted">{firstLetters(verse)}</p>}
      {missing && (
        <div className="card gap-2" role="alert">
          <p>{missing === "bible" ? "The Bible text isn't installed yet. Ask a leader to install it." : "I couldn't find this verse's text."}</p>
          {i + 1 < cards.length && <button className="btn ghost" onClick={next}>Skip this verse</button>}
          <Link href="/scripture" className="btn ghost">Back to the window</Link>
        </div>
      )}
      {!missing && loaded && !inEn && <textarea className="input verse-text" rows={5} lang="fr" autoCapitalize="none" autoCorrect="off" disabled={!!res}
        value={text} onChange={(e) => setText(e.target.value)} placeholder="Écrivez le verset de mémoire" />}
      {err && <p className="text-sm text-primary" role="alert">{err}</p>}
      {!res && !missing && loaded && !inEn && (
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
