"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Stork from "@/components/art/Stork";
import type { CultureCard } from "./data";

/** "Pray this week": one prayer card a day from the list, the same for everyone on the same date. Static, offline. */
export default function PrayStrip({ cards }: { cards: CultureCard[] }) {
  const [i, setI] = useState(0);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- the day is known only in the browser
  useEffect(() => setI(Math.floor(Date.now() / 86_400_000) % Math.max(cards.length, 1)), [cards.length]);
  const card = cards[i];
  if (!card) return null;
  return (
    <aside className="card flex flex-col gap-2 !p-3" aria-label="Pray today">
      <p className="label">Pray today</p>
      <div className="flex items-start gap-2">
        <Stork mood="happy" size={40} />
        <div className="flex-1">
          <p className="font-bold">{card.title}</p>
          <p className="mt-1 text-sm leading-relaxed">{card.text}</p>
        </div>
      </div>
      <Link href={`/culture#${card.id}`} className="inline-flex min-h-11 items-center self-start text-sm text-muted underline">Open this card</Link>
    </aside>
  );
}
