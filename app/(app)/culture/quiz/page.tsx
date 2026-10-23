import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CARD_BY_ID, QUESTIONS } from "@/components/culture/data";
import QuizRunner, { type QuizQuestion } from "@/components/culture/QuizRunner";

export default function CultureQuiz() {
  const questions: QuizQuestion[] = QUESTIONS.map((q) => ({ ...q, cardTitle: CARD_BY_ID.get(q.card)?.title ?? "" }));
  return (
    <div className="flex flex-col gap-4">
      <Link href="/culture" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-muted"><ChevronLeft size={18} aria-hidden="true" />Culture</Link>
      <h1 className="sr-only">Etiquette quiz</h1>
      <QuizRunner questions={questions} />
    </div>
  );
}
