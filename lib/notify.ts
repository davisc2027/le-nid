import { createServiceClient } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";

/** Tells every admin's devices that someone is waiting for approval. Sent once per person (claimed in usage_daily, no migration). */
export async function notifyAdminsOfRequest(person: { id: string; name?: string | null; email?: string | null }) {
  try {
    const db = createServiceClient();
    const { data: claimed } = await db
      .from("usage_daily")
      .upsert({ user_id: person.id, day: "1970-01-01", kind: "pending_notice", amount: 1 }, { onConflict: "user_id,day,kind", ignoreDuplicates: true })
      .select("user_id");
    if (!claimed?.length) return;
    const { data: admins } = await db.from("profiles").select("id").eq("role", "admin").eq("status", "approved");
    const ids = (admins ?? []).map((a) => a.id);
    if (!ids.length) return;
    const who = person.name || person.email || "Someone";
    await sendPushToAll({ title: "New access request", body: `${who} is waiting for approval.`, url: "/admin" }, ids);
  } catch (err) {
    console.error("Admin request notice failed", err);
  }
}
