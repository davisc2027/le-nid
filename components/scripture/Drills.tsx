"use client";

// The exercises of the mastery path. Each calls done(ok, marks?) once; the learn flow shows the feedback card.
import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { reducedMotion } from "@/lib/odile-motion";
import { firstLetters, gradeRecall, PASS } from "@/lib/scripture/drills";
import { pickGaps } from "@/lib/scripture/mastery";
import { fold, initialOf, sameWord, verseTokens, type Tok } from "@/lib/scripture/tokens";
import { hear, useSlow, Word } from "./TapWords";

export type Marks = { word: string; ok: boolean }[];
export type Done = (ok: boolean, marks?: Marks) => void;

const shuffle = <T,>(a: T[]) => {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
};
/** Shuffled, but never left in the original order when there is any choice. */
function mixed<T>(a: T[], same: (x: T[], y: T[]) => boolean = (x, y) => x.every((v, i) => v === y[i])): T[] {
  if (a.length < 2) return a;
  for (let t = 0; t < 8; t++) { const s = shuffle(a); if (!same(s, a)) return s; }
  return [...a.slice(1), a[0]];
}
const display = (t: Tok) => t.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

function shake(el: HTMLElement | null) {
  if (!el || reducedMotion() || !el.animate) return;
  el.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(5px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }], { duration: 280, easing: "ease-out" });
}

/** A blank waiting for a word: an underline as long as the word, optionally showing its first letter. */
function Slot({ tok, cue, current }: { tok: Tok; cue: "letters" | "blank"; current: boolean }) {
  const len = Math.max(2, display(tok).length);
  return (
    <span aria-label={current ? "next blank" : "blank"}
      className={`inline-block rounded-t-md border-b-2 px-0.5 text-left align-baseline leading-[1.15] ${current ? "border-primary bg-tint" : "border-muted/60"}`}
      style={{ minWidth: `${Math.min(4.5, 0.36 * len + 0.5)}em` }}>
      <span className="text-muted">{cue === "letters" ? initialOf(tok) : " "}</span>
    </span>
  );
}

type BuildProps = {
  /** One line per chunk. */
  lines: string[];
  /** Tokens shown from the start (as "line:token" keys); punctuation is always shown. */
  given?: Set<string>;
  cue: "letters" | "blank";
  /** "line": only the current line's words are in the bank (chaining); "all": every missing word. */
  bank: "all" | "line";
  /** Errorless (false): wrong taps just bounce. Strict (true): too many wrong taps fails the step. */
  strict: boolean;
  /** Speak each word as it is placed (building phase). */
  speakOnPlace?: boolean;
  /** Language of the text (English words are plain text; only French words are tap-to-hear). */
  lang?: "fr" | "en";
  done: Done;
};

/**
 * Tap the words in order. The next blank is highlighted; a wrong word bounces back. After two misses on the same
 * blank, the right tile glows, so nobody gets stuck (errorless learning early in the path).
 */
export function Build({ lines, given, cue, bank, strict, speakOnPlace, lang = "fr", done }: BuildProps) {
  const toks = useMemo(() => lines.map((l) => verseTokens(l)), [lines]);
  const slots = useMemo(() => toks.flatMap((line, li) => line.map((tok, ti) => ({ tok, li, ti, key: `${li}:${ti}` })).filter((s) => s.tok.word && !given?.has(s.key))), [toks, given]);
  const tiles = useMemo(() => mixed(slots.map((s, id) => ({ id, li: s.li, tok: s.tok }))), [slots]);
  const [filled, setFilled] = useState<Set<string>>(() => new Set());
  const [used, setUsed] = useState<Set<number>>(() => new Set());
  const [misses, setMisses] = useState(0);
  const [slotMiss, setSlotMiss] = useState(0);
  const [said, setSaid] = useState("");
  const [slow] = useSlow();
  const refs = useRef(new Map<number, HTMLButtonElement | null>());
  const cur = slots.find((s) => !filled.has(s.key));
  const finished = !cur;
  const allowance = Math.max(1, Math.floor(slots.length * 0.15));
  const visible = tiles.filter((t) => !used.has(t.id) && (bank === "all" || t.li === cur?.li));
  const helpAt = strict ? 3 : 2;
  const helpId = cur && slotMiss >= helpAt ? visible.find((t) => fold(t.tok.say) === fold(cur.tok.say))?.id : undefined;

  function tap(t: (typeof tiles)[number]) {
    if (!cur) return;
    if (fold(t.tok.say) === fold(cur.tok.say)) {
      const nf = new Set(filled).add(cur.key);
      setFilled(nf); setUsed(new Set(used).add(t.id)); setSlotMiss(0); setSaid(`${cur.tok.say}, placed`);
      if (speakOnPlace) hear(cur.tok.say, slow);
      if (slots.every((s) => nf.has(s.key))) done(!strict || misses <= allowance);
    } else {
      setMisses(misses + 1); setSlotMiss(slotMiss + 1); setSaid(`Not ${t.tok.say}. Try another word.`);
      shake(refs.current.get(t.id) ?? null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-1.5">
        {toks.map((line, li) => (
          <p key={li} lang={lang} className="verse-text">
            {line.map((tok, ti) => {
              const k = `${li}:${ti}`;
              const show = !tok.word || given?.has(k) || filled.has(k);
              return (
                <span key={ti}>
                  {ti > 0 && " "}
                  {show ? (lang === "en" ? <span>{tok.text}</span> : <Word tok={tok} slow={slow} />) : <Slot tok={tok} cue={cue} current={cur?.key === k} />}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">{said}</p>
      {!finished && (
        <div className="flex flex-wrap gap-2" aria-label="Word bank">
          {visible.map((t) => (
            <button key={t.id} ref={(el) => { refs.current.set(t.id, el); }} type="button" lang={lang} onClick={() => tap(t)}
              className={`min-h-11 rounded-xl border-2 bg-surface px-3 text-lg font-bold shadow-[0_2px_0_var(--border)] active:translate-y-px ${t.id === helpId ? "border-accent ring-2 ring-accent/50" : "border-border"}`}>
              {display(t.tok)}
            </button>
          ))}
        </div>
      )}
      {!finished && strict && misses > 0 && (
        <p className="text-xs text-muted" aria-live="polite">{misses > allowance ? "A few slips. Finish it, then have another go." : "One slip is fine."}</p>
      )}
    </div>
  );
}

/** Put the chunks of the verse in order (tap to place, tap a placed chunk to take it back). */
export function OrderChunks({ chunks, done }: { chunks: string[]; done: Done }) {
  const order = useMemo(() => mixed(chunks.map((_, i) => i)), [chunks]);
  const [picked, setPicked] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const check = () => {
    setLocked(true);
    // a duplicate chunk text in either position is still right
    const ok = picked.every((p, n) => chunks[p] === chunks[n]);
    done(ok, ok ? undefined : chunks.map((c) => ({ word: c, ok: true })));
  };
  return (
    <div className="flex flex-col gap-3">
      <ol className="card flex min-h-24 flex-col gap-2" aria-label="Your order">
        {picked.length === 0 && <li className="text-sm text-muted">Tap the chunks below, first to last.</li>}
        {picked.map((p, n) => (
          <li key={p}>
            <button type="button" disabled={locked} onClick={() => setPicked(picked.filter((_, k) => k !== n))}
              className="flex w-full items-start gap-2 rounded-xl bg-tint px-3 py-2 text-left" aria-label={`${n + 1}: ${chunks[p]}. Tap to take back.`}>
              <span className="mt-1 text-xs font-extrabold text-primary">{n + 1}</span><span lang="fr" className="verse-text">{chunks[p]}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2">
        {order.filter((p) => !picked.includes(p)).map((p) => (
          <button key={p} type="button" disabled={locked} onClick={() => setPicked([...picked, p])}
            className="card !py-2.5 text-left shadow-[0_2px_0_var(--border)] active:translate-y-px"><span lang="fr" className="verse-text">{chunks[p]}</span></button>
        ))}
      </div>
      <button className="btn" disabled={locked || picked.length < chunks.length} onClick={check}>Check</button>
    </div>
  );
}

/** Type the missing words across the whole verse (one or two per chunk). The first letter is the only cue. */
export function Gaps({ lines, done }: { lines: string[]; done: Done }) {
  const toks = useMemo(() => lines.map((l) => verseTokens(l)), [lines]);
  const gaps = useMemo(() => pickGaps(toks), [toks]);
  const order = useMemo(() => [...gaps].sort((a, b) => { const [al, at] = a.split(":").map(Number), [bl, bt] = b.split(":").map(Number); return al - bl || at - bt; }), [gaps]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Record<string, boolean> | null>(null);
  const [slow] = useSlow();
  const inputs = useRef(new Map<string, HTMLInputElement | null>());
  useEffect(() => { inputs.current.get(order[0])?.focus({ preventScroll: true }); }, [order]);
  const tokOf = (k: string) => { const [l, t] = k.split(":").map(Number); return toks[l][t]; };
  const check = () => {
    const r: Record<string, boolean> = {};
    for (const k of order) r[k] = sameWord(vals[k] ?? "", tokOf(k).say);
    setResult(r);
    const ok = Object.values(r).every(Boolean);
    done(ok, ok ? undefined : toks.flatMap((line, li) => line.map((t, ti) => ({ word: t.text, ok: r[`${li}:${ti}`] !== false }))));
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="card flex flex-col gap-1.5">
        {toks.map((line, li) => (
          <p key={li} lang="fr" className="verse-text">
            {line.map((tok, ti) => {
              const k = `${li}:${ti}`;
              if (!gaps.has(k)) return <span key={ti}>{ti > 0 && " "}<Word tok={tok} slow={slow} /></span>;
              const len = Math.max(3, display(tok).length);
              const n = order.indexOf(k);
              const bad = result && !result[k];
              return (
                <span key={ti}>
                  {ti > 0 && " "}
                  <input ref={(el) => { inputs.current.set(k, el); }} value={vals[k] ?? ""} disabled={!!result}
                    aria-label={`Missing word ${n + 1} of ${order.length}, starts with ${initialOf(tok)}`}
                    placeholder={initialOf(tok)} lang="fr" autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false}
                    enterKeyHint={n + 1 < order.length ? "next" : "done"}
                    onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const nx = order[n + 1]; if (nx) inputs.current.get(nx)?.focus(); else if (order.every((g) => (vals[g] ?? "").trim())) check(); } }}
                    className={`mx-0.5 inline-block rounded-md border-b-2 bg-tint px-1 py-0 text-[1.25rem] leading-[1.3] outline-none placeholder:text-muted/70 focus:border-primary ${bad ? "border-primary text-primary line-through" : result ? "border-good" : "border-muted/60"}`}
                    style={{ width: `${Math.min(9, 0.62 * len + 1)}em` }} />
                  {bad && <span className="ml-1 font-bold text-good">{display(tok)}</span>}
                </span>
              );
            })}
          </p>
        ))}
      </div>
      <p className="text-xs text-muted">Accents and small slips are fine.</p>
      <button className="btn" disabled={!!result || order.some((k) => !(vals[k] ?? "").trim())} onClick={check}>Check</button>
    </div>
  );
}

/**
 * Type the whole verse from memory. The hint shows first letters, chunk by chunk; using it is fine, but it
 * costs a level (the pass is rated Hard, so the verse comes back a little sooner).
 */
export function Recall({ text, lines, hinted, onHint, placeholder = "Écrivez le verset de mémoire", lang = "fr", pass = PASS, note = true, done }: {
  text: string; lines: string[]; hinted: boolean; onHint: () => void; placeholder?: string; lang?: "fr" | "en"; pass?: number;
  /** Show the small "a hint is fine, it brings the verse back sooner" note (French recall only: it talks about scheduling). */
  note?: boolean; done: Done;
}) {
  const [val, setVal] = useState("");
  const [locked, setLocked] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {hinted && (
        <div className="card flex flex-col gap-1 !py-3" aria-label="First letters hint">
          {lines.map((l, i) => <p key={i} lang={lang} className="verse-text tracking-[0.2em] text-muted">{firstLetters(l)}</p>)}
        </div>
      )}
      <textarea className="input verse-text" rows={5} lang={lang} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={val}
        disabled={locked} aria-label={lang === "en" ? "The verse in English, from memory" : "The verse, from memory"} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} />
      <p className="text-xs text-muted">Accents, punctuation and small slips are fine.</p>
      <div className="flex gap-2">
        <button className="btn flex-1" disabled={locked || !val.trim()} onClick={() => { setLocked(true); const g = gradeRecall(val, text); done(g.score >= pass, g.marks); }}>Check</button>
        {!hinted && (
          <button type="button" className="btn ghost" disabled={locked} onClick={onHint}>
            <Lightbulb size={18} aria-hidden="true" /> First letters
          </button>
        )}
      </div>
      {!hinted && note && <p className="text-xs text-muted">A hint is fine. It just brings the verse back a little sooner.</p>}
    </div>
  );
}
