"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/art/Logo";
import Backdrop from "@/components/art/Backdrop";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${location.origin}/auth/callback` } });
    if (error) setError(error.message); else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const { error } = await createClient().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    if (error) setError("That code didn't work. Check it, or ask for a new one."); else { router.replace("/"); router.refresh(); }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4">
      <Backdrop />
      <h1 className="sr-only">Le Nid</h1>
      <Logo stacked size={120} />
      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <p className="text-muted">Strasbourg mission trip. Enter your email and we&apos;ll send you a sign-in code.</p>
          <label htmlFor="email" className="sr-only">Email</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn" type="submit">Send code</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-muted">We sent a code to <b>{email}</b>. Enter it here. Don&apos;t tap the link in the email; the code keeps you signed in inside this app.</p>
          <label htmlFor="code" className="sr-only">Code</label>
          <input id="code" className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn" type="submit">Sign in</button>
          <button type="button" className="text-sm text-muted underline" onClick={() => { setStep("email"); setCode(""); }}>Use a different email</button>
        </form>
      )}
      {error && <p className="text-sm text-primary" role="alert">{error}</p>}
    </main>
  );
}
