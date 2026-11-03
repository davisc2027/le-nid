"use client";

import { useEffect, useState } from "react";

type Tab = { id: string; label: string; badge?: number };

/** Top tab bar for the admin page. Every panel is rendered on the server; the tabs only show one at a time, so forms keep their state. */
export default function AdminTabs({ tabs, panels, nested = false, label = "Admin sections" }: { tabs: Tab[]; panels: Record<string, React.ReactNode>; nested?: boolean; label?: string }) {
  const [active, setActive] = useState(tabs[0].id);
  useEffect(() => {
    if (nested) return; // inner tab bars do not touch the URL hash the page tabs use
    const h = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the URL hash exists only in the browser
    if (tabs.some((t) => t.id === h)) setActive(h);
  }, [tabs, nested]);
  function pick(id: string) {
    setActive(id);
    if (nested) return;
    try { history.replaceState(null, "", `#${id}`); } catch { /* ignore */ }
  }
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto py-2 ${nested ? "" : "sticky top-0 z-10 -mx-4 bg-background px-4"}`}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" id={`${nested ? "sub" : ""}tab-${t.id}`} aria-selected={active === t.id} aria-controls={`${nested ? "sub" : ""}panel-${t.id}`} onClick={() => pick(t.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold ${active === t.id ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface"}`}>
            {t.label}
            {!!t.badge && <span className="ml-1.5 inline-block min-w-5 rounded-full bg-accent px-1.5 text-xs text-white">{t.badge}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" id={`${nested ? "sub" : ""}panel-${t.id}`} aria-labelledby={`${nested ? "sub" : ""}tab-${t.id}`} hidden={active !== t.id} className="flex flex-col gap-3">
          {panels[t.id]}
        </div>
      ))}
    </div>
  );
}
