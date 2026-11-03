"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { loadVerse } from "@/lib/bible/load";
import { keyToRef, refLabel, refLabelEn } from "@/lib/bible/reference";
import type { Lang } from "@/lib/gospel";

const KEY = "le-nid-circles-lang";
const EVT = "le-nid-circles-lang-change";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
};
const read = (): Lang => { try { return localStorage.getItem(KEY) === "fr" ? "fr" : "en"; } catch { return "en"; } };

/** English / Français for the Three Circles pages, remembered on this device (localStorage can be missing, so it falls back to English). */
export function useLang(): [Lang, (l: Lang) => void] {
  const lang = useSyncExternalStore(subscribe, read, () => "en" as Lang);
  return [lang, (l) => { try { localStorage.setItem(KEY, l); } catch { /* ignore */ } window.dispatchEvent(new Event(EVT)); }];
}

export const UI = {
  en: { back: "Back", next: "Next", again: "Start over", show: "Show them (full screen)", close: "Close", verse: "Verse", draft: "Draft French", ask: "Ask", credit: "Based on the Three Circles conversation framework (Life on Mission, NAMB)", language: "Language", step: "Step" },
  fr: { back: "Retour", next: "Suivant", again: "Recommencer", show: "Montrer (plein écran)", close: "Fermer", verse: "Verset", draft: "Français provisoire", ask: "Demandez", credit: "D'après la démarche des trois cercles (Life on Mission, NAMB)", language: "Langue", step: "Étape" },
} as const;

export const DRAFT_HELP = "This French is a draft. A native speaker has not checked it yet.";

export function DraftFlag() {
  return <span className="rounded-md bg-[#fff3cd] px-2 py-0.5 text-[11px] font-black text-[#6b4e00]" title={DRAFT_HELP}>Draft French</span>;
}

export function LangToggle({ lang, setLang, big = false }: { lang: Lang; setLang: (l: Lang) => void; big?: boolean }) {
  return (
    <div role="group" aria-label="Language" className="flex overflow-hidden rounded-full border-2 border-primary">
      {(["en", "fr"] as const).map((l) => (
        <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
          className={`min-h-11 px-4 font-black ${big ? "text-base" : "text-sm"} ${lang === l ? "bg-primary text-primary-fg" : "bg-surface text-primary"}`}>
          {l === "en" ? "EN" : "FR"}
        </button>
      ))}
    </div>
  );
}

/** Verse reference chips. Tapping one opens the sheet with the text from the app's own Bible files. */
export function VerseChips({ verses, lang, onOpen, large = false }: { verses: string[]; lang: Lang; onOpen: (key: string) => void; large?: boolean }) {
  if (verses.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {verses.map((v) => (
        <button key={v} type="button" onClick={() => onOpen(v)} aria-label={`${UI[lang].verse}: ${lang === "fr" ? refLabel(v) : refLabelEn(v)}`}
          className={`rounded-full bg-tint font-extrabold text-[var(--cc-believe)] ${large ? "min-h-12 px-5 text-lg" : "min-h-11 px-4 text-sm"}`}>
          {lang === "fr" ? refLabel(v) : refLabelEn(v)}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet showing one verse, in the chosen language, from public/bible (the same text as the rest of the app). */
export function VerseSheet({ verse, lang, onClose }: { verse: string; lang: Lang; onClose: () => void }) {
  const [text, setText] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    loadVerse(verse).then((v) => { if (live) setText(v ? (lang === "en" ? v.en ?? v.fr : v.fr) : null); }, () => { if (live) setText(null); });
    return () => { live = false; };
  }, [verse, lang]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  const label = keyToRef(verse) ? (lang === "fr" ? refLabel(verse) : refLabelEn(verse)) : verse;
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}
        className="mx-auto w-full max-w-xl rounded-t-3xl border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold">{label}</h2>
          <button type="button" onClick={onClose} aria-label={UI[lang].close} className="grid size-11 shrink-0 place-items-center rounded-full border border-border"><X size={20} aria-hidden="true" /></button>
        </div>
        <p lang={lang} className="mt-2 max-h-[50svh] overflow-y-auto text-lg leading-relaxed" aria-live="polite">
          {text === undefined ? "…" : text ?? (lang === "fr" ? "Le texte n'est pas disponible pour l'instant." : "The verse text is not available right now.")}
        </p>
      </div>
    </div>
  );
}
