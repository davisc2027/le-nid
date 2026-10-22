// Server only (imports next/headers through lib/supabase/server).
import { createClient } from "@/lib/supabase/server";

export type ApprovedUser = { id: string; email?: string };

/**
 * Signed-in AND approved (profiles.status = 'approved'), checked with the cookie-based client.
 * Uses getClaims() (local JWT verification, no Auth round trip), then one profiles query.
 * Returns the user and the cookie-based client (reuse it for RPCs), or a JSON Response to send back as-is.
 */
export async function requireApprovedUser(): Promise<
  { user: ApprovedUser; supabase: Awaited<ReturnType<typeof createClient>> } | { response: Response }
> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) return { response: Response.json({ error: "unauthorized", message: "Sign in first." }, { status: 401 }) };
  const email = typeof claims.claims.email === "string" ? claims.claims.email : undefined;

  const r =await supabase.from("profiles").select("status").eq("id", id).maybeSingle();
  // Only "column does not exist" (migration 0008 not run yet) counts as approved; any other error is a 503.
  if (r.error && r.error.code === "42703") return { user: { id, email }, supabase };
  if (r.error) return { response: Response.json({ error: "upstream_error", message: "Couldn't check your account. Try again." }, { status: 503 }) };
  if (r.data?.status !== "approved") return { response: Response.json({ error: "forbidden", message: "Your account is waiting for a leader's approval." }, { status: 403 }) };
  return { user: { id, email }, supabase };
}

/** True when an RPC error means the daily limit was hit (as opposed to a missing function or a permission problem). */
export function isLimitError(error: { message?: string } | null, phrase: string): boolean {
  return !!error && (error.message ?? "").toLowerCase().includes(phrase);
}
