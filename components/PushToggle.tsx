"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function toKey(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function PushToggle() {
  const [status, setStatus] = useState<"unsupported" | "off" | "on" | "denied">("off");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { setStatus("unsupported"); return; }
    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (Notification.permission === "denied") return setStatus("denied");
      setStatus((await reg.pushManager.getSubscription()) ? "on" : "off");
    });
  }, []);

  async function enable() {
    if ((await Notification.requestPermission()) !== "granted") return setStatus("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const j = sub.toJSON();
    await createClient().from("push_subscriptions").upsert({
      endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth,
    });
    setStatus("on");
  }

  if (status === "on") return <p className="text-sm text-muted">Notifications on.</p>;
  if (status === "unsupported")
    return <p className="card text-sm">To get notifications on iPhone: tap Share, then &ldquo;Add to Home Screen&rdquo;, and open Le Nid from there.</p>;
  if (status === "denied") return <p className="text-sm text-muted">Notifications are blocked in your phone settings.</p>;
  return <button className="btn" onClick={enable}>Turn on notifications</button>;
}
