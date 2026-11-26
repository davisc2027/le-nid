"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Shown by server pages when Supabase returns an error, so a failed load never looks like "Nothing yet".
export default function LoadError({ what = "this page" }: { what?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="card flex flex-col items-start gap-3" role="alert">
      <h2 className="text-lg font-extrabold">Could not load {what}</h2>
      <p className="text-muted">Could not load. Check your connection and try again.</p>
      <button type="button" className="btn" disabled={pending} onClick={() => start(() => router.refresh())}>
        {pending ? "Trying…" : "Retry"}
      </button>
    </div>
  );
}
