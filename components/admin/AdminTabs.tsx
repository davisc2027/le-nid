"use client";

import { useEffect, useState } from "react";

type Tab = { id: string; label: string; badge?: number };

/** Top tab bar for the admin page. Every panel is rendered on the server; the tabs only show one at a time, so forms keep their state. */
export default function AdminTabs({ tabs, panels }: { tabs: Tab[]; panels: Record<string, React.ReactNode> }) {
  const [active, setActive] = useState(tabs[0].id);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL hash exists only in the browser
    if (tabs.some((t) => t.id === h)) setActive(h);
  }, [tabs]);
  function pick(id: string) {
    setActive(id);
    try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ }
  }
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Admin sections" className="sticky top-0 z-10 -mx-4 flex gap-1 overflow-x-auto bg-background px-4 py-2">
        {tabs.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={active === t.id} aria-controls={`panel-${t.id}`} onClick={() => pick(t.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${active === t.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface"}`}>
            {t.label}
            {!!t.badge && <span className="ml-1.5 inline-block min-w-5 rounded-full bg-accent px-1.5 text-xs text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} hidden={active !== t.id} className="flex flex-col gap-3">
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
