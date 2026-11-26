import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/art/Logo";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/talk/safe-next";

// Confirmation step for a Safari hand-off link. Opening this page signs nobody in: the button POSTs to /auth/handoff,
// which is the only place the one-time token is used. Signed-out friendly (proxy.ts allows /auth).
export const metadata: Metadata = { title: "Continue in Safari", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function HandoffContinue({ searchParams }: { searchParams: Promise<{ th?: string | string[]; next?: string | string[] }> }) {
  const sp = await searchParams;
  const th = typeof sp.th === "string" ? sp.th : "";
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  let current: string | null = null;
  try {
    const { data } = await (await createClient()).auth.getClaims();
    current = typeof data?.claims?.email === "string" ? data.claims.email : null;
  } catch { /* treat as signed out */ }

  if (!th) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-[max(1rem,env(safe-area-inset-top))]">
        <Logo stacked size={96} />
        <div className="card gap-2">
          <h1 className="text-xl font-extrabold">That link is incomplete</h1>
          <p>Go back to the Le Nid app, open Conversation mode, and tap Copy Safari link again.</p>
        </div>
        <Link href="/login" className="btn">Sign in with email</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-[max(1rem,env(safe-area-inset-top))]">
      <Logo stacked size={96} />
      <form method="post" action="/auth/handoff" className="card gap-3">
        <h1 className="text-xl font-extrabold">Continue in Safari?</h1>
        <p>This signs this browser in to Le Nid, as the person who made the link from their own Le Nid app.</p>
        {current ? (
          <p className="rounded-lg bg-tint p-2 text-sm">
            This browser is already signed in as <b className="break-all">{current}</b>. Continuing switches it to the account the link was made for.
            If you didn&apos;t make this link yourself, don&apos;t continue.
          </p>
        ) : (
          <p className="text-sm text-muted">If you didn&apos;t make this link yourself, don&apos;t continue.</p>
        )}
        <input type="hidden" name="th" value={th} />
        <input type="hidden" name="next" value={next} />
        <button className="btn">Continue</button>
      </form>
      <Link href="/login" className="text-center text-sm text-muted underline">Not now. Sign in with an email code instead</Link>
    </main>
  );
}
