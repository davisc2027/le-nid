"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";
import { isCorrect, type Exercise } from "@/lib/french/exercises";
import { speak, speechUnlocked } from "@/lib/french/speech";
import { playError, playTick } from "@/lib/sounds";
import Speaker from "./Speaker";

/** `why` explains a miss: the near miss that was picked, or the grammar point. */
export type Report = (correct: boolean, answer: string, note?: string, why?: string) => void;
type Of<K extends Exercise["kind"]> = Extract<Exercise, { kind: K }>;
type ExProps<T extends Exercise> = { ex: T; locked: boolean; report: Report };
type Skip = { skip: () => void };

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

/** Type the French for an English prompt. Lenient: accents, punctuation and one typo; the tu form also counts. */
export function Type({ ex, locked, report }: ExProps<Of<"type">>) {
  const [text, setText] = useState("");
  function submit() {
    const exact = isCorrect(text, ex.fr);
    const informal = !exact && !!ex.alt && isCorrect(text, ex.alt);
    report(exact || informal, ex.fr, informal ? `That is the tu form. With strangers, say ${ex.fr}.` : ex.note);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="label">Translate into French</p>
      <p className="text-2xl font-extrabold">{ex.en}</p>
      <Hint text={ex.hint} open={ex.hintOpen} />
      <input className="input" lang="fr" autoCapitalize="none" autoCorrect="off" disabled={locked} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Écrivez en français" />
      <p className="text-xs text-muted">Accents and small typos are fine.</p>
      <button className="btn" disabled={!text.trim() || locked} onClick={submit}>Check</button>
    </div>
  );
}

export function Bank({ ex, locked, report }: ExProps<Of<"bank">>) {
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

export function Listen({ ex, locked, report, skip }: ExProps<Of<"listen">> & Skip) {
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
