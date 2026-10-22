import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
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

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("id, name, role").eq("id", user.id).maybeSingle();
  if (data) return data;
  // Safety net: the sign-up trigger should have created this row.
  await supabase.from("profiles").insert({ id: user.id, email: user.email });
  const { data: created } = await supabase.from("profiles").select("id, name, role").eq("id", user.id).maybeSingle();
  return created;
}
