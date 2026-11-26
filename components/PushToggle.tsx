"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enablePush, savePushSubscription } from "@/lib/push-client";

/** Removes this device's subscription (database row and browser). Safe to call when not subscribed. */
export async function unsubscribePush() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    if (!sub) return;
    await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch {}
}

/** `prompt` (used on Home) shows only the turn-on button; turning off and status messages live on the profile page. */
export default function PushToggle({ prompt = false }: { prompt?: boolean }) {
  const [status, setStatus] = useState<"checking" | "unsupported" | "off" | "on" | "denied">("checking");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- push support is known only in the browser
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setStatus("unsupported"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setStatus("denied");
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setStatus("off");
      setStatus("on");
      try { await savePushSubscription(sub); } catch { setError("Couldn't save notifications for this phone. Turn them off and on again."); }
    }).catch(() => {});
  }, []);

  async function enable() {
    setError(""); setBusy(true);
    const r = await enablePush();
    if (r === "on") setStatus("on");
    else if (r === "denied") setStatus("denied");
    else setError("Couldn't turn on notifications. Check your connection and try again.");
    setBusy(false);
  }

  async function disable() {
    setBusy(true);
    await unsubscribePush();
    setStatus("off"); setError(""); setBusy(false);
  }

  if (status === "checking" || (prompt && status !== "off")) return null;
  if (status === "unsupported")
    return <p className="card text-sm">To get notifications on iPhone: tap Share, then &ldquo;Add to Home Screen&rdquo;, and open Le Nid from there.</p>;
  if (status === "denied") return <p className="text-sm text-muted">Notifications are blocked in your phone settings.</p>;
  return (
    <div className="flex flex-col gap-2">
      {status === "on" ? (
        <p className="text-sm text-muted">Notifications on. <button className="min-h-11 px-2 underline" onClick={disable} disabled={busy}>Turn off</button></p>
      ) : (
        <button className="btn" onClick={enable} disabled={busy}>Turn on notifications</button>
      )}
      {error && <p className="text-sm text-primary" role="alert">{error}</p>}
    </div>
  );
}
