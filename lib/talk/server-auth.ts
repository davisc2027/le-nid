// Server only (imports next/headers through lib/supabase/server).
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Signed-in AND approved (profiles.status = 'approved'), checked with the cookie-based client like /api/translate.
 * Returns the user, or a JSON Response to send back as-is.
 */
export async function requireApprovedUser(): Promise<{ user: User } | { response: Response }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: Response.json({ error: "unauthorized", message: "Sign in first." }, { status: 401 }) };
  const r = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle();
  // Same fallback as getProfile(): before migration 0008 there is no status column and everyone counts as approved.
  const status = r.error ? "approved" : r.data?.status;
  if (status !== "approved") return { response: Response.json({ error: "forbidden", message: "Your account is waiting for a leader's approval." }, { status: 403 }) };
  return { user };
}
