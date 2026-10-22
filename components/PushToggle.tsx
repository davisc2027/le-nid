"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function toKey(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function save(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await createClient().rpc("claim_push_subscription", {
    p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? "", p_auth: j.keys?.auth ?? "",
  });
  if (error) throw error;
}

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

/** `quietWhenOn` hides the "Notifications on" line (manage it under Me). */
export default function PushToggle({ quietWhenOn = false }: { quietWhenOn?: boolean }) {
  const [status, setStatus] = useState<"unsupported" | "off" | "on" | "denied">("off");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setStatus("unsupported"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setStatus("denied");
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return setStatus("off");
      setStatus("on");
      try { await save(sub); } catch { setError("Couldn't save notifications for this phone. Turn them off and on again."); }
    }).catch(() => {});
  }, []);

  async function enable() {
    setError(""); setBusy(true);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setStatus("denied");
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error("missing key");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
      await save(sub);
      setStatus("on");
    } catch {
      setError("Couldn't turn on notifications. Check your connection and try again.");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true);
    await unsubscribePush();
    setStatus("off"); setError(""); setBusy(false);
  }

  if (status === "unsupported")
    return <p className="card text-sm">To get notifications on iPhone: tap Share, then &ldquo;Add to Home Screen&rdquo;, and open Le Nid from there.</p>;
  if (status === "denied") return <p className="text-sm text-muted">Notifications are blocked in your phone settings.</p>;
  if (status === "on" && quietWhenOn) return null;
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
