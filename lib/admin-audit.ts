import { createServiceClient } from "@/lib/supabase/server";

/**
 * Writes one row to admin_audit (migration 0020) with the service client; clients cannot insert there.
 * Never throws: before migration 0020 the table is missing and the admin action must still work.
 * Returns false when the row could not be written.
 */
export async function audit(actor: string | null | undefined, action: string, targetEmail: string | null, detail?: Record<string, unknown>) {
  try {
    const { error } = await createServiceClient().from("admin_audit")
      .insert({ actor: actor ?? null, action, target_email: targetEmail, detail: detail ?? null });
    if (error) { console.warn("admin_audit not written:", error.message); return false; }
    return true;
  } catch (e) {
    console.warn("admin_audit not written:", e);
    return false;
  }
}

/**
 * Like audit(), but skips the write when this actor already logged this action within `withinMs`. Used for "view_roster",
 * which would otherwise add a row for every Admin page refresh. Never throws.
 */
export async function auditOnce(actor: string | null | undefined, action: string, detail: Record<string, unknown> | undefined, withinMs: number) {
  try {
    const db = createServiceClient();
    let q = db.from("admin_audit").select("id").eq("action", action).gte("at", new Date(Date.now() - withinMs).toISOString()).limit(1);
    q = actor ? q.eq("actor", actor) : q.is("actor", null);
    const { data, error } = await q;
    if (error) { console.warn("admin_audit not read:", error.message); return false; }
    if (data?.length) return true;
  } catch (e) {
    console.warn("admin_audit not read:", e);
    return false;
  }
  return audit(actor, action, null, detail);
}

/** When this actor last wrote `action` about `targetEmail` (ms since epoch), or null. Used to throttle reminders. */
export async function lastAudit(action: string, targetEmail: string | null, withinMs: number): Promise<number | null> {
  try {
    if (!targetEmail) return null;
    const { data, error } = await createServiceClient().from("admin_audit").select("at").eq("action", action).eq("target_email", targetEmail)
      .gte("at", new Date(Date.now() - withinMs).toISOString()).order("at", { ascending: false }).limit(1);
    if (error || !data?.length) return null;
    return Date.parse(data[0].at);
  } catch {
    return null;
  }
}
