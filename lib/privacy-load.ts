import defaults from "@/content/privacy.json";
import { createClient } from "@/lib/supabase/server";
import { mergePrivacy, SLUG, type PrivacyContent } from "@/lib/privacy";

export const PRIVACY_DEFAULTS = defaults as PrivacyContent;

/** Shipped notice plus the admin's edits. Never throws: if app_content is missing or unreadable the defaults show. */
export async function loadPrivacy(): Promise<{ content: PrivacyContent; missing: boolean }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_content").select("data").eq("slug", SLUG).maybeSingle();
    if (error) return { content: PRIVACY_DEFAULTS, missing: true };
    return { content: data ? mergePrivacy(PRIVACY_DEFAULTS, data.data) : PRIVACY_DEFAULTS, missing: false };
  } catch {
    return { content: PRIVACY_DEFAULTS, missing: true };
  }
}
