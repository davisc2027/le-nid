"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BOOKS, findBook, type Book } from "@/lib/bible/books";
import { bibleInstalled, loadBookText, loadVerse } from "@/lib/bible/load";
import { parseRef, refKey } from "@/lib/bible/reference";
import TapWords from "./TapWords";

type Item = { key: string; label: string; hint?: string; fill: string; done?: boolean };

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.\s]/g, "");
const snippet = (t: string) => (t.length > 54 ? t.slice(0, 52).trimEnd() + "…" : t);

export default function AddVerse() {
  const router = useRouter();
  const listId = useId();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [data, setData] = useState<{ code: string; ch: string[][] } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // "Jean 3" or "Jean 3:1" -> the book and numbers typed so far.
  const parts = useMemo(() => {
    const m = text.match(/^(.+?)\s+(\d+)(?:\s*[:.,]\s*(\d*))?$/);
    const book = m ? findBook(m[1]) : undefined;
    return m && book ? { book, chapter: m[2], verse: m[3] } : null;
  }, [text]);

  useEffect(() => {
    if (!parts) return;
    let live = true;
    loadBookText(parts.book.code).then((ch) => live && setData(ch ? { code: parts.book.code, ch } : null));
    return () => { live = false; };
  }, [parts]);

  useEffect(() => {
    const r = parseRef(text);
    if (!r) { setPreview(null); return; }
    let live = true;
    loadVerse(refKey(r)).then((v) => live && setPreview(v ? v.fr : null));
    return () => { live = false; };
  }, [text]);

  const items: Item[] = useMemo(() => {
    if (!parts) {
      const q = fold(text);
      if (!q || /^\d+$/.test(q)) return [];
      return BOOKS.filter((b: Book) => fold(b.fr).startsWith(q) || fold(b.en).startsWith(q))
        .slice(0, 6).map((b) => ({ key: b.code, label: b.fr, hint: b.en !== b.fr ? b.en : undefined, fill: `${b.fr} ` }));
    }
    const ch = data?.code === parts.book.code ? data.ch : null;
    if (!ch) return [];
    if (parts.verse === undefined) {
      return ch.map((_, i) => String(i + 1)).filter((n) => n.startsWith(parts.chapter)).slice(0, 8)
        .map((n) => ({ key: n, label: `${parts.book.fr} ${n}`, hint: `${ch[Number(n) - 1].length} verses`, fill: `${parts.book.fr} ${n}:` }));
    }
    const verses = ch[Number(parts.chapter) - 1] ?? [];
    return verses.map((v, i) => ({ n: String(i + 1), v })).filter(({ n, v }) => v && v !== "=" && n.startsWith(parts.verse ?? "")).slice(0, 8)
      .map(({ n, v }) => ({ key: n, label: `${parts.book.fr} ${parts.chapter}:${n}`, hint: snippet(v), fill: `${parts.book.fr} ${parts.chapter}:${n}`, done: true }));
  }, [parts, text, data]);

  function pick(i: Item) {
    setText(i.fill); setActive(0); setMsg("");
    setOpen(!i.done);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ref = parseRef(text);
    if (!ref) return setMsg("Pick a book, then a chapter and verse, like Jean 3:16.");
    const key = refKey(ref);
    setBusy(true); setMsg(""); setOpen(false);
    try {
      const verse = await loadVerse(key);
      if (!verse) return setMsg((await bibleInstalled()) ? "I couldn't find that verse. Check the chapter and verse numbers." : "The Bible text isn't installed yet. Ask a leader to install it.");
      const { error } = await createClient().from("srs_cards").upsert({ ref: key }, { onConflict: "user_id,ref", ignoreDuplicates: true });
      if (error) return setMsg("Couldn't save. Check your connection and try again.");
      setText(""); setMsg("Added.");
      router.refresh();
    } finally { setBusy(false); }
  }

  function onKey(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % items.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + items.length) % items.length); }
    else if (e.key === "Enter" && items[active] && !parseRef(text)) { e.preventDefault(); pick(items[active]); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-2">
      <label htmlFor="ref" className="label">Add a verse</label>
      <div className="relative flex gap-2">
        <input id="ref" className="input" value={text} placeholder="Start typing: Jean, Romains…"
          role="combobox" aria-expanded={open && items.length > 0} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
          onChange={(e) => { setText(e.target.value); setOpen(true); setActive(0); setMsg(""); }}
          onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKey} />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
        {open && items.length > 0 && (
          <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-surface shadow-lg">
            {items.map((it, i) => (
              <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                onPointerDown={(e) => { e.preventDefault(); pick(it); }}
                className={`flex min-h-12 cursor-pointer flex-col justify-center px-3 py-1.5 ${i === active ? "bg-tint" : ""}`}>
                <span className="font-bold">{it.label}</span>
                {it.hint && <span className="text-xs text-muted">{it.hint}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {preview && !open && <div aria-live="polite"><TapWords text={preview} className="verse-text text-base text-muted" /></div>}
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
    </form>
  );
}
