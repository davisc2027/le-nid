import { notFound } from "next/navigation";
import { ALL_LESSONS } from "@/lib/french/content";
import type { CardMap } from "@/lib/french/exercises";
import { createClient } from "@/lib/supabase/server";
import LessonPlayer from "@/components/french/LessonPlayer";

export default async function LessonPage({ params }: PageProps<"/french/[lesson]">) {
  const { lesson: id } = await params;
  const idx = ALL_LESSONS.findIndex((l) => l.id === id);
  if (idx < 0) notFound();
  const next = ALL_LESSONS[idx + 1];

  // Spaced-repetition cards and finished lessons. If vocab_cards is unavailable (migration 0009 not run yet),
  // cards stay null and the player silently skips review and card saving.
  let cards: CardMap | null = null;
  let completed: string[] = [];
  try {
    const supabase = await createClient();
    const [progress, vocab] = await Promise.all([
      supabase.from("lesson_progress").select("lesson_id"),
      supabase.from("vocab_cards").select("key, state, due, last_review"),
    ]);
    completed = progress.error ? [] : (progress.data ?? []).map((d) => d.lesson_id as string);
    if (!vocab.error && vocab.data) {
      cards = Object.fromEntries(vocab.data.map((r) => [r.key as string, { state: r.state, due: r.due, last_review: r.last_review }]));
    }
  } catch {
    cards = null;
  }
  return <LessonPlayer lesson={ALL_LESSONS[idx]} nextHref={next ? `/french/${next.id}` : "/french"} cards={cards} completed={completed} />;
}
