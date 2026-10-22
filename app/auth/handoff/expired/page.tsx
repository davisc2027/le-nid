import Link from "next/link";
import Logo from "@/components/art/Logo";

// Where a used or expired Safari hand-off link lands. Signed-out friendly (proxy.ts allows /auth).
export default function HandoffExpired() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <Logo stacked size={96} />
      <div className="card gap-2">
        <h1 className="text-xl font-extrabold">That link has already been used</h1>
        <p>Safari links sign you in once and expire after a while. Go back to the Le Nid app, open Conversation mode, and tap Copy Safari link again.</p>
        <p className="text-sm text-muted">Or sign in here in Safari with your email code.</p>
      </div>
      <Link href="/login" className="btn">Sign in with email</Link>
    </main>
  );
}
