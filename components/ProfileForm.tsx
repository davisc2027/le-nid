"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushToggle, { unsubscribePush } from "./PushToggle";

export default function ProfileForm({ id, name: initial, optIn: initialOptIn, team }: { id: string; name: string; optIn: boolean; team: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [msg, setMsg] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().from("profiles").update({ name: name.trim(), leaderboard_opt_in: optIn }).eq("id", id);
    setMsg(error ? error.message : "Saved.");
    router.refresh();
  }
  async function signOut() {
    await unsubscribePush();
    await createClient().auth.signOut();
    try { await Promise.all((await caches.keys()).map((k) => caches.delete(k))); } catch {}
    router.replace("/login");
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={save} className="card gap-3">
        <label htmlFor="name" className="label">Your name</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name and last initial" required />
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>Show me on the weekly leaderboard. Team totals count everyone either way.</span></label>
        {team && <p className="text-sm text-muted">Your team: <b>{team}</b></p>}
        <button className="btn">Save</button>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </form>
      <div className="card gap-2"><h2 className="label">Notifications</h2><PushToggle /></div>
      <button onClick={signOut} className="min-h-11 self-start px-3 text-sm text-muted underline">Sign out</button>
    </div>
  );
}
