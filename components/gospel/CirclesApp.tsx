"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { GospelContent } from "@/lib/gospel";
import { DraftFlag, LangToggle, UI, useLang } from "./shared";
import CirclesWatch from "./CirclesWatch";
import CirclesWords from "./CirclesWords";
import CirclesPractice from "./CirclesPractice";

const TABS = [{ id: "watch", label: "Watch" }, { id: "words", label: "Words" }, { id: "practice", label: "Practice" }] as const;
type Tab = (typeof TABS)[number]["id"];

/** The Three Circles page: Watch / Words / Practice. The wording comes from the server (shipped text plus admin edits). */
export default function CirclesApp({ content, reviewed, startStep = 0 }: { content: GospelContent; reviewed: boolean; startStep?: number }) {
  const [tab, setTab] = useState<Tab>("watch");
  const [lang, setLang] = useLang();
  const draft = !reviewed && (tab !== "watch" || lang === "fr");
  return (
    <div className="flex flex-col gap-3">
      <Link href="/learn" className="-mb-1 inline-flex min-h-11 items-center gap-1 self-start text-sm font-bold text-muted"><ChevronLeft size={18} aria-hidden="true" />Learn</Link>
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold" lang={tab === "watch" ? lang : "en"}>{content.title[tab === "watch" ? lang : "en"]}</h1>
        <div className="flex items-center gap-2">
          {draft && <DraftFlag />}
          {tab === "watch" && <LangToggle lang={lang} setLang={setLang} />}
        </div>
      </div>
      <div role="tablist" aria-label="Three Circles" className="flex gap-1.5">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} aria-controls={`cc-${t.id}`} id={`cc-tab-${t.id}`} onClick={() => setTab(t.id)}
            className={`min-h-11 flex-1 rounded-full border text-sm font-extrabold ${tab === t.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface"}`}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={`cc-${tab}`} aria-labelledby={`cc-tab-${tab}`} className="flex flex-col gap-3">
        {tab === "watch" && <CirclesWatch content={content} lang={lang} startStep={startStep} />}
        {tab === "words" && <CirclesWords content={content} />}
        {tab === "practice" && <CirclesPractice content={content} />}
      </div>
      <p className="mt-2 text-center text-xs text-muted">{UI[lang].credit}</p>
    </div>
  );
}
