import { notFound } from "next/navigation";
import { ALL_LESSONS } from "@/lib/french/content";
import LessonPlayer from "@/components/french/LessonPlayer";

export default async function LessonPage({ params }: PageProps<"/french/[lesson]">) {
  const { lesson: id } = await params;
  const idx = ALL_LESSONS.findIndex((l) => l.id === id);
  if (idx < 0) notFound();
  const next = ALL_LESSONS[idx + 1];
  return <LessonPlayer lesson={ALL_LESSONS[idx]} nextHref={next ? `/french/${next.id}` : "/french"} />;
}
