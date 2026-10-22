"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/art/Logo";
import Backdrop from "@/components/art/Backdrop";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    if (error) { setError(error.message); setState("error"); } else setState("sent");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <Backdrop />
      <h1 className="sr-only">Le Nid</h1>
      <Logo stacked size={120} />
      <p className="text-muted">Strasbourg mission trip. Enter your email and we&apos;ll send you a sign-in link.</p>
      {state === "sent" ? (
        <p className="card">Check your email and tap the link. Open it in the same browser you use for the app.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input className="input" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" type="submit">Send link</button>
          {state === "error" && <p className="text-sm text-primary">{error}</p>}
        </form>
      )}
    </main>
  );
}
