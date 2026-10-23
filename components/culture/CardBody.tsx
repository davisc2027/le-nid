"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Volume2 } from "lucide-react";
import Stork from "@/components/art/Stork";
import { GENTLE_KEY } from "@/lib/odile";
import { speak } from "@/lib/french/speech";
import type { CultureCard } from "./data";

/** Odile's line for a card: the sassy one unless gentle mode is on. Decided after mount (gentle lives in localStorage). */
export function useOdileLine(card: CultureCard): string | undefined {
  const [line, setLine] = useState(card.odile);
  useEffect(() => {
    let gentle = false;
    try { gentle = localStorage.getItem(GENTLE_KEY) === "1"; } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depends on localStorage, unknown during SSR
    setLine(!gentle && card.odileSass ? card.odileSass : card.odile);
  }, [card]);
  return line;
}

/** The inside of a culture card: text, the French phrase with a listen button, Odile's line and (optionally) sources. */
export default function CardBody({ card, sources = false, odile = true }: { card: CultureCard; sources?: boolean; odile?: boolean }) {
  const line = useOdileLine(card);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-relaxed">{card.text}</p>
      {card.phrase && (
        <div className="flex items-center gap-2 rounded-xl bg-tint px-3 py-2">
          <div className="flex-1">
            <p lang="fr" className="font-extrabold">{card.phrase.fr}</p>
            <p className="text-sm text-muted">{card.phrase.gloss}</p>
          </div>
          <button onClick={() => speak(card.phrase!.fr)} aria-label={`Listen: ${card.phrase.fr}`}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-surface text-primary">
            <Volume2 size={20} aria-hidden="true" />
          </button>
        </div>
      )}
      {odile && line && (
        <div className="flex items-end gap-2">
          <Stork mood="happy" size={40} />
          <p className="flex-1 text-sm font-semibold"><span className="sr-only">Odile says: </span>{line}</p>
        </div>
      )}
      {sources && (
        <details className="text-xs text-muted">
          <summary className="min-h-11 cursor-pointer content-center font-bold">Sources ({card.source.length})</summary>
          <ul className="flex flex-col gap-1.5 pb-1">
            {card.source.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noopener noreferrer" className="inline-flex items-start gap-1 break-all underline">
                  <ExternalLink size={12} className="mt-0.5 shrink-0" aria-hidden="true" />{new URL(u).hostname.replace(/^www\./, "")}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
