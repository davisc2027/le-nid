"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdoptSet({ refs }: { refs: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function adopt() {
    setBusy(true); setErr(false);
    const { error } = await createClient().from("srs_cards").upsert(refs.map((ref) => ({ ref })), { onConflict: "user_id,ref", ignoreDuplicates: true });
    setBusy(false);
    if (error) return setErr(true);
    router.refresh();
  }
  return (
    <div className="flex flex-col items-start gap-1">
      <button className="btn ghost" onClick={adopt} disabled={busy}>{busy ? "Adding…" : "Add all to my verses"}</button>
      {err && <p className="text-sm text-primary" role="alert">Couldn't save. Check your connection and try again.</p>}
    </div>
  );
}
