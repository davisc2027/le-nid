import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CARD_BY_ID, CHECKLIST } from "@/components/culture/data";
import Checklist from "@/components/culture/Checklist";

export default function BeforeYouGo() {
  const titles = Object.fromEntries(CHECKLIST.map((i) => [i.card, CARD_BY_ID.get(i.card)?.title ?? ""]));
  return (
    <div className="flex flex-col gap-4">
      <Link href="/culture" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-muted"><ChevronLeft size={18} aria-hidden="true" />Culture</Link>
      <div>
        <p className="label">À savoir</p>
        <h1 className="text-2xl font-extrabold">Before you go</h1>
        <p className="mt-1 text-sm text-muted">The short version for the team. Tick each one once you&apos;ve got it; each links to the card that explains why.</p>
      </div>
      <Checklist items={CHECKLIST} titles={titles} />
    </div>
  );
}
