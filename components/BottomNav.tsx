"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, string> = {
  home: "M3 11l9-7 9 7M5 10v10h14V10",
  trip: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4",
  todos: "M5 12l4 4 10-10",
  learn: "M12 5C9 3 5 3 3 4v14c2-1 6-1 9 1 3-2 7-2 9-1V4c-2-1-6-1-9 1zM12 5v14",
  translate: "M4 5h16v11H10l-4 4v-4H4zM8 9h8M8 12h5",
  files: "M6 3h8l4 4v14H6zM14 3v4h4",
};
const TABS = [
  { href: "/", label: "Home", icon: "home", match: (p: string) => p === "/" },
  { href: "/itinerary", label: "Itinerary", icon: "trip", match: (p: string) => p.startsWith("/itinerary") },
  { href: "/todos", label: "To-dos", icon: "todos", match: (p: string) => p.startsWith("/todos") },
  { href: "/learn", label: "Learn", icon: "learn", match: (p: string) => /^\/(learn|french|scripture)/.test(p) },
  { href: "/translate", label: "Translate", icon: "translate", match: (p: string) => p.startsWith("/translate") },
  { href: "/files", label: "Files", icon: "files", match: (p: string) => p.startsWith("/files") },
];

/** Hidden while inside a lesson or verse drill so the exercise gets the whole screen. */
const immersive = (p: string) => /^\/french\/./.test(p) || /^\/scripture\/(learn|review)/.test(p);

export default function BottomNav({ openTodos }: { openTodos: number }) {
  const path = usePathname();
  if (immersive(path)) return null;
  return (
    <nav aria-label="Sections" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto grid max-w-xl grid-cols-6">
        {TABS.map((t) => {
          const on = t.match(path);
          return (
            <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold ${on ? "text-primary" : "text-muted"}`}>
              {on && <span className="absolute top-0 h-1 w-10 rounded-b-full bg-primary" />}
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={on ? 2.4 : 1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[t.icon]} /></svg>
              {t.label}
              {t.href === "/todos" && openTodos > 0 && (
                <span className="absolute right-[calc(50%-24px)] top-1.5 min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-extrabold leading-5 text-[#2b2118]">{openTodos}</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
