"use client";

import { useEffect, useState } from "react";
import { ArrowDownUp, CircleCheck, MessageSquareText, TextCursorInput } from "lucide-react";
import { STEP_IDS, type GospelContent, type StepId } from "@/lib/gospel";
import { createClient } from "@/lib/supabase/client";
import { SpeakButtons } from "./Speak";

const XP_KEY = "le-nid-circles-xp-day";
const XP = 5;
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const plain = (title: string) => title.replace(/^\d+\s*·\s*/, "");

const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

/** Small XP, once a day per device, best effort like the culture quiz: a failed save never blocks the practice. */
async function awardOncePerDay(): Promise<number> {
  try {
    if (localStorage.getItem(XP_KEY) === localDay()) return 0;
  } catch { /* storage blocked: still try once */ }
  try {
    const { error } = await createClient().rpc("award_xp", { p_source: "review", p_amount: XP, p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
    if (error) return 0;
    try { localStorage.setItem(XP_KEY, localDay()); } catch { /* ignore */ }
    return XP;
  } catch { return 0; }
}

function Done({ title, children, onAgain, xp }: { title: string; children?: React.ReactNode; onAgain: () => void; xp: number }) {
  return (
    <div className="card flex flex-col items-center gap-3 text-center" role="status">
      <CircleCheck size={36} className="text-good" aria-hidden="true" />
      <p className="text-lg font-extrabold">{title}</p>
      {xp > 0 && <p className="font-bold text-primary">+{xp} XP</p>}
      {children}
      <button type="button" className="btn ghost w-full" onClick={onAgain}>Again</button>
    </div>
  );
}

// ---- 1. Put the steps in order --------------------------------------------------------------------------------

function Ordering({ content, onFinish }: { content: GospelContent; onFinish: () => Promise<number> }) {
  const [pool, setPool] = useState<StepId[] | null>(null);
  const [placed, setPlaced] = useState<StepId[]>([]);
  const [miss, setMiss] = useState(false);
  const [xp, setXp] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- random order exists only in the browser
  useEffect(() => { setPool(shuffle([...STEP_IDS])); }, []);
  if (!pool) return <p className="text-muted">Loading…</p>;
  const done = placed.length === STEP_IDS.length;
  const again = () => { setPool(shuffle([...STEP_IDS])); setPlaced([]); setMiss(false); setXp(0); };
  function pick(id: StepId) {
    if (id !== STEP_IDS[placed.length]) { setMiss(true); return; }
    setMiss(false);
    const next = [...placed, id];
    setPlaced(next);
    if (next.length === STEP_IDS.length) void onFinish().then(setXp);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Tap the steps in the order you would draw and say them.</p>
      <ol className="flex flex-col gap-1.5" aria-label="Your order">
        {STEP_IDS.map((id, n) => (
          <li key={n} className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-bold ${placed[n] ? "border-good bg-surface" : "border-dashed border-border text-muted"}`}>
            <span className="grid size-6 place-items-center rounded-full bg-tint text-xs text-primary">{n + 1}</span>
            {placed[n] ? plain(content.steps[placed[n]].title.en) : "…"}
          </li>
        ))}
      </ol>
      {done ? <Done title="All in order!" onAgain={again} xp={xp} /> : (
        <>
          <p className="min-h-5 text-sm font-bold text-primary" role="status">{miss ? "Not yet. What comes first when you tell it?" : ""}</p>
          <div className="flex flex-wrap gap-2">
            {pool.filter((id) => !placed.includes(id)).map((id) => (
              <button key={id} type="button" className="card min-h-11 !px-3 !py-2 text-left text-sm font-bold" onClick={() => pick(id)}>
                {plain(content.steps[id].title.en)}
                <span lang="fr" className="block text-xs font-normal text-muted">{plain(content.steps[id].title.fr)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---- 2. Fill in the word --------------------------------------------------------------------------------------

const STOP = new Set(["avec", "pour", "nous", "vous", "dans", "mais", "elle", "elles", "leur", "leurs", "cette", "comme", "ensuite", "ainsi", "aussi", "plus", "tout", "tous", "toute", "quelque", "chose", "puis"]);
const tokens = (s: string) => s.split(/\s+/).map((w) => w.replace(/^[«"'(]+|[.,;:?!»")]+$/g, "")).filter(Boolean);
const usable = (w: string) => w.replace(/^[ldsmtn]'/i, "").length >= 4 && !STOP.has(w.toLowerCase());
type Fill = { before: string; after: string; answer: string; options: string[]; fr: string; en: string };

function buildFill(c: GospelContent): Fill[] {
  const vocab = new Set(c.words.flatMap((w) => tokens(w.fr).map((t) => t.toLowerCase())));
  const everyWord = [...new Set([...STEP_IDS.flatMap((id) => [...tokens(c.steps[id].key.fr), ...tokens(c.steps[id].say.fr)]), ...c.words.flatMap((w) => tokens(w.fr))].filter((w) => usable(w) && !/[-']/.test(w)).map((w) => w.toLowerCase()))];
  const out: Fill[] = [];
  for (const id of STEP_IDS) {
    const { fr, en } = c.steps[id].key;
    const words = tokens(fr).filter(usable);
    const target = words.find((w) => vocab.has(w.toLowerCase())) ?? [...words].sort((a, b) => b.length - a.length)[0];
    if (!target) continue;
    const at = fr.indexOf(target);
    const others = shuffle(everyWord.filter((w) => w !== target.toLowerCase())).slice(0, 3);
    if (others.length < 1 || at < 0) continue;
    out.push({ before: fr.slice(0, at), after: fr.slice(at + target.length), answer: target, options: shuffle([target, ...others]), fr, en });
  }
  return out;
}

function FillIn({ content, onFinish }: { content: GospelContent; onFinish: () => Promise<number> }) {
  const [qs, setQs] = useState<Fill[] | null>(null);
  const [k, setK] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [xp, setXp] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- random order exists only in the browser
  useEffect(() => { setQs(shuffle(buildFill(content))); }, [content]);
  if (!qs) return <p className="text-muted">Loading…</p>;
  const n = qs.length;
  const again = () => { setQs(shuffle(buildFill(content))); setK(0); setSel(null); setScore(0); setXp(0); };
  if (qs.length === 0) return <p className="text-muted">There is nothing to practise yet.</p>;
  if (k >= qs.length) return <Done title={`${score} of ${qs.length} right`} onAgain={again} xp={xp} />;
  const q = qs[k];
  const checked = sel !== null;
  function choose(o: string) {
    if (checked) return;
    setSel(o);
    if (o === q.answer) setScore((s) => s + 1);
  }
  function next() {
    setSel(null);
    if (k + 1 >= n) void onFinish().then(setXp);
    setK(k + 1);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Word {k + 1} of {qs.length}</p>
      <p lang="fr" className="text-xl font-extrabold leading-snug">{q.before}<span className="mx-1 inline-block min-w-16 border-b-4 border-primary text-center text-primary">{checked ? q.answer : " "}</span>{q.after}</p>
      <p className="text-muted">{q.en}</p>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Choose the missing word">
        {q.options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={sel === o} disabled={checked} lang="fr" onClick={() => choose(o)}
            className={`card min-h-12 text-left font-bold ${checked && o === q.answer ? "!border-good" : ""} ${sel === o && o !== q.answer ? "!border-primary !bg-tint" : ""}`}>{o}</button>
        ))}
      </div>
      {checked && (
        <div className="card flex flex-col gap-2" role="status">
          <p className="font-extrabold">{sel === q.answer ? "Bien vu !" : "Pas tout à fait"}</p>
          <p lang="fr" className="text-sm">{q.fr}</p>
          <SpeakButtons fr={q.fr} en={q.en} />
          <button type="button" className="btn" onClick={next}>{k + 1 >= qs.length ? "See my score" : "Continue"}</button>
        </div>
      )}
    </div>
  );
}

// ---- 3. Role-play walkthrough ---------------------------------------------------------------------------------

function RolePlay({ content, onFinish }: { content: GospelContent; onFinish: () => Promise<number> }) {
  const parts = [
    ...STEP_IDS.map((id) => ({ name: plain(content.steps[id].title.en), fr: content.steps[id].say.fr, en: content.steps[id].say.en })),
    ...(content.closing[0] ? [{ name: "Ask", fr: content.closing[0].fr, en: content.closing[0].en }] : []),
  ];
  const [k, setK] = useState(0);
  const [shown, setShown] = useState(false);
  const [xp, setXp] = useState(0);
  const finished = k >= parts.length;
  const again = () => { setK(0); setShown(false); setXp(0); };
  if (finished) return <Done title="You walked through the whole conversation." onAgain={again} xp={xp}><p className="text-sm text-muted">Now try it out loud with a teammate, or on paper.</p></Done>;
  const p = parts[k];
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Part {k + 1} of {parts.length}</p>
      <div className="card flex flex-col gap-2">
        <p className="text-sm font-extrabold uppercase text-primary">{p.name}</p>
        <p className="text-sm text-muted">Say this in French, in your own words or from memory, then check:</p>
        <p className="text-lg font-bold leading-snug">{p.en}</p>
      </div>
      {!shown ? (
        <button type="button" className="btn ghost" onClick={() => setShown(true)}>Show the French</button>
      ) : (
        <div className="card flex flex-col gap-2 !border-primary" role="status">
          <p lang="fr" className="text-lg font-black leading-snug">{p.fr}</p>
          <SpeakButtons fr={p.fr} en={p.en} mic />
        </div>
      )}
      <button type="button" className="btn" onClick={() => { setShown(false); if (k + 1 >= parts.length) void onFinish().then(setXp); setK(k + 1); }}>{k + 1 >= parts.length ? "Finish" : "Next part"}</button>
    </div>
  );
}

// ---- tab -------------------------------------------------------------------------------------------------------

const MODES = [
  { id: "order", label: "Put the steps in order", note: "Six steps, one tap each", Icon: ArrowDownUp },
  { id: "fill", label: "Fill in the word", note: "Key sentences in French", Icon: TextCursorInput },
  { id: "role", label: "Role-play", note: "Walk through the whole conversation", Icon: MessageSquareText },
] as const;

export default function CirclesPractice({ content }: { content: GospelContent }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"] | null>(null);
  if (!mode) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted">Short practice. Nothing here is graded in front of anyone, and your first practice each day earns {XP} XP.</p>
        {MODES.map(({ id, label, note, Icon }) => (
          <button key={id} type="button" className="card flex min-h-16 items-center gap-3 text-left" onClick={() => setMode(id)}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-tint text-primary"><Icon size={22} aria-hidden="true" /></span>
            <span><b className="block">{label}</b><span className="text-sm text-muted">{note}</span></span>
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <button type="button" className="min-h-11 self-start text-sm font-bold text-muted underline" onClick={() => setMode(null)}>All practice</button>
      {mode === "order" && <Ordering content={content} onFinish={awardOncePerDay} />}
      {mode === "fill" && <FillIn content={content} onFinish={awardOncePerDay} />}
      {mode === "role" && <RolePlay content={content} onFinish={awardOncePerDay} />}
    </div>
  );
}
