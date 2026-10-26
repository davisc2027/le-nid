"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TYPE_LABEL, type CultureCard, type Theme } from "./data";
import { READ_KEY, readSet, writeSet } from "./storage";
import CardBody from "./CardBody";
import Credit from "./Credit";

export type LibraryTheme = Theme & { cards: (CultureCard & { where?: string })[] };

/** All culture cards by theme, folded; opening one marks it read (kept on this device). /culture#id opens that card. */
export default function CultureLibrary({ themes }: { themes: LibraryTheme[] }) {
  const [read, setRead] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<string | null>(null);
  const total = themes.reduce((n, t) => n + t.cards.length, 0);

  useEffect(() => {
    const stored = readSet(READ_KEY);
    const hash = decodeURIComponent(window.location.hash.slice(1));
    const target = hash && themes.some((t) => t.cards.some((c) => c.id === hash)) ? hash : null;
    if (target) stored.add(target);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read state and the URL hash exist only in the browser
    setRead(stored);
    if (target) {
      setOpen(target);
      writeSet(READ_KEY, stored);
      requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
    }
  }, [themes]);

  function toggle(id: string) {
    const next = open === id ? null : id;
    setOpen(next);
    if (next && !read.has(next)) {
      const r = new Set(read).add(next);
      setRead(r);
      writeSet(READ_KEY, r);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm font-bold text-muted">{themes.reduce((n, t) => n + t.cards.filter((c) => read.has(c.id)).length, 0)} of {total} cards read</p>
      {themes.map((t) => {
        const done = t.cards.filter((c) => read.has(c.id)).length;
        return (
          <section key={t.id} className="flex flex-col gap-2" aria-labelledby={`theme-${t.id}`}>
            <div>
              <h2 id={`theme-${t.id}`} className="font-extrabold text-primary">{t.title}</h2>
              <p className="text-sm text-muted">{t.blurb} · {done}/{t.cards.length} read</p>
              {t.credit && <Credit credit={t.credit} />}
            </div>
            {t.cards.map((c) => {
              const isOpen = open === c.id;
              const unread = !read.has(c.id);
              return (
                <article key={c.id} id={c.id} className="card scroll-mt-4 !p-3">
                  <button onClick={() => toggle(c.id)} aria-expanded={isOpen} className="flex min-h-11 w-full items-center gap-2 text-left">
                    <span className={`size-2.5 shrink-0 rounded-full ${unread ? "bg-accent" : "bg-transparent"}`} aria-hidden="true" />
                    <span className="flex-1">
                      <span className="label block">{TYPE_LABEL[c.type]}{unread && <span className="sr-only">, unread</span>}</span>
                      <span className="font-bold">{c.title}</span>
                    </span>
                    <ChevronDown size={20} className={`shrink-0 text-muted transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                  </button>
                  {isOpen && (
                    <div className="mt-2 flex flex-col gap-2">
                      <CardBody card={c} sources />
                      {c.where && <p className="text-xs text-muted">In the course: {c.where}</p>}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
