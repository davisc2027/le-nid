"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, Copy, Check, Share, X } from "lucide-react";
import type { HandoffResult } from "@/lib/talk/client";

type Props = {
  /** "busy": live listening failed; "voluntary": the person asked for the backup. */
  reason: "busy" | "voluntary";
  why?: string;
  getLink: () => Promise<HandoffResult>;
  onClose: () => void;
};

/**
 * Shown in the Home Screen app, where Safari's voice recognition does not work well. Makes a one-time sign-in link
 * so Conversation mode opens in Safari already signed in as the same person.
 */
export default function HandoffCard({ reason, why, getLink, onClose }: Props) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState("");
  const [canShare, setCanShare] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Client-only feature check, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator.share === "function");
    heading.current?.focus();
  }, []);
  useEffect(() => { if (manual) field.current?.select(); }, [manual]);

  async function copy() {
    setError(""); setCopied(false);
    const cached = link;
    const pending: Promise<HandoffResult> = cached ? Promise.resolve({ ok: true, url: cached }) : getLink();
    if (!cached) setBusy(true);
    let done = false;
    // Safari only allows clipboard writes during the tap. A ClipboardItem that takes a promise keeps that
    // permission while the link is being made; plain writeText is the fallback.
    try {
      if (!cached && typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        const blob = pending.then((r) => { if (!r.ok) throw new Error(r.message); return new Blob([r.url], { type: "text/plain" }); });
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
        done = true;
      }
    } catch { /* fall through */ }
    const r = await pending;
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setLink(r.url);
    if (!done) { try { await navigator.clipboard.writeText(r.url); done = true; } catch { /* fall back to selecting */ } }
    setCopied(done);
    setManual(!done);
  }

  async function share() {
    setError("");
    let url = link;
    if (!url) {
      setBusy(true);
      const r = await getLink();
      setBusy(false);
      if (!r.ok) { setError(r.message); return; }
      url = r.url; setLink(url);
    }
    try { await navigator.share({ url }); } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NotAllowedError") setError("Tap Share link once more.");
      else if (name !== "AbortError") setManual(true);
    }
  }

  return (
    <section className="card flex flex-col gap-3 border-2 border-primary" aria-labelledby="handoff-title">
      <div className="flex items-start justify-between gap-2">
        <h2 id="handoff-title" ref={heading} tabIndex={-1} className="flex items-center gap-2 text-lg font-extrabold leading-tight outline-none">
          <Compass size={22} aria-hidden="true" className="shrink-0 text-primary" />
          {reason === "busy" ? "Voice recognition is busy. Open this in Safari to keep going" : "Use the Safari backup"}
        </h2>
        <button onClick={onClose} className="-m-2 grid size-11 shrink-0 place-items-center rounded-xl text-muted" aria-label="Close"><X size={20} aria-hidden="true" /></button>
      </div>
      {why && <p className="text-sm">{why}</p>}
      <p className="text-sm">Safari has its own voice recognition. It doesn&apos;t work inside the Home Screen app, so open Conversation mode in Safari instead.</p>
      <div className="flex flex-col gap-2">
        <button className="btn min-h-14 gap-2 text-lg" onClick={copy} disabled={busy}>
          {copied ? <Check size={22} aria-hidden="true" /> : <Copy size={22} aria-hidden="true" />}
          {busy ? "Making your link…" : copied ? "Copied. Now open Safari" : "Copy Safari link"}
        </button>
        {canShare && (
          <button className="btn ghost gap-2" onClick={share} disabled={busy}><Share size={20} aria-hidden="true" />Share link</button>
        )}
      </div>
      <ol className="ml-5 list-decimal text-sm">
        <li>Open Safari.</li>
        <li>Tap the address bar and paste the link.</li>
        <li>Tap Go.</li>
      </ol>
      {manual && link && (
        <div className="flex flex-col gap-1">
          <label htmlFor="handoff-link" className="text-sm font-bold">Couldn&apos;t copy automatically. Select the link and copy it:</label>
          <input id="handoff-link" ref={field} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="input select-all text-sm" />
        </div>
      )}
      {error && <p role="alert" className="text-sm font-bold text-primary">{error}</p>}
      <p className="text-xs text-muted">This link signs you in once. Don&apos;t share it.{link && <> <button className="underline min-h-11" onClick={() => { setLink(""); setCopied(false); setManual(false); }}>Make a new link</button></>}</p>
    </section>
  );
}
