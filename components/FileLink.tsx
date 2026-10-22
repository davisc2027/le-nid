"use client";

import { useState } from "react";

/**
 * Opens a file through a short-lived signed URL. In the installed iPhone app a target=_blank link opens a
 * sheet that has no login, so the URL is fetched here (with the app's cookies) and then opened directly.
 * The href stays as a fallback for when JavaScript or the fetch is unavailable.
 */
export default function FileLink({ id, title, kind }: { id: string; title: string; kind: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function open(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    // Outside the installed app, open the tab inside the tap so Safari does not block it.
    const w = standalone ? null : window.open("", "_blank");
    setBusy(true); setErr("");
    try {
      const res = await fetch(`/files/${id}?json=1`, { credentials: "same-origin", cache: "no-store" });
      if (res.redirected || !res.ok) throw new Error(res.status === 404 ? "File not found" : "Please sign in again");
      const { url } = (await res.json()) as { url?: string };
      if (!url) throw new Error("File not found");
      // Installed app: navigate this window. iOS shows the file in a viewer with a Done button that returns here.
      if (standalone) window.location.assign(url);
      else if (w) w.location.href = url;
      else window.location.assign(url);
    } catch (e2) {
      w?.close();
      setErr(e2 instanceof TypeError ? "No connection. Try again." : e2 instanceof Error ? e2.message : "Could not open");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <a className="card flex min-h-11 items-center justify-between" href={`/files/${id}`} onClick={open} aria-busy={busy}>
        <span>{busy ? "Opening…" : title}</span>
        <span className="text-xs uppercase text-muted">{kind}</span>
      </a>
      {err && <p className="px-1 text-sm text-primary" role="alert">{err}</p>}
    </div>
  );
}
