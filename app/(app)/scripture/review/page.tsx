import { createClient } from "@/lib/supabase/server";
import ReviewSession from "@/components/scripture/ReviewSession";
import ScriptureBackdrop from "@/components/art/ScriptureBackdrop";

export default async function Review() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  // progress arrives with migration 0011; until then read without it
  const due = (cols: string) => supabase.from("srs_cards").select(cols).not("learned_at", "is", null).lte("due", now).order("due").limit(10);
  const first = await due("ref, state, learned_at, progress");
  const { data } = first.error ? await due("ref, state, learned_at") : first;
  const rows = (data ?? []) as unknown as { ref: string; state: unknown; learned_at: string | null; progress?: unknown }[];
  return (
    <>
      <ScriptureBackdrop />
      <ReviewSession cards={rows.map((c) => ({ ref: c.ref, state: c.state as Record<string, unknown> | null, learned_at: c.learned_at, progress: c.progress }))} />
    </>
  );
}
