"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Landmark } from "lucide-react";
import { cardForLesson, TYPE_LABEL } from "./data";
import { addTo, READ_KEY } from "./storage";
import CardBody from "./CardBody";

/**
 * "À savoir": the one culture card a lesson may have, shown small and skippable. In the intro it starts folded
 * (one tap to open, nothing to dismiss); on the completion screen it starts open. Opening it marks it read.
 * Renders nothing for lessons without a card.
 */
export default function CultureNote({ lessonId, moment }: { lessonId: string; moment: "intro" | "done" }) {
  const card = cardForLesson(lessonId, moment);
  const [open, setOpen] = useState(moment === "done");
  useEffect(() => { if (card && open) addTo(READ_KEY, card.id); }, [card, open]);
  if (!card) return null;
  return (
    <aside className="card flex flex-col gap-2 !p-3 text-left" aria-label="À savoir">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-11 items-center gap-2 text-left">
        <Landmark size={18} className="shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1">
          <span className="label block">À savoir · {TYPE_LABEL[card.type]}</span>
          <span className="font-bold">{card.title}</span>
        </span>
        <ChevronDown size={20} className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {open && <CardBody card={card} />}
      {open && moment === "done" && (
        <Link href={`/culture#${card.id}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted underline">More in Culture</Link>
      )}
    </aside>
  );
}
