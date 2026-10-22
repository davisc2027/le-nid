"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/art/Logo";
import Backdrop from "@/components/art/Backdrop";

function friendly(message: string) {
  if (/trip list|database error saving new user/i.test(message)) return "This email isn't on the trip list yet. Ask a trip leader to add your email, then try again.";
  if (/rate limit|seconds|too many/i.test(message)) return "Wait a minute before asking for another code.";
  if (/fetch|network|load failed/i.test(message)) return "No connection. Try again.";
  return "Couldn't send the code. Check the email address and try again.";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback` } });
      if (error) setError(friendly(error.message)); else { setStep("code"); setWait(60); }
    } catch {
      setError("No connection. Try again.");
    } finally { setBusy(false); }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(""); setBusy(true);
    try {
      const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code, type: "email" });
      if (error) setError("That code didn't work. Check it, or ask for a new one."); else { router.replace("/"); router.refresh(); return; }
    } catch {
      setError("No connection. Try again.");
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <Backdrop />
      <h1 className="sr-only">Le Nid</h1>
      <Logo stacked size={120} />
      <div className="card">
        {step === "email" ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <p className="text-muted">Strasbourg mission trip. Enter your email and we&apos;ll send you a sign-in code.</p>
            <label htmlFor="email" className="sr-only">Email</label>
            <input id="email" className="input" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" type="submit" disabled={busy}>{busy ? "Sending..." : "Send code"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-3">
            <p className="text-muted">We sent a code to <b>{email}</b>. Enter it here. Don&apos;t tap the link in the email; the code keeps you signed in inside this app.</p>
            <label htmlFor="code" className="sr-only">Code</label>
            <input id="code" className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
            <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? "Checking..." : "Sign in"}</button>
            <button type="button" className="min-h-11 text-sm text-muted underline disabled:no-underline" disabled={busy || wait > 0} onClick={() => sendCode()}>
              {wait > 0 ? `Send a new code (${wait}s)` : "Send a new code"}
            </button>
            <button type="button" className="min-h-11 text-sm text-muted underline" onClick={() => { setStep("email"); setCode(""); setError(""); }}>Use a different email</button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-primary" role="alert">{error}</p>}
      </div>
    </main>
  );
}
