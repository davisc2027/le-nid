"use client";

import { usePathname } from "next/navigation"; // Next.js App Router

// Page-to-page fade. Put it INSIDE the persistent layout (sidebar / header
// stay put) around `{children}`:
//
//   <main> ...chrome... <RouteTransition>{children}</RouteTransition> </main>
//
// Keyed on pathname so it remounts - and replays the fade - on real page
// changes only, NOT on search-param updates (a filter dropdown must not
// re-fade the whole page). Opacity-only and 180ms: it fires on every
// navigation, so it has to feel instant, not like an event.
export default function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
