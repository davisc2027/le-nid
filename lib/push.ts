import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

/** Sends a push to every subscribed device and prunes dead subscriptions. */
export async function sendPushToAll(payload: { title: string; body?: string; url?: string }) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  const db = createServiceClient();
  const { data: subs } = await db.from("push_subscriptions").select("endpoint, p256dh, auth");
  const dead: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint);
      }
    }),
  );
  if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);
}
