"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import Stork from "@/components/art/Stork";
import { enablePush, readPushState, type PushState } from "@/lib/push-client";
import { TOUR_KEY } from "@/components/WelcomeTour";

const LATER_KEY = "nid-notify-later"; // sessionStorage: cleared when the app is closed, so it comes back on every launch

/** Soft prompt shown on every app launch until notifications are on. "Not now" always works and hides it until the next launch. */
export default function NotifyGate() {
  const [state, setState] = useState<PushState | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        // The first-time tour has its own notifications step; the gate starts after the tour has been seen.
        if (localStorage.getItem(TOUR_KEY) !== "1") return;
        if (sessionStorage.getItem(LATER_KEY) === "1") return;
      } catch { return; }
      const s = await readPushState();
      if (!live) return;
      setState(s);
      if (s === "off" || s === "denied") setShow(true);
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => { if (show) btn.current?.focus(); }, [show]);

  function later() {
    try { sessionStorage.setItem(LATER_KEY, "1"); } catch {}
    setShow(false);
  }
  async function turnOn() {
    setBusy(true); setError("");
    const r = await enablePush();
    setBusy(false);
    if (r === "on") return setShow(false);
    if (r === "denied") { setState("denied"); return; }
    setError("Couldn't turn them on. Check your connection and try again.");
  }

  if (!show) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ng-title" className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-background px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-center">
      <Stork mood="happy" size={110} />
      <h2 id="ng-title" className="text-2xl font-extrabold">Turn on notifications</h2>
      {state === "denied" ? (
        <p className="max-w-xs text-base">Notifications are blocked for Le Nid. Open iPhone <b>Settings, Notifications, Le Nid</b> and turn on <b>Allow Notifications</b>. That&apos;s how you&apos;ll get schedule changes, announcements and reminders.</p>
      ) : (
        <p className="max-w-xs text-base">So you don&apos;t miss schedule changes, announcements and to-do reminders on the trip. Tap the button, then tap <b>Allow</b>.</p>
      )}
      {state !== "denied" && (
        <button ref={btn} type="button" className="btn w-full max-w-xs" onClick={turnOn} disabled={busy}>
          <Bell size={20} aria-hidden="true" /> {busy ? "Working…" : "Turn on notifications"}
        </button>
      )}
      {error && <p className="text-sm text-primary" role="alert">{error}</p>}
      <button type="button" className="btn ghost min-h-12 w-full max-w-xs" onClick={later}>Not now</button>
    </div>
  );
}
