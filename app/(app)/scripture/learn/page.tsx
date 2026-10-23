import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { keyToRef } from "@/lib/bible/reference";
import LearnFlow from "@/components/scripture/LearnFlow";
import ScriptureBackdrop from "@/components/art/ScriptureBackdrop";

export default async function Learn({ searchParams }: PageProps<"/scripture/learn">) {
  const { ref } = await searchParams;
  const key = typeof ref === "string" ? ref : "";
  if (!keyToRef(key)) notFound();
  const supabase = await createClient();
  // srs_cards.progress arrives with migration 0011; until then read without it (progress then lives on the device).
  const one = (cols: string) => supabase.from("srs_cards").select(cols).eq("ref", key).maybeSingle();
  const first = await one("state, learned_at, progress");
  const { data } = first.error ? await one("state, learned_at") : first;
  const row = data as unknown as { state?: unknown; learned_at?: string | null; progress?: unknown } | null;
  return (
    <>
      <ScriptureBackdrop />
      <LearnFlow verseKey={key} state={(row?.state as Record<string, unknown>) ?? null} learnedAt={row?.learned_at ?? null} saved={row?.progress} />
    </>
  );
}
