import defaults from "@/content/gospel/three-circles.json";
import { createClient } from "@/lib/supabase/server";
import { mergeGospel, SLUG, type GospelContent } from "@/lib/gospel";

export const GOSPEL_DEFAULTS = defaults as GospelContent;

export type GospelLoad = {
  content: GospelContent;
  /** True once a native speaker ticked "Reviewed" in the admin editor. Until then French shows a "Draft French" note. */
  reviewed: boolean;
  /** True when app_content could not be read (migration 0017 not run yet). The defaults are shown. */
  missing: boolean;
};

/** Shipped wording plus the admin's edits. Never throws: if the table is missing or unreadable the defaults show. */
export async function loadGospel(): Promise<GospelLoad> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("app_content").select("data, reviewed").eq("slug", SLUG).maybeSingle();
    if (error) return { content: GOSPEL_DEFAULTS, reviewed: false, missing: true };
    if (!data) return { content: GOSPEL_DEFAULTS, reviewed: false, missing: false };
    return { content: mergeGospel(GOSPEL_DEFAULTS, data.data), reviewed: data.reviewed === true, missing: false };
  } catch {
    return { content: GOSPEL_DEFAULTS, reviewed: false, missing: true };
  }
}
