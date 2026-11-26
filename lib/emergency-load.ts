import defaults from "@/content/emergency/defaults.json";
import { createClient } from "@/lib/supabase/server";
import { mergeEmergency, SLUG, type EmergencyContent } from "@/lib/emergency";

export const EMERGENCY_DEFAULTS = defaults as EmergencyContent;

/** Shipped placeholders plus the admin's edits. Never throws: if app_content is missing or unreadable the defaults show. */
export async function loadEmergency(): Promise<{ content: EmergencyContent; missing: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_content").select("data").eq("slug", SLUG).maybeSingle();
    if (error) return { content: EMERGENCY_DEFAULTS, missing: true };
    return { content: data ? mergeEmergency(EMERGENCY_DEFAULTS, data.data) : EMERGENCY_DEFAULTS, missing: false };
  } catch {
    return { content: EMERGENCY_DEFAULTS, missing: true };
  }
}
