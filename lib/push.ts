import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

/** Sends a push to subscribed devices (everyone, or only `userIds`) and prunes dead subscriptions. Never throws; returns an error message if push could not be sent. */
export async function sendPushToAll(
  payload: { title: string; body?: string; url?: string },
  userIds?: string[],
): Promise<{ sent: number; error?: string }> {
  try {
    const { VAPID_SUBJECT: subject, NEXT_PUBLIC_VAPID_PUBLIC_KEY: pub, VAPID_PRIVATE_KEY: priv } = process.env;
    if (!subject || !pub || !priv) {
      console.warn("Push skipped: VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must all be set.");
      return { sent: 0, error: "Push is not configured (missing VAPID keys)." };
    }
    webpush.setVapidDetails(subject, pub, priv);
    const db = createServiceClient();
    // Only approved people receive pushes (inner join on profiles; denied or pending accounts are skipped).
    let q = db
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth, profiles!inner(status)")
      .eq("profiles.status", "approved");
    if (userIds) q = q.in("user_id", userIds);
    const { data: subs, error } = await q;
    if (error) throw error;
    const dead: string[] = [];
    let sent = 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number }).statusCode;
          if (code === 404 || code === 410) dead.push(s.endpoint);
        }
      }),
    );
    if (dead.length) await db.from("push_subscriptions").delete().in("endpoint", dead);
    return { sent };
  } catch (err) {
    console.error("Push failed", err);
    return { sent: 0, error: "Push notification failed." };
  }
}
