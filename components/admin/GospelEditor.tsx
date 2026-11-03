"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import AdminTabs from "@/components/admin/AdminTabs";
import { saveGospelContent } from "@/app/(app)/admin/actions";
import { refLabelEn } from "@/lib/bible/reference";
import { LIMITS, SLUG, STEP_IDS, type Bi, type GospelContent, type StepId, type Word } from "@/lib/gospel";

type Msg = { ok?: string; error?: string; where: string } | null;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const verseText = (keys: string[]) => keys.map(refLabelEn).join(", ");
const splitVerses = (t: string) => t.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
const STEP_LABEL: Record<StepId, string> = { start: "Start", design: "1 · God's design", brokenness: "2 · Brokenness", gospel: "3 · The Gospel", believe: "Repent and believe", recover: "Recover and pursue" };

/** Two boxes, English and Français, with a character counter. */
function BiField({ label, value, onChange, max, rows = 1 }: { label: string; value: Bi; onChange: (v: Bi) => void; max: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {(["en", "fr"] as const).map((l) => {
        const Tag = rows > 1 ? "textarea" : "input";
        return (
          <label key={l} className="flex flex-col gap-1 text-xs font-extrabold text-muted">
            {label} ({l === "en" ? "English" : "Français"})
            <Tag className="input !text-[15px] font-semibold text-foreground" lang={l} value={value[l]} maxLength={max} {...(rows > 1 ? { rows } : {})}
              onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ ...value, [l]: e.target.value })} />
            <span className={`self-end font-semibold ${value[l].trim().length === 0 ? "text-red-600" : ""}`}>{value[l].length}/{max}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Add / remove / reorder buttons for one row of a list. */
function RowTools({ i, n, onMove, onRemove }: { i: number; n: number; onMove: (to: number) => void; onRemove: () => void }) {
  const b = "grid size-11 place-items-center rounded-xl border border-border bg-surface disabled:opacity-40";
  return (
    <div className="flex gap-1">
      <button type="button" className={b} disabled={i === 0} aria-label="Move up" onClick={() => onMove(i - 1)}><ArrowUp size={18} aria-hidden="true" /></button>
      <button type="button" className={b} disabled={i === n - 1} aria-label="Move down" onClick={() => onMove(i + 1)}><ArrowDown size={18} aria-hidden="true" /></button>
      <button type="button" className={`${b} text-red-600`} disabled={n <= 1} aria-label="Remove" onClick={onRemove}><Trash2 size={18} aria-hidden="true" /></button>
    </div>
  );
}
const move = <T,>(list: T[], from: number, to: number) => { const a = [...list]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };

function PairList({ title, list, onChange, max, maxItems }: { title: string; list: Bi[]; onChange: (l: Bi[]) => void; max: number; maxItems: number }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-extrabold">{title}</h3>
      {list.map((p, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <BiField label={`${title} ${i + 1}`} value={p} max={max} onChange={(v) => onChange(list.map((x, k) => (k === i ? v : x)))} />
          <RowTools i={i} n={list.length} onMove={(to) => onChange(move(list, i, to))} onRemove={() => onChange(list.filter((_, k) => k !== i))} />
        </div>
      ))}
      <button type="button" className="btn ghost" disabled={list.length >= maxItems} onClick={() => onChange([...list, { en: "", fr: "" }])}><Plus size={18} aria-hidden="true" />Add ({list.length}/{maxItems})</button>
    </div>
  );
}

/** First-class editor for the Three Circles wording (both languages), the verses, and the "Reviewed" flag. */
export default function GospelEditor({ initial, defaults, reviewed, missing }: { initial: GospelContent; defaults: GospelContent; reviewed: boolean; missing: boolean }) {
  const [d, setD] = useState<GospelContent>(() => clone(initial));
  const [vt, setVt] = useState<Record<StepId, string>>(() => Object.fromEntries(STEP_IDS.map((id) => [id, verseText(initial.steps[id].verses)])) as Record<StepId, string>);
  const [rev, setRev] = useState(reviewed);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  if (missing) {
    return <p className="rounded-xl bg-tint p-3 text-sm font-bold" role="status">Run migration 0017 first. Open Supabase, SQL editor, paste supabase/migrations/0017_app_content.sql and run it. Until then everyone sees the original wording and nothing here can be saved.</p>;
  }

  const setStep = (id: StepId, patch: Partial<GospelContent["steps"][StepId]>) => setD((x) => ({ ...x, steps: { ...x.steps, [id]: { ...x.steps[id], ...patch } } }));
  const stepData = (id: StepId, withVerses = true) => {
    const s = d.steps[id];
    return { title: s.title, say: s.say, key: s.key, ...(withVerses ? { verses: splitVerses(vt[id]) } : {}) };
  };

  function send(where: string, patch: Parameters<typeof saveGospelContent>[1], after?: () => void) {
    setMsg(null);
    start(async () => {
      const r = await saveGospelContent(SLUG, patch).catch(() => ({ error: "Could not save. Check your connection and try again." }));
      setMsg({ ...r, where });
      if (r && "ok" in r && r.ok) after?.();
    });
  }
  const status = (where: string) => msg?.where === where && (
    <div aria-live="polite">
      {msg.ok && <p className="text-sm font-bold text-primary" role="status">{msg.ok}</p>}
      {msg.error && <p className="text-sm text-red-600" role="alert">{msg.error}</p>}
    </div>
  );

  // Plain functions (not components) so typing never remounts the inputs.
  const buttons = (where: string, data: object, paths: string[], apply: () => void) => (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn" disabled={pending} onClick={() => send(where, { data })}>{pending ? "Working…" : "Save"}</button>
      <button type="button" className="btn ghost" disabled={pending} onClick={() => { if (window.confirm("Throw away your edits here and go back to the original wording?")) send(where, { reset: paths }, apply); }}>Reset this step to the original</button>
      {status(where)}
    </div>
  );

  const stepFields = (id: StepId) => (
    <>
      <BiField label="Step title" value={d.steps[id].title} max={LIMITS.stepTitle} onChange={(v) => setStep(id, { title: v })} />
      <BiField label="What to say" value={d.steps[id].say} max={LIMITS.say} rows={4} onChange={(v) => setStep(id, { say: v })} />
      <BiField label="Short sentence to learn" value={d.steps[id].key} max={LIMITS.key} rows={2} onChange={(v) => setStep(id, { key: v })} />
      {id !== "start" && (
        <label className="flex flex-col gap-1 text-xs font-extrabold text-muted">
          Verses (up to {LIMITS.verses}, separated by commas, e.g. Romans 3:23, Romains 6:23)
          <input className="input !text-[15px] font-semibold text-foreground" value={vt[id]} onChange={(e) => setVt((x) => ({ ...x, [id]: e.target.value }))} />
          <span className="font-semibold">The text shown to people is read from the app&rsquo;s own Bible in each language.</span>
        </label>
      )}
    </>
  );
  const resetStep = (id: StepId) => () => { setStep(id, clone(defaults.steps[id])); setVt((x) => ({ ...x, [id]: verseText(defaults.steps[id].verses) })); };

  const circleTab = (id: "design" | "brokenness" | "gospel") => (
    <div className="flex flex-col gap-3">
      <BiField label="Circle label" value={d.circles[id]} max={LIMITS.circle} onChange={(v) => setD((x) => ({ ...x, circles: { ...x.circles, [id]: v } }))} />
      {stepFields(id)}
      {buttons(id, { circles: { [id]: d.circles[id] }, steps: { [id]: stepData(id) } }, [`circles.${id}`, `steps.${id}`],
        () => { setD((x) => ({ ...x, circles: { ...x.circles, [id]: clone(defaults.circles[id]) } })); resetStep(id)(); })}
    </div>
  );

  const panels: Record<string, React.ReactNode> = {
    intro: (
      <div className="flex flex-col gap-3">
        <BiField label="Page title" value={d.title} max={LIMITS.title} onChange={(v) => setD((x) => ({ ...x, title: v }))} />
        <BiField label="Hint under the first step" value={d.intro} max={LIMITS.intro} rows={3} onChange={(v) => setD((x) => ({ ...x, intro: v }))} />
        {stepFields("start")}
        {buttons("intro", { title: d.title, intro: d.intro, steps: { start: stepData("start", false) } }, ["title", "intro", "steps.start"],
          () => { setD((x) => ({ ...x, title: clone(defaults.title), intro: clone(defaults.intro) })); resetStep("start")(); })}
      </div>
    ),
    design: circleTab("design"),
    brokenness: circleTab("brokenness"),
    gospel: circleTab("gospel"),
    arrows: (
      <div className="flex flex-col gap-3">
        <h3 className="font-extrabold">Arrow: brokenness to gospel</h3>
        <BiField label="Arrow label" value={d.arrows.believe} max={LIMITS.arrow} onChange={(v) => setD((x) => ({ ...x, arrows: { ...x.arrows, believe: v } }))} />
        {stepFields("believe")}
        <h3 className="mt-2 font-extrabold">Arrow: gospel back to God&rsquo;s design</h3>
        <BiField label="Arrow label" value={d.arrows.recover} max={LIMITS.arrow} onChange={(v) => setD((x) => ({ ...x, arrows: { ...x.arrows, recover: v } }))} />
        {stepFields("recover")}
        {buttons("arrows", { arrows: d.arrows, steps: { believe: stepData("believe"), recover: stepData("recover") } }, ["arrows", "steps.believe", "steps.recover"],
          () => { setD((x) => ({ ...x, arrows: clone(defaults.arrows) })); resetStep("believe")(); resetStep("recover")(); })}
      </div>
    ),
    words: (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">The word list on the Words tab. French first, then the English meaning, and the step it belongs to.</p>
        {d.words.map((w, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <label className="flex flex-col gap-1 text-xs font-extrabold text-muted">Français ({w.fr.length}/{LIMITS.word})
              <input className="input !text-[15px] font-semibold text-foreground" lang="fr" maxLength={LIMITS.word} value={w.fr} onChange={(e) => setD((x) => ({ ...x, words: x.words.map((k, n) => (n === i ? { ...k, fr: e.target.value } : k)) }))} /></label>
            <label className="flex flex-col gap-1 text-xs font-extrabold text-muted">English ({w.en.length}/{LIMITS.word})
              <input className="input !text-[15px] font-semibold text-foreground" lang="en" maxLength={LIMITS.word} value={w.en} onChange={(e) => setD((x) => ({ ...x, words: x.words.map((k, n) => (n === i ? { ...k, en: e.target.value } : k)) }))} /></label>
            <label className="flex flex-col gap-1 text-xs font-extrabold text-muted">Step
              <select className="input !text-[15px] font-semibold text-foreground" value={w.step} onChange={(e) => setD((x) => ({ ...x, words: x.words.map((k, n) => (n === i ? { ...k, step: e.target.value as StepId } : k)) }))}>
                {STEP_IDS.map((s) => <option key={s} value={s}>{STEP_LABEL[s]}</option>)}
              </select></label>
            <RowTools i={i} n={d.words.length} onMove={(to) => setD((x) => ({ ...x, words: move(x.words, i, to) }))} onRemove={() => setD((x) => ({ ...x, words: x.words.filter((_, n) => n !== i) }))} />
          </div>
        ))}
        <button type="button" className="btn ghost" disabled={d.words.length >= LIMITS.words} onClick={() => setD((x) => ({ ...x, words: [...x.words, { fr: "", en: "", step: "design" } as Word] }))}><Plus size={18} aria-hidden="true" />Add a word ({d.words.length}/{LIMITS.words})</button>
        {buttons("words", { words: d.words }, ["words"], () => setD((x) => ({ ...x, words: clone(defaults.words) })))}
      </div>
    ),
    questions: (
      <div className="flex flex-col gap-4">
        <PairList title="Conversation opener" list={d.openers} max={LIMITS.opener} maxItems={LIMITS.openers} onChange={(l) => setD((x) => ({ ...x, openers: l }))} />
        <PairList title="Listening phrase" list={d.listening} max={LIMITS.listening} maxItems={LIMITS.listeningN} onChange={(l) => setD((x) => ({ ...x, listening: l }))} />
        <PairList title="Closing question" list={d.closing} max={LIMITS.closing} maxItems={LIMITS.closingN} onChange={(l) => setD((x) => ({ ...x, closing: l }))} />
        <p className="text-sm text-muted">The first closing question is the one shown big at the end of the full-screen &ldquo;Show them&rdquo; view.</p>
        {buttons("questions", { openers: d.openers, listening: d.listening, closing: d.closing }, ["openers", "listening", "closing"],
          () => setD((x) => ({ ...x, openers: clone(defaults.openers), listening: clone(defaults.listening), closing: clone(defaults.closing) })))}
      </div>
    ),
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Edit what people read and hear, in both languages. Saving changes it for everyone straight away.</p>
      <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
        <label className="flex min-h-11 items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="size-5" checked={rev} onChange={(e) => setRev(e.target.checked)} /> Reviewed by a native speaker
        </label>
        <p className="text-xs text-muted">Until this is ticked and saved, learners see a small &ldquo;Draft French&rdquo; note.</p>
        <button type="button" className="btn ghost" disabled={pending} onClick={() => send("review", { reviewed: rev })}>Save review status</button>
        {status("review")}
      </div>
      <a href="/learn/three-circles" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center self-start text-sm font-bold text-primary underline">Open Watch (opens in a new tab)</a>
      <AdminTabs nested label="Three Circles sections" tabs={[
        { id: "intro", label: "Intro" }, { id: "design", label: "1 Design" }, { id: "brokenness", label: "2 Brokenness" }, { id: "gospel", label: "3 Gospel" },
        { id: "arrows", label: "Arrows" }, { id: "words", label: "Words" }, { id: "questions", label: "Questions" },
      ]} panels={panels} />
    </div>
  );
}
