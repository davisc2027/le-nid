"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Pencil, RefreshCw, SearchCheck, Trash2, Volume2, X } from "lucide-react";
import type { Turn } from "@/components/talk/types";
import { WARNING_TEXT, type TranslationWarning } from "@/lib/talk/warnings";

export type SheetAction = "edit" | "flip" | "delete" | "check" | "retry" | "read";

/** Bottom sheet with the actions for one sentence. Memory only: nothing here is saved. */
export default function BubbleSheet({ turn, canRelisten, canRead, onAction, onClose }: {
  turn: Turn; canRelisten: boolean; canRead: boolean; onAction: (a: SheetAction, text?: string) => void; onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(turn.original);
  const first = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, [onClose]);
  useEffect(() => { if (editing) area.current?.focus(); }, [editing]);

  const done = (a: SheetAction) => () => { onAction(a); onClose(); };
  const other = turn.side === "fr" ? "English" : "Français";
  const row = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-base font-bold hover:bg-tint";

  return (
    <div className="absolute inset-0 z-40 flex flex-col justify-end bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Sentence actions" onClick={(e) => e.stopPropagation()}
        className="max-h-[85%] overflow-y-auto rounded-t-2xl border border-b-0 border-border bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-start gap-2">
          <p className="flex-1 pt-2 text-sm text-muted [overflow-wrap:anywhere]" lang={turn.side ?? undefined}>{turn.original}</p>
          <button className="-mr-1 grid size-11 shrink-0 place-items-center rounded-xl text-muted" onClick={onClose} aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>
        {turn.warnings && turn.warnings.length > 0 && (
          <ul className="mb-1 rounded-xl bg-tint px-3 py-2 text-sm">
            {turn.warnings.map((w) => <li key={w}>{WARNING_TEXT[w as TranslationWarning] ?? "This translation may be off."}</li>)}
          </ul>
        )}
        {editing ? (
          <form className="flex flex-col gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { onAction("edit", t); onClose(); } }}>
            <label className="label" htmlFor="edit-turn">Edit what was said</label>
            <textarea id="edit-turn" ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} lang={turn.side ?? undefined}
              className="w-full rounded-xl border border-border bg-background p-3 text-base" />
            <div className="flex gap-2">
              <button type="button" className="btn ghost min-h-12 flex-1" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn min-h-12 flex-1" disabled={!text.trim()}>Translate again</button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col pt-1">
            {turn.warnings && turn.warnings.length > 0 && (
              <button ref={first} className={row} onClick={done("check")}><SearchCheck size={22} className="text-primary" aria-hidden="true" />Check meaning</button>
            )}
            <button ref={turn.warnings?.length ? undefined : first} className={row} onClick={() => setEditing(true)}><Pencil size={22} className="text-primary" aria-hidden="true" />Edit text</button>
            <button className={row} onClick={done("flip")}>
              <ArrowLeftRight size={22} className="text-primary" aria-hidden="true" />
              <span>Wrong language<span className="block text-sm font-normal text-muted">{canRelisten ? `Listen again as ${other}` : `Treat it as ${other}`}</span></span>
            </button>
            {!turn.warnings?.length && <button className={row} onClick={done("check")}><SearchCheck size={22} className="text-primary" aria-hidden="true" />Check meaning</button>}
            <button className={row} onClick={done("retry")}><RefreshCw size={22} className="text-primary" aria-hidden="true" />Translate again</button>
            {canRead && <button className={row} onClick={done("read")}><Volume2 size={22} className="text-primary" aria-hidden="true" />Read aloud</button>}
            <button className={`${row} text-primary`} onClick={done("delete")}><Trash2 size={22} aria-hidden="true" />Delete (that&apos;s not what I said)</button>
          </div>
        )}
      </div>
    </div>
  );
}
