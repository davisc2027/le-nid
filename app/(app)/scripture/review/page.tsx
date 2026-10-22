import { createClient } from "@/lib/supabase/server";
import ReviewSession from "@/components/scripture/ReviewSession";
import ScriptureBackdrop from "@/components/art/ScriptureBackdrop";

export default async function Review() {
  const supabase = await createClient();
  const { data } = await supabase.from("srs_cards").select("ref, state").not("learned_at", "is", null)
    .lte("due", new Date().toISOString()).order("due").limit(10);
  return (
    <>
      <ScriptureBackdrop />
      <ReviewSession cards={(data ?? []).map((c) => ({ ref: c.ref, state: c.state as Record<string, unknown> | null }))} />
    </>
  );
}
