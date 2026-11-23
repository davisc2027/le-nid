"use client";

import { createClient } from "@/lib/supabase/client";

export type PushState = "unsupported" | "off" | "on" | "denied";

function toKey(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function savePushSubscription(sub: PushSubscription) {
  const j = sub.toJSON();
  const { error } = await createClient().rpc("claim_push_subscription", {
    p_endpoint: sub.endpoint, p_p256dh: j.keys?.p256dh ?? "", p_auth: j.keys?.auth ?? "",
  });
  if (error) throw error;
}

/** Where this phone stands: no push support (e.g. Safari not on the Home Screen), off, on, or blocked in Settings. */
export async function readPushState(): Promise<PushState> {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return "unsupported";
    const reg = await navigator.serviceWorker.register("/sw.js");
    if (Notification.permission === "denied") return "denied";
    return (await reg.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Must run inside a tap. Asks the phone for permission, subscribes and saves the subscription. */
export async function enablePush(): Promise<"on" | "denied" | "error"> {
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) return "error";
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(key) });
    await savePushSubscription(sub);
    return "on";
  } catch {
    return "error";
  }
}
