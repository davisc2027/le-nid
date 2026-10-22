import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/env";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component; proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}

/** Service-role client. Server-only; bypasses RLS. Never import from client code. */
export function createServiceClient() {
  return createAdminClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export const getProfile = cache(async () => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) return null;
  // `status` exists after migration 0008; fall back so the app keeps working if the SQL has not been run yet.
  let failed = false;
  const read = async () => {
    const r = await supabase.from("profiles").select("id, name, role, status").eq("id", id).maybeSingle();
    if (!r.error) return r.data;
    // Only "undefined column" (42703) means migration 0008 has not run. Any other error (timeout, paused project)
    // must not turn into an approval, so treat it as no profile.
    if (r.error.code !== "42703") { failed = true; return null; }
    const old = await supabase.from("profiles").select("id, name, role").eq("id", id).maybeSingle();
    return old.data ? { ...old.data, status: "approved" as string } : null;
  };
  const data = await read();
  if (data || failed) return data;
  // Safety net: the sign-up trigger should have created this row.
  await supabase.from("profiles").insert({ id, email: claims.claims.email });
  return read();
});
