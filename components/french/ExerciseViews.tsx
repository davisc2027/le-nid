"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { grade, splitTail, type Exercise, type Grade } from "@/lib/french/exercises";
import { speak, speechUnlocked } from "@/lib/french/speech";
import { playError, playTick } from "@/lib/sounds";
import Speaker from "./Speaker";

/** What typed grading adds to the feedback card: the corrected spelling, or the one word to fix. */
export type Extra = Pick<Grade, "fixed" | "wrong">;
/** `why` explains a miss: the near miss that was picked, or the grammar point. */
export type Report = (correct: boolean, answer: string, note?: string, why?: string, extra?: Extra) => void;
type Of<K extends Exercise["kind"]> = Extract<Exercise, { kind: K }>;
type ExProps<T extends Exercise> = { ex: T; locked: boolean; report: Report };
type Skip = { skip: () => void };
/** "Use tiles instead": swaps a typed item for an easier one, no penalty. `onHint` records that help was opened. */
type Typed = { swap: () => void; onHint?: () => void };

const subtle = "min-h-11 self-start px-3 text-sm text-muted underline";

function SkipAudio({ locked, skip }: { locked: boolean } & Skip) {
  return <button className={subtle} disabled={locked} onClick={skip}>Can&apos;t listen now</button>;
}

/** A hint behind a tap (or already open), so warm-ups can help without giving the answer away by default. */
function Hint({ text, open = false }: { text?: string; open?: boolean }) {
  const [show, setShow] = useState(open);
  if (!text) return null;
  if (!show)
    return (
      <button className={`${subtle} flex items-center gap-1.5`} onClick={() => setShow(true)}>
        <Lightbulb size={16} className="text-accent" aria-hidden="true" /> Show a hint
      </button>
    );
  return <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{text}</span></p>;
}

/** Option buttons plus Check. After checking, the right option is outlined in green. */
function Options({ choices, answer, locked, onCheck, fr = false, row = false }: {
  choices: string[]; answer: string; locked: boolean; onCheck: (picked: string) => void; fr?: boolean; row?: boolean;
}) {
  const [sel, setSel] = useState<string | null>(null);
  return (
    <>
      <div className={row ? "flex flex-wrap gap-2" : "flex flex-col gap-2"}>
        {choices.map((c) => (
          <button key={c} lang={fr ? "fr" : undefined} disabled={locked} onClick={() => setSel(c)}
            className={`card text-left font-semibold ${row ? "min-w-16 !px-4 !py-2.5 text-center" : ""} ${sel === c ? "!border-primary !bg-tint" : ""} ${locked && c === answer ? "!border-good" : ""}`}>{c}</button>
        ))}
      </div>
      <button className="btn" disabled={!sel || locked} onClick={() => sel && onCheck(sel)}>Check</button>
    </>
  );
}

const check = (ex: { answer: string; note?: string; why?: Record<string, string> }, report: Report, shown = ex.answer) =>
  (picked: string) => report(picked === ex.answer, shown, ex.note, picked === ex.answer ? undefined : ex.why?.[picked]);

/** Read French (or with audioOnly, hear it) and pick the meaning. */
export function Choose({ ex, locked, report, skip }: ExProps<Of<"choose">> & Skip) {
  useEffect(() => { if (ex.audioOnly && speechUnlocked()) speak(ex.fr); }, [ex.fr, ex.audioOnly]);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">{ex.audioOnly ? "Listen, then pick the meaning" : "What does this mean?"}</p>
      {(!ex.audioOnly || locked) && <p lang="fr" className="text-2xl font-extrabold">{ex.fr}</p>}
      <Speaker text={ex.fr} />
      <Hint text={ex.hint} />
      <Options choices={ex.choices} answer={ex.answer} locked={locked} onCheck={check(ex, report)} />
      {ex.audioOnly && <SkipAudio locked={locked} skip={skip} />}
    </div>
  );
}

/** Hear French and pick the written phrase among sound-alikes. */
export function Hear({ ex, locked, report, skip }: ExProps<Of<"hear">> & Skip) {
  useEffect(() => { if (speechUnlocked()) speak(ex.fr); }, [ex.fr]);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Tap what you hear</p>
      <Speaker text={ex.fr} />
      <Hint text={ex.hint} />
      <Options choices={ex.choices} answer={ex.answer} locked={locked} onCheck={check(ex, report)} fr />
      <SkipAudio locked={locked} skip={skip} />
    </div>
  );
}

/** Read English and pick the French among near misses. */
export function Pick({ ex, locked, report }: ExProps<Of<"pick">>) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Pick the French</p>
      <p className="text-2xl font-extrabold">{ex.en}</p>
      <Options choices={ex.choices} answer={ex.answer} locked={locked} onCheck={check(ex, report)} fr />
    </div>
  );
}

/** Pick the missing word; the options are all from the same family (articles, verb endings, numbers...). */
export function Gap({ ex, locked, report }: ExProps<Of<"gap">>) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Fill in the missing word</p>
      <p className="text-muted">“{ex.en}”</p>
      <p lang="fr" className="text-2xl font-extrabold">
        {ex.before}{ex.before && " "}
        <span className={`inline-block min-w-14 border-b-4 text-center ${locked ? "border-good text-good" : "border-primary text-transparent"}`} aria-label={locked ? undefined : "blank"}>
          {locked ? ex.answer : "_"}
        </span>
        {ex.after}
      </p>
      <Options choices={ex.choices} answer={ex.answer} locked={locked} onCheck={check(ex, report, ex.fr)} fr row />
    </div>
  );
}

/** Tu or vous: the same sentence in both registers, and a situation that decides. */
export function Register({ ex, locked, report }: ExProps<Of<"register">>) {
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Tu or vous?</p>
      <p className="font-bold text-primary">{ex.situation}</p>
      <p className="text-2xl font-extrabold">“{ex.en}”</p>
      <Options choices={ex.choices} answer={ex.answer} locked={locked} onCheck={(picked) => report(picked === ex.answer, ex.answer, undefined, picked === ex.answer ? undefined : ex.why?.[picked])} fr />
    </div>
  );
}

const inputProps = { spellCheck: false, autoComplete: "off", enterKeyHint: "done" as const, autoCapitalize: "none", autoCorrect: "off" };

function SwapLink({ locked, swap }: { locked: boolean; swap: () => void }) {
  return <button className={subtle} disabled={locked} onClick={swap}>Use tiles instead</button>;
}

/** Type the French for an English prompt. Lenient: accents, small typos, spacing; the tu form also counts. */
export function Type({ ex, locked, report, swap, onHint }: ExProps<Of<"type">> & Typed) {
  const [text, setText] = useState("");
  const [gloss, setGloss] = useState(false);
  const [shapes, setShapes] = useState(!!ex.shapesOpen);
  function submit() {
    if (!text.trim() || locked) return;
    let g = grade(text, ex.fr);
    let informal = false;
    if (!g.ok && ex.alt) { const a = grade(text, ex.alt); if (a.ok) { g = a; informal = true; } }
    report(g.ok, ex.fr, informal ? `That is the tu form. With strangers, say ${ex.fr}.` : ex.note, undefined, informal ? undefined : { fixed: g.fixed, wrong: g.wrong });
  }
  // two steps: the meaning of the words first, then the shape of each word; shown from the start when shapesOpen
  const next = !shapes ? (ex.gloss && !gloss ? "gloss" : "shapes") : ex.gloss && !gloss ? "gloss" : null;
  function more() {
    onHint?.();
    if (next === "gloss") setGloss(true); else setShapes(true);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Translate into French</p>
      <p className="text-2xl font-extrabold">{ex.en}</p>
      {gloss && ex.gloss && <p className="flex gap-1.5 text-sm text-muted"><Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" /><span>{ex.gloss}</span></p>}
      {shapes && (
        <div className="flex flex-wrap gap-2" aria-label="Shape of each word">
          {ex.shapes.map((sh, k) => <span key={k} lang="fr" className="rounded-lg bg-tint px-2.5 py-1 font-mono text-base font-bold tracking-wide text-primary">{sh}</span>)}
        </div>
      )}
      {next && !locked && (
        <button className={`${subtle} flex items-center gap-1.5`} onClick={more}>
          <Lightbulb size={16} className="text-accent" aria-hidden="true" /> {!gloss && !shapes ? "Show a hint" : next === "gloss" ? "What do the words mean?" : "More help"}
        </button>
      )}
      <input className="input" lang="fr" {...inputProps} disabled={locked} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Écrivez en français" />
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!text.trim() || locked} onClick={submit}>Check</button>
      <SwapLink locked={locked} swap={swap} />
    </div>
  );
}

/** Type one or two words inside the French sentence. The placeholder shows the first letter and the length. */
export function Cloze({ ex, locked, report, swap }: ExProps<Of<"cloze">> & Typed) {
  const answers = ex.blanks.map((k) => splitTail(ex.tokens[k])[0]);
  const [vals, setVals] = useState<string[]>(() => ex.blanks.map(() => ""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const ready = vals.every((v) => v.trim());
  function submit() {
    if (!ready || locked) return;
    const gs = vals.map((v, b) => grade(v, answers[b]));
    const bad = gs.find((g) => !g.ok);
    report(!bad, ex.fr, ex.note, undefined, bad ? { wrong: bad.wrong } : { fixed: gs.some((g) => g.fixed) ? ex.fr : undefined });
  }
  function enter(b: number) {
    const empty = vals.findIndex((v, k) => k !== b && !v.trim());
    if (empty >= 0 && ready === false) refs.current[empty]?.focus(); else submit();
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Type the missing {ex.blanks.length > 1 ? "words" : "word"}</p>
      <p className="text-muted">“{ex.en}”</p>
      <p lang="fr" className="flex flex-wrap items-baseline gap-x-2 gap-y-3 text-2xl font-extrabold">
        {ex.tokens.map((tok, k) => {
          const b = ex.blanks.indexOf(k);
          if (b < 0) return <span key={k}>{tok}</span>;
          const [core, tail] = splitTail(tok);
          return (
            <span key={k} className="inline-flex items-baseline">
              <input ref={(el) => { refs.current[b] = el; }} {...inputProps} lang="fr" disabled={locked} value={vals[b]} size={core.length + 2}
                aria-label={`Missing word ${b + 1}, ${ex.shapes[b]}`} placeholder={ex.shapes[b]}
                onChange={(e) => setVals(vals.map((v, n) => (n === b ? e.target.value : v)))}
                onKeyDown={(e) => { if (e.key === "Enter") enter(b); }}
                style={{ width: `calc(${core.length + 2}ch + 1.5rem)` }}
                className="min-h-12 rounded-xl border-2 border-primary bg-surface px-2 py-1 text-center font-mono text-xl font-bold placeholder:text-muted" />
              {tail}
            </span>
          );
        })}
      </p>
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!ready || locked} onClick={submit}>Check</button>
      <SwapLink locked={locked} swap={swap} />
    </div>
  );
}

/** Build the French from tiles. With `audio`, hear it instead of reading the English (the English shows afterwards). */
export function Bank({ ex, locked, report, skip }: ExProps<Of<"bank">> & Partial<Skip>) {
  const [picked, setPicked] = useState<number[]>([]);
  const answer = picked.map((i) => ex.tokens[i]).join(" ");
  useEffect(() => { if (ex.audio && speechUnlocked()) speak(ex.fr); }, [ex.fr, ex.audio]);
  return (
    <div className="flex flex-col gap-3">
      <p className="label">{ex.audio ? "Listen, then build what you hear" : "Translate into French"}</p>
      {ex.audio ? (
        <>
          <Speaker text={ex.fr} />
          {locked && <p className="text-muted">“{ex.en}”</p>}
        </>
      ) : (
        <p className="text-2xl font-extrabold">{ex.en}</p>
      )}
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
      <button className="btn" disabled={!picked.length || locked} onClick={() => report(grade(answer, ex.fr).ok, ex.fr)}>Check</button>
      {ex.audio && skip && <SkipAudio locked={locked} skip={skip} />}
    </div>
  );
}

export function Listen({ ex, locked, report, skip, swap }: ExProps<Of<"listen">> & Skip & Typed) {
  const [text, setText] = useState("");
  useEffect(() => { if (speechUnlocked()) speak(ex.fr); }, [ex.fr]);
  function submit() {
    if (!text.trim() || locked) return;
    const g = grade(text, ex.fr);
    report(g.ok, ex.fr, ex.note, undefined, { fixed: g.fixed, wrong: g.wrong });
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Type what you hear</p>
      <Speaker text={ex.fr} />
      <input className="input" lang="fr" {...inputProps} disabled={locked} value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }} placeholder="Écrivez en français" />
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!text.trim() || locked} onClick={submit}>Check</button>
      <SwapLink locked={locked} swap={swap} />
      <SkipAudio locked={locked} skip={skip} />
    </div>
  );
}

export function Match({ ex, locked, report, miss }: ExProps<Of<"match">> & { miss: () => void }) {
  const [fr, setFr] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [bad, setBad] = useState<string | null>(null);
  const [en] = useState(() => ex.pairs.map((p) => p.en).sort(() => Math.random() - 0.5)); // shuffled once
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
