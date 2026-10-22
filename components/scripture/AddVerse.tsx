"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { bibleInstalled, loadVerse } from "@/lib/bible/load";
import { parseRef, refKey } from "@/lib/bible/reference";

export default function AddVerse() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ref = parseRef(text);
    if (!ref) return setMsg("Try a format like Jean 3:16 or Romains 8:38-39.");
    const key = refKey(ref);
    setBusy(true); setMsg("");
    try {
      const verse = await loadVerse(key);
      if (!verse) return setMsg((await bibleInstalled()) ? "I couldn't find that verse. Check the book, chapter and verse numbers." : "The Bible text isn't installed yet. Ask a leader to install it.");
      const { error } = await createClient().from("srs_cards").upsert({ ref: key }, { onConflict: "user_id,ref", ignoreDuplicates: true });
      if (error) return setMsg("Couldn't save. Check your connection and try again.");
      setText(""); setMsg("Added.");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={add} className="flex flex-col gap-2">
      <label htmlFor="ref" className="label">Add a verse</label>
      <div className="flex gap-2">
        <input id="ref" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jean 3:16" />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </form>
  );
}
