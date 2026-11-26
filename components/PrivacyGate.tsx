"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Stork from "@/components/art/Stork";
import { createClient } from "@/lib/supabase/client";
import { unsubscribePush } from "@/components/PushToggle";
import { clearDeviceData } from "@/lib/device-cleanup";

/** Pages that must stay reachable while the consent screen is pending: the notice itself, and the emergency screen. */
const OPEN_PATHS = ["/privacy", "/emergency"];

/**
 * One-time consent screen. The (app) layout mounts it only for approved people whose privacy_ack_at is empty (and only
 * when migration 0021 exists), and holds back the first-time tour and the notification prompt until it is accepted:
 * consent first, then tour, then notifications. Accepting calls accept_privacy() and refreshes the layout.
 */
export default function PrivacyGate({ summary }: { summary: string }) {
  const path = usePathname();
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLInputElement>(null);
  const hidden = OPEN_PATHS.some((p) => path === p);

  useEffect(() => { if (!hidden) box.current?.focus(); }, [hidden]);

  async function accept() {
    if (!ok || busy) return;
    setBusy(true); setError("");
    try {
      const { error: e } = await createClient().rpc("accept_privacy");
      if (e) throw e;
      router.refresh();
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
      setBusy(false);
    }
  }
  async function signOut() {
    await unsubscribePush();
    await createClient().auth.signOut();
    await clearDeviceData();
    router.replace("/login");
  }

  if (hidden) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="pg-title" className="fixed inset-0 z-[70] overflow-y-auto bg-background px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-4 py-6 text-center">
        <Stork mood="happy" size={96} />
        <h2 id="pg-title" className="text-2xl font-extrabold">Before you start</h2>
        <p className="text-base">{summary}</p>
        <Link href="/privacy" className="inline-flex min-h-11 items-center text-base font-bold text-primary underline">Read the full privacy notice</Link>
        <label className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-3 text-left text-base">
          <input ref={box} type="checkbox" className="mt-0.5 size-6 shrink-0" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>I have read this and I am OK with it.</span>
        </label>
        <button type="button" className="btn w-full" disabled={!ok || busy} onClick={accept}>{busy ? "Saving…" : "Continue"}</button>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        <button type="button" className="min-h-11 px-3 text-sm text-muted underline" onClick={signOut}>I don&apos;t agree: sign out</button>
      </div>
    </div>
  );
}
