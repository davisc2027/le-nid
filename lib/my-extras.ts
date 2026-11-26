import type { SupabaseClient } from "@supabase/supabase-js";

export type MyExtras = {
  emergency_name: string | null; emergency_phone: string | null; emergency_relation: string | null; medical_notes: string | null;
  privacy_ack_at: string | null;
};

/** The signed-in person's own emergency info and consent stamp (migration 0021). null when the migration has not run or the read failed. */
export async function loadMyExtras(supabase: SupabaseClient): Promise<MyExtras | null> {
  try {
    const { data, error } = await supabase.rpc("my_profile_extras");
    if (error) return null;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? (row as MyExtras) : null;
  } catch {
    return null;
  }
}
