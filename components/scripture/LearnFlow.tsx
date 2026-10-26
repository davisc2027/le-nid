"use client";

// Learning a verse by heart, as a path of six phases (see lib/scripture/mastery.ts and docs/verse-learning.md).
// The verse is split into chunks; each phase works chunk by chunk, then joins them up, with cues fading as the
// learner goes. Progress is saved after every step, so leaving and coming back resumes at the same step.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, Flame, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bibleInstalled, loadVerse } from "@/lib/bible/load";
import { refLabel } from "@/lib/bible/reference";
import { pickBlanks } from "@/lib/scripture/drills";
import { chunksFor, englishChunks, type Chunk } from "@/lib/scripture/chunks";
import {
  advance, advanceEnglish, CEMENT, englishActive, englishCounts, fraction, inEnglishNow, markCement, markLearned, PHASES,
  planEnglish, planPhase, resolve, restart, RECALL, skipEnglish, statusOf,
  type EnStep, type Progress, type Step,
} from "@/lib/scripture/mastery";
import { mergeSaved, saveProgress } from "@/lib/scripture/store";
import { stop as stopSpeech } from "@/lib/scripture/karaoke";
import { verseTokens } from "@/lib/scripture/tokens";
import { Rating, schedule } from "@/lib/srs";
import { playDone, playError, playSuccess, playTick, setSound, soundOn } from "@/lib/sounds";
import OdileActor from "@/components/art/OdileActor";
import OdileTrack from "@/components/art/OdileTrack";
import { PetalMeter } from "@/components/art/Rosace";
import { cue, pickReaction, type Cue } from "@/lib/odile-motion";
import { Build, Gaps, OrderChunks, Recall, type Done, type Marks } from "./Drills";
import { EnBuild, EnRead, EnVerse } from "./EnglishStage";
import { PhaseDots, PhaseList, type EnglishState } from "./PhasePath";
import TapWords, { AudioBar, playGroup, useSlow } from "./TapWords";
import VerseDiff from "./VerseDiff";

type Verse = { fr: string; en: string | null };
type Stored = Record<string, unknown>;

/** Everything that touches the network, so the flow can also run as a demo without a database. */
export type LearnApi = {
  /** Writes the FSRS card; `learnedAt` marks the first pass of Recall. Returns false on failure. */
  saveCard(key: string, row: { state: Stored; due: string; learned_at?: string }): Promise<boolean>;
  /** Awards XP through award_xp with source verse:<key>. Null on failure. */
  award(key: string, amount: number): Promise<{ xp: number; streak: number } | null>;
  saveProgress(key: string, p: Progress, flush?: boolean): void;
  loadProgress(key: string, server: unknown): Progress | null;
};

export const liveApi: LearnApi = {
  async saveCard(key, row) {
    const { error } = await createClient().from("srs_cards").upsert({ ref: key, ...row }, { onConflict: "user_id,ref" });
    return !error;
  },
  async award(key, amount) {
    const { data, error } = await createClient().rpc("award_xp", { p_source: `verse:${key}`, p_amount: amount, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return { xp: row?.xp ?? 0, streak: row?.streak ?? 0 };
  },
  saveProgress,
  loadProgress: mergeSaved,
};

const wordCount = (s: string) => verseTokens(s).filter((t) => t.word).length;

function stepTitle(s: Step, k: number): { title: string; sub?: string } {
  const of = (c: number) => (k > 1 ? `Chunk ${c + 1} of ${k}` : undefined);
  switch (s.kind) {
    case "listen": return { title: "Listen and read", sub: of(s.chunk) };
    case "listenAll": return { title: "The whole verse", sub: "Listen once more, then start building." };
    case "cloze": return { title: s.level === 1 ? "Fill the blanks" : "Fill more blanks", sub: of(s.chunk) };
    case "order": return { title: "Put the words in order", sub: of(s.chunk) };
    case "chain": return {
      title: k < 2 ? "Say it all" : s.upto + 1 === k ? "Chain the whole verse" : `Chain chunks 1 to ${s.upto + 1}`,
      sub: s.cue === "letters" ? "First letters help you." : "No cues this time.",
    };
    case "orderChunks": return { title: "Order the chunks" };
    case "gaps": return { title: "Fill the gaps", sub: "Type each missing word." };
    case "recall": return { title: "From memory", sub: "Type the whole verse." };
    case "cement": return { title: "Cement it", sub: "Type the verse from memory once more." };
  }
}

function enTitle(s: EnStep, k: number): { title: string; sub?: string } {
  switch (s.kind) {
    case "enRead": return { title: "Read it in English", sub: "Meet the verse in English first." };
    case "enBuild": return { title: "Build it in English", sub: k > 1 ? `Part ${s.chunk + 1} of ${k}` : undefined };
    case "enVerse": return { title: "Say it in English", sub: "Type the whole verse. Small slips are fine." };
  }
}

/** One line per chunk, with every word tappable and lit during "Play verse". */
function VerseLines({ chunks, group = "verse", gloss, current }: { chunks: Chunk[]; group?: string; gloss?: boolean; current?: number }) {
  const offsets = chunks.reduce<number[]>((acc, c, i) => [...acc, i ? acc[i - 1] + verseTokens(chunks[i - 1].fr).length : 0], []);
  return (
    <div className="flex flex-col gap-1">
      {chunks.map((c, i) => {
        const o = offsets[i];
        const dim = current !== undefined && i !== current;
        return (
          <div key={i} className={current === i ? "-mx-2 rounded-lg bg-tint px-2" : ""}>
            <TapWords text={c.fr} group={group} offset={o} className={`verse-text ${dim ? "text-muted" : ""}`} />
            {gloss && c.en && <p className="pb-1 text-sm italic text-muted">{c.en}</p>}
          </div>
        );
      })}
    </div>
  );
}

function Listen({ chunks, i, en, next }: { chunks: Chunk[]; i: number; en: string | null; next: () => void }) {
  const c = chunks[i];
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-2">
        <TapWords text={c.fr} group={`c${i}`} className="verse-text !text-[1.6rem] !leading-[1.45]" />
        {c.en ? <p className="text-base italic text-muted">{c.en}</p>
          : en && <details className="text-sm text-muted"><summary className="min-h-11 cursor-pointer py-2 font-bold">Meaning of the verse</summary><p className="italic">{en}</p></details>}
      </div>
      <AudioBar group={`c${i}`} texts={[c.fr]} label="Play chunk" second={chunks.length > 1 ? { group: "verse", texts: chunks.map((x) => x.fr), label: "Whole verse" } : undefined} />
      {chunks.length > 1 && (
        <div className="flex flex-col gap-1" aria-label="The whole verse, this chunk highlighted">
          <p className="label">In the verse</p>
          <VerseLines chunks={chunks} current={i} />
        </div>
      )}
      <button className="btn" onClick={next}>{i + 1 < chunks.length ? "Next chunk" : "Hear the whole verse"}</button>
    </div>
  );
}

function ListenAll({ chunks, en, next }: { chunks: Chunk[]; en: string | null; next: () => void }) {
  const glossed = chunks.some((c) => c.en);
  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-2">
        <VerseLines chunks={chunks} gloss />
        {!glossed && en && <p className="text-sm italic text-muted">{en}</p>}
      </div>
      <AudioBar group="verse" texts={chunks.map((c) => c.fr)} label="Play verse" />
      <button className="btn" onClick={next}>Start building</button>
    </div>
  );
}

function Cloze({ chunk, ratio, done }: { chunk: Chunk; ratio: number; done: Done }) {
  const lines = useMemo(() => [chunk.fr], [chunk.fr]);
  const given = useMemo(() => {
    const blanks = pickBlanks(chunk.fr, ratio);
    return new Set(verseTokens(chunk.fr).map((_, i) => i).filter((i) => !blanks.has(i)).map((i) => `0:${i}`));
  }, [chunk.fr, ratio]);
  return (
    <div className="flex flex-col gap-2">
      {chunk.en && <p className="text-sm italic text-muted">{chunk.en}</p>}
      <Build lines={lines} given={given} cue="blank" bank="all" strict={false} speakOnPlace done={done} />
    </div>
  );
}

type Props = {
  verseKey: string;
  /** FSRS state from srs_cards, or null for a new card. */
  state: Stored | null;
  /** srs_cards.learned_at (null until Recall is first passed). */
  learnedAt: string | null;
  /** srs_cards.progress (undefined before migration 0011). */
  saved?: unknown;
  api?: LearnApi;
};

export default function LearnFlow({ verseKey, state, learnedAt, saved, api = liveApi }: Props) {
  const router = useRouter();
  const [v, setV] = useState<Verse | null | undefined>(undefined);
  const [noBible, setNoBible] = useState(false);
  const [p, setP] = useState<Progress | null>(null);
  const [screen, setScreen] = useState<"path" | "run" | "learned" | "mastered">("path");
  const [attempt, setAttempt] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; marks?: Marks; phaseDone?: boolean; note?: string } | null>(null);
  const [odile, setOdile] = useState<Cue | null>(null);
  const [soundPick, setSoundState] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState(false);
  const [reward, setReward] = useState<{ xp: number; streak: number } | null>(null);
  const [cementHint, setCementHint] = useState(false);
  const [lastCement, setLastCement] = useState<"hard" | "again" | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [slow] = useSlow();
  const card = useRef<Stored | null>(state);
  const pending = useRef<{ card: boolean; reward: { xp: number; streak: number } | null; result: "good" | "hard" | "again" | null }>({ card: false, reward: null, result: null });
  const heading = useRef<HTMLHeadingElement>(null);
  const firstTime = !learnedAt;

  const chunks = useMemo(() => (v ? chunksFor(verseKey, v.fr) : []), [v, verseKey]);
  const sizes = useMemo(() => chunks.map((c) => wordCount(c.fr)), [chunks]);
  // English-first stage: the same verse in the app's English Bible text (none = go straight to French)
  const enChunks = useMemo(() => (v ? englishChunks(v.en, chunks) : []), [v, chunks]);
  const [enHint, setEnHint] = useState(false);

  const sound = soundPick ?? (v !== undefined && soundOn()); // read after mount (localStorage); the verse loads client-side
  useEffect(() => {
    let live = true;
    loadVerse(verseKey).then(async (x) => {
      if (!live) return;
      if (!x) setNoBible(!(await bibleInstalled()));
      // where this learner is on the path: newer of the database copy and this device's copy
      if (x) {
        const fr = chunksFor(verseKey, x.fr);
        setP(resolve(api.loadProgress(verseKey, saved), fr.map((c) => wordCount(c.fr)), learnedAt, new Date(), englishChunks(x.en, fr).length));
      }
      setV(x);
    });
    return () => { live = false; };
  }, [verseKey, api, saved, learnedAt]);
  useEffect(() => () => stopSpeech(), []); // leaving the page stops the voice
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  // move focus to the new step's heading so screen readers announce it (not on first render)
  const stepKey = p ? `${p.enDone ? "" : `en${p.enStep ?? 0}-`}${p.phase}-${p.step}` : "";
  const firstStep = useRef(true);
  useEffect(() => {
    if (!stepKey || screen !== "run") return;
    if (firstStep.current) { firstStep.current = false; return; }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [stepKey, screen]);

  if (v === undefined || (v && !p)) return <p className="text-muted">Loading…</p>;
  if (v === null || !p) return (
    <div className="flex flex-col gap-3">
      <p className="card" role="alert">{noBible ? "The Bible text isn't installed yet. Ask a leader to run the Bible build script (node scripts/build-bible.mjs) and commit public/bible." : "I couldn't find this verse's text. Check the reference."}</p>
      <Link href="/scripture" className="btn ghost">Back to the window</Link>
    </div>
  );

  const hasEn = enChunks.length > 0;
  const inEn = hasEn && englishActive(p, learnedAt);
  const enPlan = planEnglish(enChunks.length);
  const enAt = Math.min(p.enStep ?? 0, enPlan.length - 1);
  const enStep = enPlan[enAt];
  const enState: EnglishState | undefined = !hasEn ? undefined : inEn ? "active" : p.enDone && !p.enSkip ? "done" : undefined;
  const plan = planPhase(p.phase, sizes);
  const step = plan[Math.min(p.step, plan.length - 1)];
  const status = statusOf(p, learnedAt, now);
  const frac = fraction(p, sizes, hasEn && englishCounts(p, learnedAt) ? enChunks.length : undefined);
  const k = chunks.length;
  const lines = chunks.map((c) => c.fr);
  const update = (np: Progress, flush = false) => { setP(np); api.saveProgress(verseKey, np, flush); };

  /** Speaks the first chunk of a listening step, inside the tap that starts it (iOS needs that). */
  const speakFor = (np: Progress) => {
    if (hasEn && englishActive(np, learnedAt)) return; // the English stage has no French voice
    const s = planPhase(np.phase, sizes)[np.step];
    if (s?.kind === "listen") playGroup(`c${s.chunk}`, verseTokens(chunks[s.chunk].fr), slow);
    else if (s?.kind === "listenAll") playGroup("verse", verseTokens(v.fr), slow);
  };

  const done: Done = (ok, marks) => {
    if (inEn) {
      // English is a warm-up: no fails counted, no rating, no XP
      const lastEn = enAt + 1 >= enPlan.length;
      setFb({ ok, marks, phaseDone: ok && lastEn });
      if (!ok) { playError(); setOdile(cue(pickReaction("calmWrong"))); return; }
      if (lastEn) { playDone(); setOdile(cue(pickReaction("finish"))); } else { playSuccess(); setOdile(cue(pickReaction("calmRight"))); }
      return;
    }
    const last = p.step + 1 >= plan.length && p.phase < RECALL;
    setFb({ ok, marks, phaseDone: ok && last });
    if (!ok) {
      playError(); setOdile(cue(pickReaction("calmWrong")));
      if (step.kind === "recall") update({ ...p, fails: (p.fails ?? 0) + 1, updatedAt: new Date().toISOString() });
      return;
    }
    if (last) { playDone(); setOdile(cue(pickReaction("finish"))); }
    else { playSuccess(); setOdile(cue(pickReaction("calmRight"))); }
  };

  async function finishRecall() {
    if (saving) return;
    setSaving(true); setSaveErr(false);
    const rating = p!.hint || p!.fails ? Rating.Hard : Rating.Good;
    const r = pending.current;
    if (!r.card) {
      const s = schedule(card.current, rating);
      r.card = await api.saveCard(verseKey, { state: s.state, due: s.due, learned_at: new Date().toISOString() });
      if (r.card) card.current = s.state;
    }
    if (r.card && !r.reward) r.reward = await api.award(verseKey, firstTime ? 15 : 8);
    setSaving(false);
    if (!r.card || !r.reward) return setSaveErr(true);
    setReward(r.reward);
    pending.current = { card: false, reward: null, result: null };
    update(markLearned(p!), true);
    setScreen("learned");
    setOdile(cue(pickReaction("finish")));
    playDone();
  }

  async function finishCement(result: "good" | "hard" | "again") {
    if (saving) return;
    setSaving(true); setSaveErr(false);
    const s = schedule(card.current, result === "good" ? Rating.Good : result === "hard" ? Rating.Hard : Rating.Again);
    const ok = await api.saveCard(verseKey, { state: s.state, due: s.due });
    setSaving(false);
    if (!ok) { pending.current.result = result; return setSaveErr(true); }
    card.current = s.state;
    pending.current.result = null;
    setCementHint(false);
    setLastCement(result === "good" ? null : result);
    update(markCement(p!, result === "good"), true);
    if (result === "good") { setScreen("mastered"); setOdile(cue(pickReaction("finish"))); playDone(); }
    else { setScreen("path"); setAttempt((a) => a + 1); }
  }

  function next() {
    if (!fb) return;
    const res = fb;
    if (inEn) {
      setFb(null);
      if (!res.ok) return setAttempt(attempt + 1);
      const np = advanceEnglish(p!, enChunks.length);
      update(np); setEnHint(false); speakFor(np);
      return;
    }
    if (step.kind === "cement") { setFb(null); return finishCement(!res.ok ? "again" : cementHint ? "hard" : "good"); }
    if (!res.ok) { setFb(null); return setAttempt(attempt + 1); }
    if (step.kind === "recall") { setFb(null); return finishRecall(); }
    setFb(null);
    update(advance(p!, sizes));
  }

  /** "Skip English": never blocks; straight to the French path (the first French chunk is spoken inside this tap). */
  const skipEn = () => {
    const np = skipEnglish(p!);
    update(np); setFb(null); setEnHint(false); setAttempt(attempt + 1); setScreen("run"); speakFor(np);
  };

  const go = (np: Progress) => { update(np); setFb(null); setAttempt(attempt + 1); setScreen("run"); speakFor(np); };

  function quit() {
    if (screen === "run" && (p!.phase > 0 || p!.step > 0 || (inEn && enAt > 0) || fb) && p!.phase !== CEMENT
      && !confirm("Leave now? Your place is saved, so you can pick up right here next time.")) return;
    router.push("/scripture");
  }

  const header = (
    <div className="flex items-end gap-3">
      <button onClick={quit} aria-label="Quit" className="grid size-11 shrink-0 place-items-center text-muted"><X size={26} aria-hidden="true" /></button>
      <OdileTrack progress={frac} play={odile} />
      <button onClick={() => { const on = !sound; setSound(on); setSoundState(on); if (on) playTick(); }} aria-label={sound ? "Turn sounds off" : "Turn sounds on"}
        className="grid size-11 shrink-0 place-items-center text-muted">{sound ? <Volume2 size={24} aria-hidden="true" /> : <VolumeX size={24} aria-hidden="true" />}</button>
    </div>
  );

  // ---- saving / save error (Recall and Cement write to the database) -----------------------------------
  if (saving || saveErr) return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex flex-col gap-3 pt-4 text-center">
        <h1 className="text-xl font-extrabold">{saving ? "Saving…" : "Couldn't save"}</h1>
        {saveErr && <p className="text-muted" role="alert">Check your connection, then try again. Your work on this verse is kept.</p>}
        <button className="btn" disabled={saving} onClick={() => (step.kind === "cement" ? finishCement(pending.current.result ?? "again") : finishRecall())}>{saving ? "Saving…" : "Retry"}</button>
      </div>
    </div>
  );

  // ---- celebrations -------------------------------------------------------------------------------------
  if (screen === "learned" || screen === "mastered") {
    const mastered = screen === "mastered";
    return (
      <div className="flex flex-col items-center gap-4 pt-2 text-center">
        <span role="img" aria-label="Odile celebrating" className="flex" style={{ paddingTop: 46 }}><OdileActor size={120} play={odile} /></span>
        <div className="flex items-center gap-2">
          <PetalMeter value={1} mastered={mastered} size={40} color={verseKey.length} />
          <h1 className="text-2xl font-extrabold">{mastered ? "Verset maîtrisé !" : "Verset appris !"}</h1>
        </div>
        <div className="card w-full text-left"><VerseLines chunks={chunks} /></div>
        <div className="w-full"><AudioBar group="verse" texts={lines} label="Play verse" hint={false} /></div>
        {reward && !mastered && (
          <p className="text-lg font-bold text-primary">+{reward.xp} XP · <Flame size={18} className="inline -mt-0.5 text-accent" aria-hidden="true" /> {reward.streak}-day streak</p>
        )}
        <p className="text-sm text-muted">
          {mastered ? "It&apos;s yours now. Odile will bring it back in reviews from time to time, so it stays fresh."
            : p.masteredAt ? "Well practised. It stays mastered, and reviews keep it fresh."
            : "One phase to go: Cement. Come back in about 10 minutes, or tomorrow, for a short retest. Spacing it out is what makes it stick."}
        </p>
        <Link href="/scripture" className="btn w-full">Back to the window</Link>
      </div>
    );
  }

  // ---- the path: start, resume, waiting for the retest, mastered -------------------------------------------
  if (screen === "path") {
    const mins = status.kind === "wait" ? Math.max(1, Math.ceil((status.at.getTime() - now.getTime()) / 60_000)) : 0;
    const showVerse = status.kind === "new" || status.kind === "mastered";
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div className="flex items-center gap-3">
          <PetalMeter value={frac} mastered={status.kind === "mastered"} size={52} color={verseKey.length}
            label={status.kind === "mastered" ? "Mastered" : `${Math.round(frac * 100)}% of the way`} />
          <div className="min-w-0">
            <p className="label">{status.kind === "mastered" ? "Mastered" : inEnglishNow(p) && inEn ? "English first" : status.kind === "new" ? (inEn ? "New verse · English first" : "New verse") : status.kind === "learning" ? `Phase ${p.phase + 1} of ${PHASES.length}` : "Learned"}</p>
            <h1 ref={heading} tabIndex={-1} className="text-2xl font-extrabold outline-none">{refLabel(verseKey)}</h1>
          </div>
        </div>
        {showVerse && <div className="card"><VerseLines chunks={chunks} /></div>}
        {lastCement && status.kind === "wait" && (
          <p className="card !border-primary text-sm" role="status">{lastCement === "hard" ? "Almost." : "Not quite yet, and that&apos;s normal."} Do it once more without hints after a short break, and it&apos;s mastered.</p>
        )}
        <div className="card"><PhaseList phase={p.phase} step={p.step} steps={plan.length} mastered={status.kind === "mastered"}
          english={enState} enStep={enAt} enSteps={enPlan.length} /></div>
        {status.kind === "new" && (
          <>
            <button className="btn" onClick={() => go(p)}>{inEn ? (inEnglishNow(p) ? "Resume: English" : "Start with English") : "Start"}</button>
            {inEn && <button className="btn ghost" onClick={skipEn}>Skip English</button>}
            <p className="text-center text-xs text-muted">About 10 minutes. You can stop anytime: Le Nid keeps your place.</p>
          </>
        )}
        {status.kind === "learning" && (
          <div className="flex flex-col gap-2">
            <button className="btn" onClick={() => go(p)}>Resume: {PHASES[p.phase].name}</button>
            <button className="btn ghost" onClick={() => { if (confirm("Start this verse again from Phase 1?")) go(restart(p, sizes)); }}>
              <RotateCcw size={18} aria-hidden="true" /> Start over
            </button>
          </div>
        )}
        {status.kind === "wait" && (
          <div className="card flex flex-row items-center gap-3" role="status">
            <Clock size={22} className="shrink-0 text-accent" aria-hidden="true" />
            <p className="text-sm">The retest opens in <b>{mins} {mins === 1 ? "minute" : "minutes"}</b>. Spacing it out is what makes it stick, so go do something else for a bit.</p>
          </div>
        )}
        {status.kind === "retest" && (
          <div className="flex flex-col gap-2">
            <button className="btn" onClick={() => { setCementHint(false); go(p); }}>Start the retest</button>
            <button className="btn ghost" onClick={() => go(restart(p, sizes))}><RotateCcw size={18} aria-hidden="true" /> Practice from the start</button>
          </div>
        )}
        {status.kind === "mastered" && (
          <div className="flex flex-col gap-2">
            <AudioBar group="verse" texts={lines} label="Play verse" />
            <button className="btn ghost" onClick={() => go(restart(p, sizes))}><RotateCcw size={18} aria-hidden="true" /> Practice again</button>
          </div>
        )}
        <Link href="/scripture" className="btn ghost">Back to the window</Link>
      </div>
    );
  }

  // ---- a step of the path ----------------------------------------------------------------------------------
  const t = inEn ? enTitle(enStep, enChunks.length) : stepTitle(step, k);
  const advanceEnNow = () => { update(advanceEnglish(p, enChunks.length)); };
  const advanceNow = () => { const np = advance(p, sizes); update(np); speakFor(np); };
  return (
    <div className="flex flex-col gap-4">
      {header}
      <div className="flex items-center justify-between gap-2">
        <PhaseDots phase={p.phase} english={enState} />
        <PetalMeter value={frac} size={30} color={verseKey.length} label={`${Math.round(frac * 100)}% of the way to mastery`} />
      </div>
      <div>
        <p className="label">{refLabel(verseKey)} · {inEn ? "English first" : `${enState ? "French · " : ""}Phase ${p.phase + 1}: ${PHASES[p.phase].name}`}</p>
        <h1 ref={heading} tabIndex={-1} className="text-xl font-extrabold outline-none">{t.title}</h1>
        {t.sub && <p className="text-sm text-muted">{t.sub}</p>}
      </div>
      <div key={`${stepKey}-${attempt}`} className={fb ? "pointer-events-none" : ""}>
        {inEn && enStep.kind === "enRead" && <EnRead chunks={enChunks} next={advanceEnNow} />}
        {inEn && enStep.kind === "enBuild" && <EnBuild chunk={enChunks[Math.min(enStep.chunk, enChunks.length - 1)]} done={done} />}
        {inEn && enStep.kind === "enVerse" && (
          <EnVerse text={enChunks.join(" ")} chunks={enChunks} hinted={enHint} onHint={() => setEnHint(true)} done={done} />
        )}
        {!inEn && step.kind === "listen" && <Listen chunks={chunks} i={step.chunk} en={v.en} next={advanceNow} />}
        {!inEn && step.kind === "listenAll" && <ListenAll chunks={chunks} en={v.en} next={advanceNow} />}
        {!inEn && step.kind === "cloze" && <Cloze chunk={chunks[step.chunk]} ratio={step.ratio} done={done} />}
        {!inEn && step.kind === "order" && <Build lines={[chunks[step.chunk].fr]} cue="blank" bank="all" strict={false} speakOnPlace done={done} />}
        {!inEn && step.kind === "chain" && (
          <Build lines={lines.slice(0, step.upto + 1)} cue={step.cue === "letters" ? "letters" : "blank"} bank="line" strict={step.cue === "none"} done={done} />
        )}
        {!inEn && step.kind === "orderChunks" && <OrderChunks chunks={lines} done={done} />}
        {!inEn && step.kind === "gaps" && <Gaps lines={lines} done={done} />}
        {!inEn && step.kind === "recall" && (
          <Recall text={v.fr} lines={lines} hinted={!!p.hint} done={done}
            onHint={() => update({ ...p, hint: true, updatedAt: new Date().toISOString() })} />
        )}
        {!inEn && step.kind === "cement" && <Recall text={v.fr} lines={lines} hinted={cementHint} done={done} onHint={() => setCementHint(true)} />}
      </div>
      {fb && (
        <div className={`card sticky bottom-[max(1rem,env(safe-area-inset-bottom))] flex flex-col gap-2 shadow-lg ${fb.ok ? "!border-good" : "!border-primary"}`} role="status" aria-live="polite">
          <p className="font-extrabold">
            {inEn ? (fb.ok ? (fb.phaseDone ? "Good! English done. Now the same verse in French." : "Good!") : "Not quite. Look again and retry.")
            : fb.ok ? (fb.phaseDone ? `Phase ${p.phase + 1} done: ${PHASES[p.phase].name}` : step.kind === "recall" ? "Bien ! You know it by heart." : step.kind === "cement" ? (cementHint ? "Bien ! Next time, try it without the hint." : "Bien ! It stuck.") : "Bien !")
              : step.kind === "cement" ? "Not quite. It will come back after a short break." : "Pas tout à fait. Look again and retry."}
          </p>
          {!inEn && fb.phaseDone && p.phase + 1 < PHASES.length && <p className="text-sm text-muted">Next: {PHASES[p.phase + 1].name}. {PHASES[p.phase + 1].blurb}</p>}
          {!fb.ok && fb.marks && <div className="max-h-[40vh] overflow-auto"><VerseDiff marks={fb.marks} lang={inEn ? "en" : "fr"} /></div>}
          <button className="btn" autoFocus onClick={next}>{fb.ok ? "Continue" : !inEn && step.kind === "cement" ? "Continue" : "Try again"}</button>
          {inEn && !fb.ok && <button className="btn ghost" onClick={skipEn}>Skip English, on to French</button>}
        </div>
      )}
      {inEn && !fb && (
        <button type="button" className="btn ghost self-center !border-transparent !bg-transparent underline" onClick={skipEn}>Skip English</button>
      )}
    </div>
  );
}
