"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Stork from "@/components/art/Stork";
import Logo from "@/components/art/Logo";

/** Shown instead of the app until an admin approves the account. Checks again every 20 seconds. */
export default function PendingScreen({ id, name: initial, rejected }: { id: string; name: string; rejected: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(initial);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (rejected) return;
    const t = setInterval(() => router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [rejected, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().from("profiles").update({ name: name.trim() }).eq("id", id);
    setMsg(error ? "Couldn't save that. Try again." : "Saved. A leader will see your name.");
  }
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 text-center">
      <div className="flex justify-center"><Logo size={64} /></div>
      <div className="flex justify-center"><Stork mood={rejected ? "sulk" : "sleepy"} size={110} label="Odile" /></div>
      {rejected ? (
        <>
          <h1 className="text-xl font-extrabold">This request wasn't approved</h1>
          <p className="text-muted">If you think that's a mistake, talk to a trip leader in person.</p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-extrabold">Waiting for a leader to let you in</h1>
          <p className="text-muted">Your request is sent. This page checks again on its own, so you can leave it open.</p>
          <form onSubmit={save} className="card gap-2 text-left">
            <label htmlFor="pname" className="label">Your name, so leaders know it's you</label>
            <input id="pname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" required />
            <button className="btn">Save name</button>
            {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
          </form>
          <button className="btn ghost" onClick={() => router.refresh()}>Check again</button>
        </>
      )}
      <button onClick={signOut} className="min-h-11 text-sm text-muted underline">Sign out</button>
    </main>
  );
}
