import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickPracticeKeys, practiceFrontier, type CardMap } from "@/lib/french/exercises";
import LessonPlayer from "@/components/french/LessonPlayer";

export default async function PracticePage() {
  let rows: { key: string; state: Record<string, unknown>; due: string; last_review: string | null }[] | null = null;
  let completed: string[] | null = null; // finished lessons: they, not the saved cards, set the practice tier
  try {
    const supabase = await createClient();
    const [{ data, error }, progress] = await Promise.all([
      supabase.from("vocab_cards").select("key, state, due, last_review"),
      supabase.from("lesson_progress").select("lesson_id"),
    ]);
    if (!error && data) rows = data;
    if (!progress.error && progress.data) completed = progress.data.map((d) => d.lesson_id as string);
  } catch {
    rows = null;
  }
  if (!rows) redirect("/french"); // vocab_cards unavailable (migration 0009 not run): practice is hidden

  const keys = pickPracticeKeys(rows);
  if (!keys.length)
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <h1 className="text-2xl font-extrabold">Practice</h1>
        <p className="card w-full">Nothing due. Come back tomorrow, or replay a lesson.</p>
        <Link href="/french" className="btn w-full">Back to French</Link>
      </div>
    );

  const cards: CardMap = Object.fromEntries(rows.map((r) => [r.key, { state: r.state, due: r.due, last_review: r.last_review }]));
  return <LessonPlayer mode="practice" nextHref="/french" cards={cards} practiceKeys={keys} frontier={practiceFrontier(completed, cards)} />;
}
