// Pure itinerary logic: time zones (Intl only), 12-hour text, day status, Now/Next, labels.
// No dependencies, no path aliases, so `node --experimental-strip-types` can test it.

export type Tz = "Europe/Paris" | "America/Chicago";
export const DEFAULT_TZ: Tz = "Europe/Paris";

export type ItineraryItem = {
  id: string;
  day: string; // YYYY-MM-DD
  start_time: string | null; // HH:MM or HH:MM:SS, local to the item's tz
  end_time: string | null;
  title: string;
  location: string | null;
  map_url: string | null;
  notes: string | null;
  tz?: string | null; // missing before migration 0016
  updated_at?: string | null; // missing before migration 0016
  created_at?: string | null;
};

export type ItineraryDay = {
  day: string;
  index: number; // 1-based position counting from the first itinerary day
  tz: Tz; // zone of the day (zone of its first timed item)
  mixed: boolean; // items on this day use more than one zone
  items: ItineraryItem[];
};

export type DayStatus = "past" | "today" | "future";

const MIN = 60_000;
const HOUR = 60 * MIN;
export const DEFAULT_DURATION_MIN = 60;
export const UPDATED_WINDOW_MS = 24 * HOUR;

export const normalizeTz = (v: unknown): Tz => (v === "America/Chicago" ? "America/Chicago" : DEFAULT_TZ);
export const tzLabel = (tz: Tz) => (tz === "America/Chicago" ? "Texas time" : "Strasbourg time");

// ---------- zone arithmetic ----------

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function formatter(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function wallParts(ms: number, tz: string) {
  const o: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return o;
}

/** Offset of the zone from UTC at an instant, in ms (Chicago winter -6h, summer -5h; Paris +1h / +2h). */
export function offsetMs(ms: number, tz: string): number {
  const p = wallParts(ms, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDay(day: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const chk = new Date(Date.UTC(y, mo - 1, d));
  return chk.getUTCFullYear() === y && chk.getUTCMonth() === mo - 1 && chk.getUTCDate() === d ? [y, mo, d] : null;
}

/** Minutes after midnight for "HH:MM" or "HH:MM:SS"; null if empty or invalid. */
export function parseTime(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!m) return null;
  const [h, mi] = [Number(m[1]), Number(m[2])];
  return h > 23 || mi > 59 ? null : h * 60 + mi;
}

/** The instant (ms since epoch) at which the wall clock in `tz` reads `day` + `minutes`. DST-safe. */
export function zonedInstant(day: string, minutes: number, tz: string): number | null {
  const d = parseDay(day);
  if (!d) return null;
  const wall = Date.UTC(d[0], d[1] - 1, d[2]) + minutes * MIN;
  const t1 = wall - offsetMs(wall, tz);
  return wall - offsetMs(t1, tz);
}

/** Calendar date (YYYY-MM-DD) and minutes after midnight on the wall clock of `tz` at an instant. */
export function localParts(ms: number, tz: string): { date: string; minutes: number } {
  const p = wallParts(ms, tz);
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, minutes: p.hour * 60 + p.minute };
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  if (!d) return day;
  const t = new Date(Date.UTC(d[0], d[1] - 1, d[2] + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// ---------- text ----------

/** 0 -> "12:00 AM", 900 -> "3:00 PM". */
export function fmt12(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

/** "3:00 PM – 5:00 PM", "3:00 PM", or "All day" when there is no start time. */
export function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  const s = parseTime(start);
  if (s == null) return "All day";
  const e = parseTime(end);
  return e == null ? fmt12(s) : `${fmt12(s)} – ${fmt12(e)}`;
}

/** "Friday, 12 March" (matches the old page). */
export function dayHeading(day: string): string {
  return new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
}

/** "Fri 12" for the jump bar. */
export function dayChip(day: string): string {
  const dt = new Date(day + "T12:00:00Z");
  const wd = dt.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" });
  return `${wd} ${dt.getUTCDate()}`;
}

// ---------- items and days ----------

export function itemTz(i: ItineraryItem): Tz {
  return normalizeTz(i.tz);
}

/** Start and end instants. No start time -> both null. No end time (or an end that equals the start) -> 60 minutes. An end before the start rolls to the next day. */
export function itemWindow(i: ItineraryItem): { start: number | null; end: number | null } {
  const sm = parseTime(i.start_time);
  if (sm == null) return { start: null, end: null };
  const tz = itemTz(i);
  const start = zonedInstant(i.day, sm, tz);
  if (start == null) return { start: null, end: null };
  const em = parseTime(i.end_time);
  let end: number | null = null;
  if (em != null && em !== sm) end = zonedInstant(em > sm ? i.day : addDays(i.day, 1), em, tz);
  if (end == null || end <= start) end = start + DEFAULT_DURATION_MIN * MIN;
  return { start, end };
}

/** Groups by day ascending; inside a day timed items by real start instant, all-day items last. */
export function buildDays(items: ItineraryItem[]): ItineraryDay[] {
  const byDay = new Map<string, ItineraryItem[]>();
  for (const i of items) byDay.set(i.day, [...(byDay.get(i.day) ?? []), i]);
  return [...byDay.keys()].sort().map((day, k) => {
    const list = byDay.get(day)!
      .map((item, pos) => ({ item, pos, start: itemWindow(item).start }))
      .sort((a, b) => (a.start == null ? 1 : 0) - (b.start == null ? 1 : 0) || (a.start ?? 0) - (b.start ?? 0) || a.pos - b.pos)
      .map((x) => x.item);
    const zones = new Set(list.map(itemTz));
    const firstTimed = list.find((i) => parseTime(i.start_time) != null) ?? list[0];
    return { day, index: k + 1, tz: itemTz(firstTimed), mixed: zones.size > 1, items: list };
  });
}

/** past: the day (and every item) is over. today: its calendar day has begun, or an item runs past midnight, and it is not over. future: not started. */
export function dayStatus(d: ItineraryDay, now: number): DayStatus {
  const start = zonedInstant(d.day, 0, d.tz);
  const nextMidnight = zonedInstant(addDays(d.day, 1), 0, d.tz);
  if (start == null || nextMidnight == null) return "future";
  let over = nextMidnight;
  for (const i of d.items) over = Math.max(over, itemWindow(i).end ?? 0);
  if (now >= over) return "past";
  return now < start ? "future" : "today";
}

/** "Today", "Tomorrow" or "Day N". `todayDay` must be the day that gets the Today label (see todayDayKey). */
export function dayLabel(d: ItineraryDay, now: number, todayDay: string | null): string {
  const here = localParts(now, d.tz).date;
  if (d.day === here && d.day === todayDay) return "Today";
  if (d.day === addDays(here, 1)) return "Tomorrow";
  return `Day ${d.index}`;
}

/** Of the days whose own calendar date is now, the earliest one (avoids two "Today" labels when zones overlap). */
export function todayDayKey(days: ItineraryDay[], now: number): string | null {
  return days.find((d) => localParts(now, d.tz).date === d.day)?.day ?? null;
}

/** Day to scroll to: the first day that is not over; if all are over, the last. Null if there are no days. */
export function anchorDay(days: ItineraryDay[], now: number): string | null {
  if (!days.length) return null;
  return (days.find((d) => dayStatus(d, now) !== "past") ?? days[days.length - 1]).day;
}

/** Items happening now (start <= now < end) and the single next item (earliest start after now). All-day items are neither. */
export function nowAndNext(days: ItineraryDay[], now: number): { nowIds: Set<string>; nextId: string | null } {
  const nowIds = new Set<string>();
  let next: { id: string; start: number } | null = null;
  for (const d of days) {
    for (const i of d.items) {
      const w = itemWindow(i);
      if (w.start == null || w.end == null) continue;
      if (w.start <= now && now < w.end) nowIds.add(i.id);
      else if (w.start > now && (!next || w.start < next.start)) next = { id: i.id, start: w.start };
    }
  }
  return { nowIds, nextId: next ? next.id : null };
}

/** ISO timestamp -> ms. Trims microseconds to milliseconds first so every browser parses it. */
export function parseTimestamp(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = Date.parse(s.replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(t) ? null : t;
}

/** "Updated" tag: edited (updated_at clearly after created_at) within the last 24 hours. Missing columns -> false. */
export function isRecentlyUpdated(i: ItineraryItem, now: number): boolean {
  const u = parseTimestamp(i.updated_at);
  if (u == null) return false;
  const c = parseTimestamp(i.created_at);
  if (c != null && u - c < 5_000) return false;
  return now - u < UPDATED_WINDOW_MS && u - now < 5 * MIN;
}

