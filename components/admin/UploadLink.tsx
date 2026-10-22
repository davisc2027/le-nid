"use client";

import { useState } from "react";
import { viewUpload } from "@/app/(app)/admin/actions";

/** Opens a passport copy (or similar) through a 60 s signed URL. */
export default function UploadLink({ todoId, userId, name }: { todoId: string; userId: string; name: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function open() {
    const w = window.open("", "_blank");
    setBusy(true); setErr("");
    const res = await viewUpload(todoId, userId);
    setBusy(false);
    if (res.url && w) w.location.href = res.url;
    else { w?.close(); setErr(res.error ?? "Could not open"); }
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={open} disabled={busy} className="min-h-11 px-2 text-primary underline">{busy ? "Opening…" : `View ${name}`}</button>
      {err && <span className="text-red-600">{err}</span>}
    </span>
  );
}
