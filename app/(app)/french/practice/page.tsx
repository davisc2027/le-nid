import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pickPracticeKeys, type CardMap } from "@/lib/french/exercises";
import LessonPlayer from "@/components/french/LessonPlayer";

export default async function PracticePage() {
  let rows: { key: string; state: Record<string, unknown>; due: string; last_review: string | null }[] | null = null;
  try {
    const { data, error } = await (await createClient()).from("vocab_cards").select("key, state, due, last_review");
    if (!error && data) rows = data;
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
  return <LessonPlayer mode="practice" nextHref="/french" cards={cards} practiceKeys={keys} />;
}
