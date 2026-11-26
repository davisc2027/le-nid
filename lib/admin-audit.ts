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
