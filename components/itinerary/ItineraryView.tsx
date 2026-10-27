"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import {
  anchorDay, buildDays, dayChip, dayHeading, dayLabel, dayStatus, formatRange, isRecentlyUpdated, itemTz, nowAndNext,
  todayDayKey, tzLabel, type ItineraryDay, type ItineraryItem,
} from "@/lib/itinerary";

// One shared clock: null while rendering on the server (so the HTML has no Now/Today markers), then the real time, refreshed every minute.
let snap: number | null = null;
const listeners = new Set<() => void>();
const tick = () => { snap = Date.now(); listeners.forEach((l) => l()); };
function subscribe(cb: () => void) {
  listeners.add(cb);
  tick();
  const id = setInterval(tick, 60_000);
  const wake = () => { if (document.visibilityState === "visible") tick(); };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("focus", wake);
  return () => {
    listeners.delete(cb);
    clearInterval(id);
    document.removeEventListener("visibilitychange", wake);
    window.removeEventListener("focus", wake);
  };
}
const getSnapshot = () => (snap ??= Date.now());
const getServerSnapshot = () => null;

const mapHref = (url: string | null, location: string | null) => {
  const u = url?.trim();
  if (u) return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  return location ? `https://maps.apple.com/?q=${encodeURIComponent(location)}` : null;
};

const dayId = (day: string) => `day-${day}`;
const smooth = () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");

function TzChip({ tz }: { tz: ReturnType<typeof itemTz> }) {
  return <span className="rounded-full border border-border px-2 py-0.5 text-xs font-bold text-muted">{tzLabel(tz)}</span>;
}

function ItemCard({ item, showTz, isNow, isNext, updated }: { item: ItineraryItem; showTz: boolean; isNow: boolean; isNext: boolean; updated: boolean }) {
  const href = mapHref(item.map_url, item.location);
  return (
    <div className={`card ${isNow ? "border-accent shadow-[0_0_0_1px_var(--accent)]" : ""}`} aria-current={isNow ? "time" : undefined}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-[17px] font-extrabold leading-tight">{formatRange(item.start_time, item.end_time)}</p>
        {isNow && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-extrabold text-[#2b2118]">Now</span>}
        {isNext && <span className="rounded-full border border-primary px-2.5 py-1 text-xs font-extrabold text-primary">Next</span>}
        {updated && <span className="tag">Updated</span>}
        {showTz && <TzChip tz={itemTz(item)} />}
      </div>
      <p className="mt-1 font-bold">{item.title}</p>
      {(item.location || href) && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
          {item.location ? <p className="py-2">{item.location}</p> : <span />}
          {href && (
            <a className="inline-flex min-h-11 min-w-11 items-center gap-1 py-2 font-bold text-primary underline" href={href} target="_blank" rel="noreferrer">
              <MapPin size={16} strokeWidth={2.4} aria-hidden="true" />Map<span className="sr-only">: {item.location ?? item.title}</span>
            </a>
          )}
        </div>
      )}
      {item.notes && <p className="whitespace-pre-wrap text-sm text-muted">{item.notes}</p>}
    </div>
  );
}

export default function ItineraryView({ items }: { items: ItineraryItem[] }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const days = useMemo(() => buildDays(items), [items]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const scrolled = useRef(false);

  const todayKey = now == null ? null : todayDayKey(days, now);
  const marks = useMemo(() => (now == null ? { nowIds: new Set<string>(), nextId: null } : nowAndNext(days, now)), [days, now]);
  const statuses = useMemo(() => new Map(days.map((d) => [d.day, now == null ? "future" : dayStatus(d, now)] as const)), [days, now]);

  // Open at today (or the nearest upcoming day). Instant on load; the first day needs no scrolling.
  useLayoutEffect(() => {
    if (now == null || scrolled.current) return;
    scrolled.current = true;
    const target = anchorDay(days, now);
    if (!target || target === days[0]?.day) return;
    document.getElementById(dayId(target))?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [now, days]);

  const jump = useCallback((day: string) => {
    if (statuses.get(day) === "past") setExpanded((s) => new Set(s).add(day));
    document.getElementById(dayId(day))?.scrollIntoView({ block: "start", behavior: smooth() });
  }, [statuses]);

  const toggle = (day: string) => setExpanded((s) => { const n = new Set(s); if (n.has(day)) n.delete(day); else n.add(day); return n; });

  // Keep the jump bar's current chip visible without moving the page.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const chip = navRef.current?.querySelector<HTMLElement>("[data-today]");
    if (chip && navRef.current) navRef.current.scrollLeft = Math.max(0, chip.offsetLeft - 16);
  }, [todayKey]);

  if (days.length === 0) return <p className="text-muted">Schedule coming soon.</p>;

  const render = (d: ItineraryDay) => {
    const status = statuses.get(d.day) ?? "future";
    const past = status === "past";
    const open = !past || expanded.has(d.day);
    const label = now == null ? `Day ${d.index}` : dayLabel(d, now, todayKey);
    const isToday = label === "Today";
    const panel = `${dayId(d.day)}-items`;
    const title = (
      <>
        <span className="font-bold text-primary">{dayHeading(d.day)}</span>
        <span className={isToday ? "rounded-full bg-primary px-2.5 py-1 text-xs font-extrabold text-primary-fg" : "tag"}>{label}</span>
        {!d.mixed && <TzChip tz={d.tz} />}
      </>
    );
    return (
      <section key={d.day} className={`flex flex-col gap-2 ${past ? "opacity-75" : ""}`} aria-labelledby={`${dayId(d.day)}-h`}>
        <h2 id={dayId(d.day)} className="scroll-mt-[72px] text-base">
          {past ? (
            <button type="button" id={`${dayId(d.day)}-h`} aria-expanded={open} aria-controls={panel} onClick={() => toggle(d.day)}
              className="flex min-h-11 w-full flex-wrap items-center gap-x-2 gap-y-1 text-left">
              {title}
              <span className="ml-auto flex items-center gap-1 text-sm text-muted">
                {d.items.length} {d.items.length === 1 ? "item" : "items"}
                <ChevronDown size={20} aria-hidden="true" className={open ? "rotate-180" : ""} />
              </span>
            </button>
          ) : (
            <span id={`${dayId(d.day)}-h`} className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1">{title}</span>
          )}
        </h2>
        {open && (
          <div id={panel} className="flex flex-col gap-2">
            {d.items.map((i) => (
              <ItemCard key={i.id} item={i} showTz={d.mixed} isNow={marks.nowIds.has(i.id)} isNext={marks.nextId === i.id}
                updated={now != null && isRecentlyUpdated(i, now)} />
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <>
      {days.length > 3 && (
        <nav ref={navRef} aria-label="Jump to a day"
          className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-background/95 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur [scrollbar-width:none]">
          {days.map((d) => {
            const st = statuses.get(d.day);
            const isToday = now != null && todayKey === d.day;
            return (
              <button key={d.day} type="button" onClick={() => jump(d.day)} aria-label={dayHeading(d.day)}
                aria-current={isToday ? "date" : undefined} data-today={isToday ? "" : undefined}
                className={`min-h-11 min-w-11 shrink-0 rounded-full border px-3.5 text-sm font-extrabold ${isToday ? "border-primary bg-primary text-primary-fg" : "border-border bg-surface"} ${st === "past" ? "opacity-60" : ""}`}>
                {dayChip(d.day)}
              </button>
            );
          })}
        </nav>
      )}
      {days.map(render)}
    </>
  );
}
