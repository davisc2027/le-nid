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
  const { data: card } = await supabase.from("srs_cards").select("state, learned_at").eq("ref", key).maybeSingle();
  return (
    <>
      <ScriptureBackdrop />
      <LearnFlow verseKey={key} state={(card?.state as Record<string, unknown>) ?? null} firstTime={!card?.learned_at} />
    </>
  );
}
